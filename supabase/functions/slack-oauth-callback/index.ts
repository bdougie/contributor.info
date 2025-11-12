/**
 * Slack OAuth Callback Handler
 *
 * Handles the OAuth callback from Slack when a user installs the app.
 * Exchanges the authorization code for a bot token and stores it securely.
 *
 * Flow:
 * 1. User clicks "Install Slack App" in workspace settings
 * 2. User is redirected to Slack OAuth authorize URL
 * 3. User approves permissions in Slack
 * 4. Slack redirects back to this endpoint with authorization code
 * 5. We exchange code for bot token
 * 6. Store encrypted bot token in database
 * 7. Redirect user back to workspace settings
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID');
const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET');
const SLACK_REDIRECT_URI = Deno.env.get('SLACK_REDIRECT_URI');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('SLACK_WEBHOOK_ENCRYPTION_KEY')!;
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

/**
 * Encrypt a string using Web Crypto API (same as client-side encryption.ts)
 */
async function encryptString(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(ENCRYPTION_KEY);

  // Import the key material
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  // Derive the actual encryption key
  const salt = encoder.encode('slack-webhook-salt');
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const data = encoder.encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Create Supabase client with service role early for state validation
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for user-cancelled installation - need to extract workspace_id from state
    if (error === 'access_denied') {
      // Try to look up the workspace_id from the state if provided
      let workspaceId = null;
      if (state) {
        const { data: stateData } = await supabase
          .from('oauth_states')
          .select('workspace_id')
          .eq('state', state)
          .single();
        workspaceId = stateData?.workspace_id;
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: workspaceId
            ? `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=cancelled`
            : `${FRONTEND_URL}/?slack_install=cancelled`,
        },
      });
    }

    // Validate required parameters
    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate state exists and hasn't expired
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('workspace_id, expires_at, used')
      .eq('state', state)
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
    const { error: updateStateError } = await supabase
      .from('oauth_states')
      .update({ used: true })
      .eq('state', state);

    if (updateStateError) {
      console.error('Failed to mark state as used: %s', updateStateError.message);
      // Continue anyway, but log the error
    }

    const workspaceId = stateData.workspace_id;

    // Exchange authorization code for access token
    let tokenResponse;
    try {
      tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID!,
          client_secret: SLACK_CLIENT_SECRET!,
          code,
          redirect_uri: SLACK_REDIRECT_URI!,
        }),
      });
    } catch (networkError) {
      console.error('Network error during token exchange: %s', networkError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=error&error=network_error`,
        },
      });
    }

    if (!tokenResponse.ok) {
      console.error('Slack OAuth HTTP error: status %d', tokenResponse.status);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=error&error=oauth_failed`,
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
          Location: `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=error&error=invalid_response`,
        },
      });
    }

    if (!tokenData.ok || !tokenData.access_token) {
      console.error('Slack OAuth error: %s', tokenData.error);
      return new Response(null, {
        status: 302,
        headers: {
          Location:
            `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=error&error=${tokenData.error}`,
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
          Location:
            `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=error&error=encryption_failed`,
        },
      });
    }

    // Get the workspace owner to use as created_by
    // OAuth callbacks from Slack don't include Authorization headers
    // If not found, we'll set it to null (which is allowed after migration)
    const { data: workspaceOwner } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .single();

    const userId = workspaceOwner?.user_id || null;

    if (!userId) {
      console.warn('No workspace owner found for workspace %s, setting created_by to null', workspaceId);
    }

    // Check if an integration already exists for this workspace and team
    const { data: existing } = await supabase
      .from('slack_integrations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('slack_team_id', tokenData.team!.id)
      .maybeSingle();

    if (existing) {
      // Update existing integration with new token
      const { error: updateError } = await supabase
        .from('slack_integrations')
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
      // Create new integration record (without channel - user will select later)
      const { error: insertError } = await supabase
        .from('slack_integrations')
        .insert({
          workspace_id: workspaceId,
          slack_team_id: tokenData.team!.id,
          slack_team_name: tokenData.team!.name,
          bot_token_encrypted: encryptedToken,
          bot_user_id: tokenData.bot_user_id,
          channel_name: 'Not configured', // Placeholder
          schedule: 'daily',
          enabled: false, // Disabled until user selects a channel
          created_by: userId,
        });

      if (insertError) {
        console.error('Failed to create integration: %s', insertError.message);
        throw insertError;
      }
    }

    // Redirect back to workspace settings with success message
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=success&team=${
          encodeURIComponent(tokenData.team!.name)
        }`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error: %s', error);

    // Try to extract workspace ID from state for better error redirect
    let workspaceId = null;
    try {
      const url = new URL(req.url);
      const state = url.searchParams.get('state');
      if (state) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase
          .from('oauth_states')
          .select('workspace_id')
          .eq('state', state)
          .single();
        workspaceId = data?.workspace_id;
      }
    } catch {
      // Ignore errors in error handler
    }

    // If we have a workspace ID, redirect to settings with error
    if (workspaceId) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${FRONTEND_URL}/workspace/${workspaceId}/settings?slack_install=error&error=unexpected_error`,
        },
      });
    }

    // Otherwise return a generic error response
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred during Slack authentication',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});
