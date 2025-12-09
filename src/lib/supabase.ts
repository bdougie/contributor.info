/**
 * Supabase Client - Synchronous Export
 *
 * This file provides the synchronous Supabase client for backwards compatibility.
 * For new code that benefits from deferred loading, use getSupabase() from supabase-lazy.ts.
 *
 * @see https://github.com/open-sauced/contributor.info/issues/1278
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { setSupabaseInstance } from './supabase-lazy';

// Create Supabase client synchronously for backwards compatibility
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing environment variable: SUPABASE_URL or VITE_SUPABASE_URL. In production, ensure SUPABASE_URL is set in Netlify environment variables.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing environment variable: SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY. In production, ensure SUPABASE_ANON_KEY is set in Netlify environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

/**
 * Synchronous Supabase client instance.
 * For new code, consider using getSupabase() from supabase-lazy.ts for deferred loading.
 */
export const supabase = createSupabaseClient();

// Share the instance with supabase-lazy.ts to avoid duplicate clients
setSupabaseInstance(supabase);

// Re-export lazy functions for code that wants deferred loading
export { getSupabase, isSupabaseInitialized } from './supabase-lazy';

// Export createClient function for backwards compatibility
export { createSupabaseClient };
