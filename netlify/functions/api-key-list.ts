import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization helper - env vars are read at runtime
function getSupabaseAnon() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
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
    // Initialize client lazily
    const supabaseAnon = getSupabaseAnon();

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

    // Fetch user's API keys from Supabase using RLS
    const { data: keys, error: dbError } = await supabaseAnon
      .from('api_keys')
      .select(
        'id, unkey_key_id, name, prefix, last_four, created_at, last_used_at, revoked_at, expires_at'
      )
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Database error fetching keys:', dbError);
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
    console.error('Error listing API keys:', error);

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
