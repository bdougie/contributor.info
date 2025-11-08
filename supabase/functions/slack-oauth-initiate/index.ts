/**
 * Slack OAuth Initiation Handler
 *
 * Generates a secure state token and initiates the Slack OAuth flow.
 * This endpoint creates an OAuth state in the database and returns
 * the Slack authorization URL with proper parameters.
 *
 * Flow:
 * 1. Client requests OAuth initiation with workspace_id
 * 2. Generate secure state token
 * 3. Store state in database with expiration
 * 4. Return Slack OAuth URL with state
 * 5. User is redirected to Slack for app authorization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID');
const SLACK_REDIRECT_URI = Deno.env.get('SLACK_REDIRECT_URI');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  workspace_id: string;
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

serve(async (req) => {
  console.log('OAuth initiate request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  try {
    // Validate environment variables
    if (!SLACK_CLIENT_ID || !SLACK_REDIRECT_URI) {
      console.error('Missing required environment variables:', {
        hasClientId: !!SLACK_CLIENT_ID,
        hasRedirectUri: !!SLACK_REDIRECT_URI,
        clientIdLength: SLACK_CLIENT_ID?.length || 0,
        redirectUri: SLACK_REDIRECT_URI || 'NOT_SET',
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate secure state token
    const state = generateStateToken();

    // Calculate expiration (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store state in database
    const { error: insertError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        workspace_id,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error('Failed to store OAuth state:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // Clean up old expired states (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('oauth_states')
      .delete()
      .lt('expires_at', oneHourAgo);

    // Construct Slack OAuth URL with all required parameters
    const scopes = [
      'chat:write',
      'chat:write.public',
      'channels:read',
      'groups:read',
      'im:read',
      'mpim:read',
      'team:read',
      'users:read',
    ].join(',');

    const slackOAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackOAuthUrl.searchParams.append('client_id', SLACK_CLIENT_ID);
    slackOAuthUrl.searchParams.append('scope', scopes);
    slackOAuthUrl.searchParams.append('redirect_uri', SLACK_REDIRECT_URI);
    slackOAuthUrl.searchParams.append('state', state);

    // Add user_scope if we need user-level permissions (optional)
    // slackOAuthUrl.searchParams.append('user_scope', 'identity.basic');

    console.log('OAuth flow initiated successfully:', {
      workspace_id,
      state_token_length: state.length,
      oauth_url_length: slackOAuthUrl.toString().length,
      scopes_included: scopes,
    });

    return new Response(
      JSON.stringify({
        oauth_url: slackOAuthUrl.toString(),
        // Don't return state in production for security
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
});
