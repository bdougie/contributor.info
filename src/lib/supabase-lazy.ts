/**
 * Lazy Supabase Client
 *
 * Defers Supabase client initialization until first use to improve LCP.
 * The Supabase bundle is ~111 KiB and doesn't need to load on initial page render.
 *
 * Usage:
 * - Use `getSupabase()` for async access (recommended for new code)
 * - Use `getSupabaseSync()` for sync access after initialization
 * - Use `ensureSupabase()` to guarantee client is ready before sync access
 *
 * @see https://github.com/open-sauced/contributor.info/issues/1278
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Cached instance
let supabaseInstance: SupabaseClient | null = null;
let loadPromise: Promise<SupabaseClient> | null = null;
let initStartTime: number | null = null;

/**
 * Async getter for Supabase client.
 * Lazily loads the @supabase/supabase-js bundle on first call.
 * Subsequent calls return the cached instance immediately.
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) return supabaseInstance;

  if (!loadPromise) {
    initStartTime = performance.now();
    loadPromise = import('@supabase/supabase-js').then(({ createClient }) => {
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

      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
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

      // Log initialization timing in development
      if (import.meta.env.DEV && initStartTime) {
        const elapsed = performance.now() - initStartTime;

        console.log(`[Supabase] Lazy initialization completed in ${elapsed.toFixed(1)}ms`);
      }

      return supabaseInstance;
    });
  }

  return loadPromise;
}

/**
 * Sync getter for Supabase client.
 * Returns the cached instance if already initialized.
 * Throws if called before ensureSupabase() completes.
 */
export function getSupabaseSync(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error(
      '[Supabase] Client not initialized. Call ensureSupabase() first or use getSupabase() for async access.'
    );
  }
  return supabaseInstance;
}

/**
 * Check if Supabase client has been initialized.
 */
export function isSupabaseInitialized(): boolean {
  return supabaseInstance !== null;
}

/**
 * Ensure Supabase is initialized before proceeding.
 * Call this once in your app entry point to enable sync access.
 */
export async function ensureSupabase(): Promise<SupabaseClient> {
  return getSupabase();
}

/**
 * Preload the Supabase client without blocking.
 * Call this when you know Supabase will be needed soon (e.g., on user interaction).
 */
export function preloadSupabase(): void {
  if (!supabaseInstance && !loadPromise) {
    getSupabase().catch(() => {
      // Silently handle preload errors - actual errors will surface on real usage
    });
  }
}
