import { Handler } from '@netlify/functions';
import { trackServerEvent, captureServerException } from './lib/server-tracking.mts';
import {
  getUnkeyClient,
  getSupabaseClients,
  API_KEY_CORS_HEADERS,
  hasUnkeyConfig,
} from './lib/api-key-clients';

export const handler: Handler = async (event) => {
  const headers = {
    ...API_KEY_CORS_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    // Verify required environment variables
    const unkeyConfig = hasUnkeyConfig();
    if (!unkeyConfig.hasRootKey) {
      console.error('Missing Unkey configuration');
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'API key service not configured' }),
      };
    }

    // Initialize clients lazily
    const unkey = getUnkeyClient();
    const { admin: supabaseAdmin, anon: supabaseAnon } = getSupabaseClients();

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

    // Parse request body with error handling
    let body: { keyId?: unknown };
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body' }),
      };
    }
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
      console.error('Database error verifying key ownership: %s', JSON.stringify(dbError));
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
      console.error('Unkey delete error: %s', JSON.stringify(deleteResult.error));
      // Continue to mark as revoked in our database even if Unkey fails
      // The key may have already been deleted in Unkey
    }

    // Mark as revoked in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyRecord.id);

    if (updateError) {
      console.error('Database error marking key as revoked: %s', JSON.stringify(updateError));
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
    console.error(
      'Error revoking API key: %s',
      error instanceof Error ? error.message : String(error)
    );

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
