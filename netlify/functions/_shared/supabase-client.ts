/**
 * Shared Supabase Client with Connection Pooling
 *
 * This module provides a singleton Supabase client instance that is reused
 * across function invocations to improve performance and reduce connection overhead.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache the client instance
let supabaseClient: SupabaseClient | null = null;
let lastInitTime = 0;
const CLIENT_REFRESH_INTERVAL = 1000 * 60 * 30; // Refresh every 30 minutes

/**
 * Get or create a Supabase client instance
 *
 * This function implements connection pooling by:
 * 1. Reusing the same client instance across invocations
 * 2. Refreshing the client periodically to prevent stale connections
 * 3. Handling client initialization errors gracefully
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  const now = Date.now();

  // Create new client if:
  // 1. No client exists
  // 2. Client is older than refresh interval
  // 3. Configuration has changed
  if (!supabaseClient || now - lastInitTime > CLIENT_REFRESH_INTERVAL) {
    console.log('Creating new Supabase client instance');

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        // Connection pool settings
        headers: {
          'x-connection-pool': 'netlify-functions',
        },
      },
      db: {
        schema: 'public',
      },
    });

    lastInitTime = now;
  }

  return supabaseClient;
}

/**
 * Force refresh the Supabase client
 * Useful when connection issues are detected
 */
export function refreshSupabaseClient(): void {
  console.log('Force refreshing Supabase client');
  supabaseClient = null;
  lastInitTime = 0;
}

/**
 * Test the Supabase connection
 * Returns true if connection is healthy
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('background_jobs').select('id').limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
}

/**
 * Execute a query with automatic retry and client refresh
 */
export async function executeWithRetry<T>(
  queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: unknown }>
): Promise<{ data: T | null; error: unknown }> {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const client = getSupabaseClient();
      const result = await queryFn(client);

      // If successful or non-connection error, return
      if (!result.error || !isConnectionError(result.error)) {
        return result;
      }

      // On connection error, refresh client and retry
      if (attempts < maxAttempts) {
        console.log(`Connection error, refreshing client (attempt ${attempts}/${maxAttempts})`);
        refreshSupabaseClient();
      }
    } catch (error) {
      if (attempts === maxAttempts) {
        return { data: null, error };
      }
      refreshSupabaseClient();
    }
  }

  return { data: null, error: new Error('Max retry attempts reached') };
}

/**
 * Check if an error is a connection-related error
 */
function isConnectionError(error: unknown): boolean {
  const connectionErrorMessages = [
    'connection',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'network',
    'socket',
  ];

  const errorMessage = (error as { message?: string })?.message?.toLowerCase() || '';
  return connectionErrorMessages.some((msg) => errorMessage.includes(msg));
}
