/**
 * Supabase Client - Backwards Compatible Shim
 *
 * This file now re-exports from supabase-lazy.ts to enable deferred loading
 * while maintaining backwards compatibility with existing imports.
 *
 * The Supabase bundle (~111 KiB) loads asynchronously via dynamic import,
 * improving LCP by not blocking initial render.
 *
 * @see https://github.com/open-sauced/contributor.info/issues/1278
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseSync, isSupabaseInitialized, ensureSupabase } from './supabase-lazy';
import { safeGetSession } from './auth/safe-auth';

// Start loading Supabase immediately (but bundle loads async via dynamic import)
// This ensures the client is ready by the time user interactions occur
const clientPromise = ensureSupabase();

/**
 * @deprecated Use getSupabase() from supabase-lazy.ts for new code
 * Kept for backwards compatibility with existing code
 */
export function createSupabaseClient(): SupabaseClient {
  if (isSupabaseInitialized()) {
    return getSupabaseSync();
  }
  throw new Error('Supabase not initialized yet. Use getSupabase() for async access.');
}

/**
 * Backwards-compatible Supabase client export.
 *
 * Uses a Proxy to forward all property access to the lazy-loaded client.
 * This allows existing code like `supabase.from('table')` to continue working.
 *
 * Note: Access before initialization will throw. In practice this rarely happens
 * since most Supabase calls occur in event handlers or useEffect, not at module load.
 *
 * @deprecated For new code, use getSupabase() from supabase-lazy.ts
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    if (!isSupabaseInitialized()) {
      throw new Error(
        `Supabase accessed before initialization (property: ${String(prop)}). ` +
          'The client is loading asynchronously. Use getSupabase() for async access.'
      );
    }
    const client = getSupabaseSync();
    const value = client[prop as keyof SupabaseClient];
    // Bind methods to preserve `this` context
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

// Helper to debug authentication issues with timeout protection
export const debugAuthSession = async () => {
  const { session, error } = await safeGetSession();
  return { session, error };
};

// Re-export lazy functions for gradual migration to async pattern
export { getSupabase, ensureSupabase, isSupabaseInitialized } from './supabase-lazy';

// Export the initialization promise for code that needs to wait
export { clientPromise as supabaseReady };
