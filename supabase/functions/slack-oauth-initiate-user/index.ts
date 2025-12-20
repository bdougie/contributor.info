/**
 * Slack OAuth Initiation Handler for User-Level Integrations
 *
 * Generates a secure state token and initiates the Slack OAuth flow for
 * individual user repository integrations (monthly leaderboard notifications).
 *
 * Flow:
 * 1. Authenticated user requests OAuth initiation with repository info
 * 2. Generate secure state token with user_id and repository_id
 * 3. Store state in database with expiration
 * 4. Return Slack OAuth URL with state
 * 5. User is redirected to Slack for app authorization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID');
const SLACK_REDIRECT_URI_USER = Deno.env.get('SLACK_REDIRECT_URI_USER') ||
  Deno.env.get('SLACK_REDIRECT_URI')?.replace('slack-oauth-callback', 'slack-oauth-callback-user');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  owner: string;
  repo: string;
}

/**
 * Generate a cryptographically secure random state token
 */
function generateStateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Validate environment variables
    if (!SLACK_CLIENT_ID || !SLACK_REDIRECT_URI_USER) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get auth header for user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create authenticated Supabase client to get user
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'owner and repo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      return new Response(
        JSON.stringify({ error: 'Repository not found. It must be tracked first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if user already has max integrations
    const { count: integrationCount } = await supabase
      .from('user_slack_integrations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (integrationCount && integrationCount >= 5) {
      return new Response(
        JSON.stringify({ error: 'Maximum of 5 Slack integrations allowed per user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate secure state token
    const state = generateStateToken();

    // Calculate expiration (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store state in database with user and repository context
    const { error: insertError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        workspace_id: null, // Not a workspace flow
        user_id: user.id,
        repository_id: repoData.id,
        flow_type: 'user',
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error('Failed to store OAuth state:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Clean up old expired states
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('oauth_states')
      .delete()
      .lt('expires_at', oneHourAgo);

    // Construct Slack OAuth URL
    const scopes = [
      'chat:write',
      'chat:write.public',
      'channels:read',
      'groups:read',
      'team:read',
    ].join(',');

    const slackOAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackOAuthUrl.searchParams.append('client_id', SLACK_CLIENT_ID);
    slackOAuthUrl.searchParams.append('scope', scopes);
    slackOAuthUrl.searchParams.append('redirect_uri', SLACK_REDIRECT_URI_USER);
    slackOAuthUrl.searchParams.append('state', state);

    console.log('User OAuth flow initiated:', {
      user_id: user.id,
      repository: `${owner}/${repo}`,
      state_token_length: state.length,
    });

    return new Response(
      JSON.stringify({ oauth_url: slackOAuthUrl.toString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
