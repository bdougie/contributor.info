/**
 * Slack OAuth Callback Handler for User-Level Integrations
 *
 * Handles the OAuth callback from Slack for individual user repository integrations.
 * Exchanges the authorization code for a bot token and stores it securely.
 *
 * Flow:
 * 1. User clicks "Connect Slack" on repository page
 * 2. User is redirected to Slack OAuth authorize URL
 * 3. User approves permissions in Slack
 * 4. Slack redirects back to this endpoint with authorization code
 * 5. We exchange code for bot token
 * 6. Store encrypted bot token in user_slack_integrations
 * 7. Redirect user back to repository page
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptString } from '../_shared/encryption.ts';

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID');
const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET');
const SLACK_REDIRECT_URI_USER = Deno.env.get('SLACK_REDIRECT_URI_USER') ||
  Deno.env.get('SLACK_REDIRECT_URI')?.replace('slack-oauth-callback', 'slack-oauth-callback-user');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://contributor.info';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
  };
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Helper function to get redirect URL from state
    async function getRedirectUrl(stateToken: string | null): Promise<string> {
      if (!stateToken) return FRONTEND_URL;

      const { data } = await supabase
        .from('oauth_states')
        .select('repository_id, repositories!inner(owner, name)')
        .eq('state', stateToken)
        .eq('flow_type', 'user')
        .single();

      if (data?.repositories) {
        // Supabase returns single relation as object, but TS may see it differently
        const repos = data.repositories as unknown as { owner: string; name: string } | { owner: string; name: string }[];
        const repo = Array.isArray(repos) ? repos[0] : repos;
        if (repo) return `${FRONTEND_URL}/${repo.owner}/${repo.name}`;
      }
      return FRONTEND_URL;
    }

    // Check for user-cancelled installation
    if (error === 'access_denied') {
      const redirectUrl = await getRedirectUrl(state);
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectUrl}?slack_install=cancelled` },
      });
    }

    // Validate required parameters
    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate state exists, hasn't expired, and is for user flow
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select(`
        user_id,
        repository_id,
        expires_at,
        used,
        flow_type,
        repositories!inner(owner, name)
      `)
      .eq('state', state)
      .eq('flow_type', 'user')
      .single();

    if (stateError || !stateData) {
      console.error('Invalid OAuth state: %s', state);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OAuth state' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Check if state has already been used
    if (stateData.used) {
      console.error('OAuth state already used: %s', state);
      return new Response(
        JSON.stringify({ error: 'OAuth state has already been used' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Check if state has expired
    const now = new Date();
    const expiresAt = new Date(stateData.expires_at);
    if (now > expiresAt) {
      console.error('OAuth state expired: %s', state);
      return new Response(
        JSON.stringify({ error: 'OAuth state has expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Mark state as used to prevent replay attacks
    await supabase
      .from('oauth_states')
      .update({ used: true })
      .eq('state', state);

    const userId = stateData.user_id;
    const repositoryId = stateData.repository_id;
    // Supabase returns single relation as object, but TS may see it differently
    const repos = stateData.repositories as unknown as { owner: string; name: string } | { owner: string; name: string }[];
    const repo = Array.isArray(repos) ? repos[0] : repos;
    const repoPath = `${repo.owner}/${repo.name}`;

    // Exchange authorization code for access token
    let tokenResponse;
    try {
      tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID!,
          client_secret: SLACK_CLIENT_SECRET!,
          code,
          redirect_uri: SLACK_REDIRECT_URI_USER!,
        }),
      });
    } catch (networkError) {
      console.error('Network error during token exchange: %s', networkError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/${repoPath}?slack_install=error&error=network_error`,
        },
      });
    }

    if (!tokenResponse.ok) {
      console.error('Slack OAuth HTTP error: status %d', tokenResponse.status);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/${repoPath}?slack_install=error&error=oauth_failed`,
        },
      });
    }

    let tokenData: SlackOAuthResponse;
    try {
      tokenData = await tokenResponse.json();
    } catch (parseError) {
      console.error('Failed to parse Slack OAuth response: %s', parseError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/${repoPath}?slack_install=error&error=invalid_response`,
        },
      });
    }

    if (!tokenData.ok || !tokenData.access_token) {
      console.error('Slack OAuth error: %s', tokenData.error);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/${repoPath}?slack_install=error&error=${tokenData.error}`,
        },
      });
    }

    // Encrypt the bot token before storing
    let encryptedToken: string;
    try {
      encryptedToken = await encryptString(tokenData.access_token);
    } catch (encryptError) {
      console.error('Failed to encrypt bot token: %s', encryptError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/${repoPath}?slack_install=error&error=encryption_failed`,
        },
      });
    }

    // Check if integration already exists for this user, repo, and Slack team
    const { data: existing } = await supabase
      .from('user_slack_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('repository_id', repositoryId)
      .eq('slack_team_id', tokenData.team!.id)
      .maybeSingle();

    if (existing) {
      // Update existing integration with new token
      const { error: updateError } = await supabase
        .from('user_slack_integrations')
        .update({
          bot_token_encrypted: encryptedToken,
          bot_user_id: tokenData.bot_user_id,
          slack_team_name: tokenData.team!.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Failed to update integration: %s', updateError.message);
        throw updateError;
      }
    } else {
      // Create new integration record (channel will be selected in next step)
      const { error: insertError } = await supabase
        .from('user_slack_integrations')
        .insert({
          user_id: userId,
          repository_id: repositoryId,
          slack_team_id: tokenData.team!.id,
          slack_team_name: tokenData.team!.name,
          bot_token_encrypted: encryptedToken,
          bot_user_id: tokenData.bot_user_id,
          channel_id: 'pending', // Will be updated when user selects channel
          channel_name: 'Not configured',
          enabled: false, // Disabled until user selects a channel
        });

      if (insertError) {
        console.error('Failed to create integration: %s', insertError.message);
        throw insertError;
      }
    }

    // Redirect back to repository page with success message
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${FRONTEND_URL}/${repoPath}?slack_install=success&team=${
          encodeURIComponent(tokenData.team!.name)
        }`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error: %s', error);

    // Try to extract repository path from state for better error redirect
    let redirectPath = '';
    try {
      const url = new URL(req.url);
      const state = url.searchParams.get('state');
      if (state) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase
          .from('oauth_states')
          .select('repositories!inner(owner, name)')
          .eq('state', state)
          .single();
        if (data?.repositories) {
          // Supabase returns single relation as object, but TS may see it differently
          const repos = data.repositories as unknown as { owner: string; name: string } | { owner: string; name: string }[];
          const repo = Array.isArray(repos) ? repos[0] : repos;
          if (repo) redirectPath = `/${repo.owner}/${repo.name}`;
        }
      }
    } catch {
      // Ignore errors in error handler
    }

    if (redirectPath) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}${redirectPath}?slack_install=error&error=unexpected_error`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred during Slack authentication',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
