import { Handler } from '@netlify/functions';
import {
  getSupabaseWithAuth,
  API_KEY_CORS_HEADERS,
  API_KEY_VALIDATION,
} from './lib/api-key-clients';

export const handler: Handler = async (event) => {
  const headers = {
    ...API_KEY_CORS_HEADERS,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verify auth header exists
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    // Create client with auth header for RLS to work
    const supabase = getSupabaseWithAuth(authHeader);

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Fetch user's API keys from Supabase using RLS with pagination
    const { data: keys, error: dbError } = await supabase
      .from('api_keys')
      .select(
        'id, unkey_key_id, name, prefix, last_four, created_at, last_used_at, revoked_at, expires_at'
      )
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(API_KEY_VALIDATION.MAX_KEYS_PER_USER);

    if (dbError) {
      console.error('Database error fetching keys: %s', JSON.stringify(dbError));
      throw new Error('Failed to fetch API keys');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        keys: keys.map((key) => ({
          id: key.id,
          keyId: key.unkey_key_id,
          name: key.name,
          prefix: key.prefix,
          lastFour: key.last_four,
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
          expiresAt: key.expires_at,
        })),
      }),
    };
  } catch (error) {
    console.error(
      'Error listing API keys: %s',
      error instanceof Error ? error.message : String(error)
    );

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to list API keys',
        details: 'An unexpected error occurred while processing your request',
      }),
    };
  }
};
