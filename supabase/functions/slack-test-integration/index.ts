/**
 * Slack Test Integration Edge Function
 * Tests a Slack integration by sending a test message
 *
 * Security: Verifies user has access to the workspace before testing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('SLACK_WEBHOOK_ENCRYPTION_KEY')!;
const SLACK_API_BASE = 'https://slack.com/api';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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
    ['deriveBits', 'deriveKey']
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
    ['decrypt']
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

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { integration_id } = await req.json();

    if (!integration_id) {
      return new Response(JSON.stringify({ error: 'integration_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create Supabase user client with user JWT for authentication
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

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

    // Fetch integration
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('slack_integrations')
      .select('bot_token_encrypted, channel_id, channel_name, schedule, workspace_id')
      .eq('id', integration_id)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('Failed to fetch integration: %s', integrationError?.message);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the app_users record for this authenticated user
    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (appUserError || !appUser) {
      console.error('Failed to find app_users record: %s', appUserError?.message);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', integration.workspace_id)
      .eq('user_id', appUser.id)
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

    // Verify integration has required OAuth fields
    if (!integration.bot_token_encrypted || !integration.channel_id) {
      return new Response(
        JSON.stringify({ error: 'Integration is missing required OAuth configuration' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Decrypt bot token
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

    // Create test message
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🧪 Test Message',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a test message to verify your Slack integration is working correctly.',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Channel:*\n${integration.channel_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Schedule:*\n${integration.schedule}`,
          },
        ],
      },
    ];

    // Post message to Slack
    const slackResponse = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: integration.channel_id,
        text: 'Test message from Contributor.info',
        blocks,
      }),
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      console.error('Slack API error: %s', slackData.error);

      // Log failure
      await supabaseAdmin.from('integration_logs').insert({
        integration_id,
        workspace_id: integration.workspace_id,
        status: 'failure',
        message_sent: JSON.stringify({ text: 'Test message', blocks }),
        error_message: slackData.error || 'Unknown Slack API error',
        metadata: { type: 'test', method: 'oauth' },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Slack API error: ${slackData.error}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log success
    await supabaseAdmin.from('integration_logs').insert({
      integration_id,
      workspace_id: integration.workspace_id,
      status: 'success',
      message_sent: JSON.stringify({ text: 'Test message', blocks }),
      error_message: null,
      metadata: { type: 'test', method: 'oauth' },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test message sent successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error: %s', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
