import { Handler } from '@netlify/functions';
import { Unkey } from '@unkey/api';
import { createClient } from '@supabase/supabase-js';
import { trackServerEvent, captureServerException } from './lib/server-tracking.mts';

// Lazy initialization helpers - env vars are read at runtime
function getUnkeyClient() {
  return new Unkey({
    rootKey: process.env.UNKEY_ROOT_KEY || '',
  });
}

function getSupabaseClients() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  return {
    admin: createClient(supabaseUrl, supabaseServiceKey),
    anon: createClient(supabaseUrl, supabaseAnonKey),
  };
}

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
    // Verify required environment variables
    const hasUnkeyRootKey = !!process.env.UNKEY_ROOT_KEY;
    const hasUnkeyApiId = !!process.env.UNKEY_API_ID;
    const hasSupabaseUrl = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const hasServiceKey = !!(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );
    const hasAnonKey = !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

    console.log('Environment check:', {
      hasUnkeyRootKey,
      hasUnkeyApiId,
      hasSupabaseUrl,
      hasServiceKey,
      hasAnonKey,
    });

    if (!hasUnkeyRootKey || !hasUnkeyApiId) {
      console.error('Missing Unkey configuration');
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'API key service not configured' }),
      };
    }

    if (!hasSupabaseUrl || !hasServiceKey || !hasAnonKey) {
      console.error('Missing Supabase configuration');
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Database service not configured' }),
      };
    }

    // Initialize clients lazily
    const unkey = getUnkeyClient();
    const { admin: supabaseAdmin, anon: supabaseAnon } = getSupabaseClients();
    const UNKEY_API_ID = process.env.UNKEY_API_ID || '';

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
    let body: { name?: unknown; expiresInDays?: unknown };
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body' }),
      };
    }
    const { name, expiresInDays } = body;

    // Input validation constants
    const MAX_KEY_NAME_LENGTH = 100;
    const VALID_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.]+$/;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Key name is required' }),
      };
    }

    const trimmedName = name.trim();
    if (trimmedName.length > MAX_KEY_NAME_LENGTH) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Key name too long (max 100 characters)' }),
      };
    }

    if (!VALID_NAME_PATTERN.test(trimmedName)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error:
            'Key name contains invalid characters. Use only letters, numbers, spaces, hyphens, underscores, and periods.',
        }),
      };
    }

    // Calculate expiration if provided
    let expires: number | undefined;
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      expires = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    }

    // Create key with Unkey
    console.log('Creating key with Unkey, apiId: %s', UNKEY_API_ID);
    const createResult = await unkey.keys.create({
      apiId: UNKEY_API_ID,
      prefix: 'ck_live',
      ownerId: user.id,
      name: trimmedName,
      expires,
      meta: {
        userId: user.id,
        createdAt: new Date().toISOString(),
      },
      ratelimit: {
        type: 'consistent',
        limit: 100,
        refillRate: 100,
        refillInterval: 60000, // 1 minute
      },
    });

    if (createResult.error) {
      console.error('Unkey create error: %s', JSON.stringify(createResult.error));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to create API key with provider',
          code: createResult.error.code,
        }),
      };
    }
    console.log('Unkey key created successfully, keyId: %s', createResult.result.keyId);

    const { keyId, key } = createResult.result;

    // Extract prefix and last 4 characters for display
    const keyParts = key.split('_');
    const prefix = keyParts.length >= 2 ? `${keyParts[0]}_${keyParts[1]}` : key.substring(0, 7);
    const lastFour = key.slice(-4);

    // Store key metadata in Supabase
    console.log('Storing key metadata in database for user: %s', user.id);
    const { error: dbError } = await supabaseAdmin.from('api_keys').insert({
      user_id: user.id,
      unkey_key_id: keyId,
      name: trimmedName,
      prefix,
      last_four: lastFour,
      expires_at: expires ? new Date(expires).toISOString() : null,
    });

    if (dbError) {
      console.error('Database error storing key metadata: %s', JSON.stringify(dbError));
      // Try to delete the key from Unkey since we couldn't store it
      const deleteResult = await unkey.keys.delete({ keyId });
      if (deleteResult.error) {
        console.error(
          'Failed to cleanup Unkey key after db error (orphaned key): %s keyId: %s',
          JSON.stringify(deleteResult.error),
          keyId
        );
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to store API key metadata and cleanup failed',
            code: dbError.code,
            orphanedKeyId: keyId,
          }),
        };
      }
      console.log('Successfully cleaned up Unkey key after db error: %s', keyId);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to store API key metadata',
          code: dbError.code,
        }),
      };
    }
    console.log('Key metadata stored successfully');

    await trackServerEvent(
      'api_key_created',
      {
        key_name: trimmedName,
        has_expiry: !!expires,
      },
      user.id
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        keyId,
        key, // Only returned once on creation
        name: trimmedName,
        prefix,
        lastFour,
        expiresAt: expires ? new Date(expires).toISOString() : null,
      }),
    };
  } catch (error) {
    console.error(
      'Error creating API key: %s',
      error instanceof Error ? error.message : String(error)
    );

    await captureServerException(error instanceof Error ? error : new Error(String(error)), {
      level: 'error',
      tags: { type: 'api_key_create_failed' },
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create API key',
        details: 'An unexpected error occurred while processing your request',
      }),
    };
  }
};
