import { Handler } from '@netlify/functions';
import { Unkey } from '@unkey/api';
import { createClient } from '@supabase/supabase-js';
import { trackServerEvent, captureServerException } from './lib/server-tracking.mts';

// Initialize Unkey client
const unkey = new Unkey({
  rootKey: process.env.UNKEY_ROOT_KEY || '',
});

// Initialize Supabase clients
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verify user authentication
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { keyId } = body;

    if (!keyId || typeof keyId !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Key ID is required' }),
      };
    }

    // Verify ownership of the key using Admin client
    const { data: keyRecord, error: dbError } = await supabaseAdmin
      .from('api_keys')
      .select('id, unkey_key_id, name')
      .eq('unkey_key_id', keyId)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .maybeSingle();

    if (dbError) {
      console.error('Database error verifying key ownership:', dbError);
      throw new Error('Internal database error');
    }

    if (!keyRecord) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'API key not found' }),
      };
    }

    // Revoke the key in Unkey
    const deleteResult = await unkey.keys.delete({ keyId });

    if (deleteResult.error) {
      console.error('Unkey delete error:', deleteResult.error);
      // Continue to mark as revoked in our database even if Unkey fails
      // The key may have already been deleted in Unkey
    }

    // Mark as revoked in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyRecord.id);

    if (updateError) {
      console.error('Database error marking key as revoked:', updateError);
      throw new Error('Failed to revoke key');
    }

    await trackServerEvent(
      'api_key_revoked',
      {
        key_name: keyRecord.name,
      },
      user.id
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'API key revoked successfully',
      }),
    };
  } catch (error) {
    console.error('Error revoking API key:', error);

    await captureServerException(error instanceof Error ? error : new Error(String(error)), {
      level: 'error',
      tags: { type: 'api_key_revoke_failed' },
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to revoke API key',
        details: 'An unexpected error occurred while processing your request',
      }),
    };
  }
};
