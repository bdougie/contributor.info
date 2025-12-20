/**
 * Slack List Channels Handler for User Integrations
 *
 * Fetches the list of channels the bot has access to for user-level integrations.
 * Verifies that the requesting user owns the integration.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptString } from '../_shared/encryption.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface RequestBody {
  integration_id: string;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body: RequestBody = await req.json();
    const { integration_id } = body;

    if (!integration_id) {
      return new Response(
        JSON.stringify({ error: 'integration_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify user authentication
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the integration and verify ownership
    const { data: integration, error: fetchError } = await supabase
      .from('user_slack_integrations')
      .select('bot_token_encrypted, user_id')
      .eq('id', integration_id)
      .single();

    if (fetchError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify user owns this integration
    if (integration.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Decrypt the bot token
    let botToken: string;
    try {
      botToken = await decryptString(integration.bot_token_encrypted);
    } catch (decryptError) {
      console.error('Failed to decrypt bot token: %s', decryptError);
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt bot token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

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
          })),
        );
      }

      cursor = data.response_metadata?.next_cursor;
      hasMore = !!cursor;
    }

    return new Response(
      JSON.stringify({ channels }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('List channels error: %s', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
