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

// Cached client instance - created lazily on first access
let _supabaseInstance: SupabaseClient | null = null;

// Create Supabase client - called lazily, not at module initialization
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
 * Get the Supabase client instance (lazy initialization).
 * This defers client creation until first use, allowing the module to be
 * imported during bundling without throwing due to missing env vars.
 */
function getSupabaseInstance(): SupabaseClient {
  if (!_supabaseInstance) {
    _supabaseInstance = createSupabaseClient();
    // Share the instance with supabase-lazy.ts to avoid duplicate clients
    setSupabaseInstance(_supabaseInstance);
  }
  return _supabaseInstance;
}

/**
 * Synchronous Supabase client instance.
 * Uses a getter to defer initialization until first access, preventing
 * errors during edge function bundling when env vars aren't available.
 * For new code, consider using getSupabase() from supabase-lazy.ts for deferred loading.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getSupabaseInstance();
    const value = instance[prop as keyof SupabaseClient];
    // Bind methods to the instance to preserve 'this' context
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// Re-export lazy functions for code that wants deferred loading
export { getSupabase, isSupabaseInitialized } from './supabase-lazy';

// Export createClient function for backwards compatibility
export { createSupabaseClient };
