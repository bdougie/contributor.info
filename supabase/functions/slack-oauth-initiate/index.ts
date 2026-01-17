/**
 * Slack OAuth Initiation Handler
 *
 * Generates a secure state token and initiates the Slack OAuth flow.
 * This endpoint creates an OAuth state in the database and returns
 * the Slack authorization URL with proper parameters.
 *
 * Flow:
 * 1. Client requests OAuth initiation with workspace_id
 * 2. Authenticate user and verify workspace membership
 * 3. Generate secure state token
 * 4. Store state in database with expiration
 * 5. Return Slack OAuth URL with state
 * 6. User is redirected to Slack for app authorization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID');
const SLACK_REDIRECT_URI = Deno.env.get('SLACK_REDIRECT_URI');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
  // Log request info WITHOUT sensitive headers
  console.log('OAuth initiate request received:', {
    method: req.method,
    url: req.url,
    // Only log non-sensitive headers
    hasAuthorization: req.headers.has('authorization'),
    contentType: req.headers.get('content-type'),
    origin: req.headers.get('origin'),
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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
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

    // Authenticate user
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !authUser) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Create Admin Supabase client for checks and updates
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify workspace membership
    const { data: member, error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (memberError || !member) {
      console.error('Authorization failed: User not a member of workspace', {
        userId: authUser.id,
        workspaceId: workspace_id,
        error: memberError
      });
      return new Response(JSON.stringify({ error: 'Not authorized for this workspace' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Generate secure state token
    const state = generateStateToken();

    // Calculate expiration (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store state in database
    const { error: insertError } = await supabaseAdmin
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
    await supabaseAdmin
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
