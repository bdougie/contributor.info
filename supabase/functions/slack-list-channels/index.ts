/**
 * Slack List Channels Handler
 *
 * Fetches the list of channels the bot has access to.
 * This proxies the Slack API call through the backend to:
 * 1. Keep bot tokens secure (never exposed to frontend)
 * 2. Comply with Content Security Policy
 * 3. Handle encryption/decryption of bot tokens
 *
 * Flow:
 * 1. Frontend requests channels for an integration_id
 * 2. Fetch and decrypt bot token from database
 * 3. Call Slack API conversations.list
 * 4. Return channel list to frontend
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('SLACK_WEBHOOK_ENCRYPTION_KEY')!;

interface RequestBody {
  integration_id: string;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

/**
 * Decrypt a string using Web Crypto API (same as OAuth callback encryption)
 */
async function decryptString(encrypted: string): Promise<string> {
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

  // Derive the actual decryption key
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
    ['decrypt'],
  );

  // Decode from base64
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request body
    const body: RequestBody = await req.json();
    const { integration_id } = body;

    if (!integration_id) {
      return new Response(JSON.stringify({ error: 'integration_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for authorization checks
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create Supabase client with user JWT for authentication
    const supabaseUser = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify the user's JWT and get their auth ID
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed: %s', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the integration and encrypted bot token
    const { data: integration, error: fetchError } = await supabaseAdmin
      .from('slack_integrations')
      .select('bot_token_encrypted, workspace_id')
      .eq('id', integration_id)
      .single();

    if (fetchError || !integration) {
      console.error('Failed to fetch integration: %s', fetchError?.message);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this workspace
    // Join through app_users to match auth.uid() with app_users.auth_user_id
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select(`
        id,
        user:app_users!inner(auth_user_id)
      `)
      .eq('workspace_id', integration.workspace_id)
      .eq('app_users.auth_user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error(
        'Workspace membership check failed: %s',
        membershipError?.message || 'User not a member'
      );
      return new Response(
        JSON.stringify({ error: 'Access denied: not a member of this workspace' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Decrypt the bot token
    let botToken: string;
    try {
      botToken = await decryptString(integration.bot_token_encrypted);
    } catch (decryptError) {
      console.error('Failed to decrypt bot token: %s', decryptError);
      return new Response(JSON.stringify({ error: 'Failed to decrypt bot token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch channels from Slack API with pagination
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL('https://slack.com/api/conversations.list');
      url.searchParams.set('types', 'public_channel,private_channel');
      url.searchParams.set('limit', '200');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.ok) {
        console.error('Slack API error: %s', data.error);
        return new Response(
          JSON.stringify({ error: data.error || 'Failed to fetch channels from Slack' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Add channels from this page
      if (data.channels) {
        channels.push(
          ...data.channels.map((ch: {
            id: string;
            name: string;
            is_private: boolean;
            is_member: boolean;
          }) => ({
            id: ch.id,
            name: ch.name,
            is_private: ch.is_private,
            is_member: ch.is_member,
          }))
        );
      }

      // Check if there are more pages
      cursor = data.response_metadata?.next_cursor;
      hasMore = !!cursor;
    }

    return new Response(JSON.stringify({ channels }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List channels error: %s', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
