import { Handler } from '@netlify/functions';
import { trackServerEvent, captureServerException } from './lib/server-tracking.mts';
import {
  getUnkeyClient,
  getUnkeyApiId,
  getSupabaseClients,
  API_KEY_CORS_HEADERS,
  API_KEY_VALIDATION,
  hasUnkeyConfig,
  hasSupabaseConfig,
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
    const supabaseConfig = hasSupabaseConfig();

    if (!unkeyConfig.hasRootKey || !unkeyConfig.hasApiId) {
      console.error('Missing Unkey configuration');
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'API key service not configured' }),
      };
    }

    if (!supabaseConfig.hasUrl || !supabaseConfig.hasServiceKey || !supabaseConfig.hasAnonKey) {
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
    const UNKEY_API_ID = getUnkeyApiId();

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

    // Input validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Key name is required' }),
      };
    }

    const trimmedName = name.trim();
    if (trimmedName.length > API_KEY_VALIDATION.MAX_KEY_NAME_LENGTH) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Key name too long (max ${API_KEY_VALIDATION.MAX_KEY_NAME_LENGTH} characters)`,
        }),
      };
    }

    if (!API_KEY_VALIDATION.VALID_NAME_PATTERN.test(trimmedName)) {
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
    if (expiresInDays !== undefined && expiresInDays !== null) {
      if (typeof expiresInDays !== 'number' || expiresInDays <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Expiry days must be a positive number' }),
        };
      }
      if (expiresInDays > API_KEY_VALIDATION.MAX_EXPIRY_DAYS) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: `Expiry cannot exceed ${API_KEY_VALIDATION.MAX_EXPIRY_DAYS} days`,
          }),
        };
      }
      expires = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    }

    // Check if user has reached the maximum number of API keys
    const { count, error: countError } = await supabaseAdmin
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('revoked_at', null);

    if (countError) {
      console.error('Database error counting user keys: %s', JSON.stringify(countError));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to verify key limit' }),
      };
    }

    if (count !== null && count >= API_KEY_VALIDATION.MAX_KEYS_PER_USER) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: `Maximum number of API keys reached (${API_KEY_VALIDATION.MAX_KEYS_PER_USER})`,
          limit: API_KEY_VALIDATION.MAX_KEYS_PER_USER,
          current: count,
        }),
      };
    }

    // Create key with Unkey
    // Note: We intentionally omit email from metadata to avoid transmitting PII to third parties
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

    const { keyId, key } = createResult.result;

    // Extract prefix and last 4 characters for display
    const keyParts = key.split('_');
    const prefix = keyParts.length >= 2 ? `${keyParts[0]}_${keyParts[1]}` : key.substring(0, 7);
    const lastFour = key.slice(-4);

    // Store key metadata in Supabase
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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to store API key metadata',
          code: dbError.code,
        }),
      };
    }

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
