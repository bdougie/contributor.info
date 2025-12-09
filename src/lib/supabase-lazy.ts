/**
 * Lazy Supabase Client
 *
 * Provides async access to the Supabase client for code that can defer initialization.
 * This module shares the same client instance with supabase.ts to avoid duplicate clients.
 *
 * Usage:
 * - Use `getSupabase()` for async access (recommended for new code)
 * - Use `getSupabaseSync()` for sync access after initialization
 * - Use `isSupabaseInitialized()` to check if client is ready
 *
 * @see https://github.com/open-sauced/contributor.info/issues/1278
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Cached instance - shared with supabase.ts
let supabaseInstance: SupabaseClient | null = null;

/**
 * Set the shared Supabase instance.
 * Called by supabase.ts to share its synchronously-created client.
 */
export function setSupabaseInstance(client: SupabaseClient): void {
  supabaseInstance = client;
}

/**
 * Async getter for Supabase client.
 * Returns the shared instance immediately if already initialized by supabase.ts.
 * Otherwise loads lazily (for code paths that don't import supabase.ts).
 */
export async function getSupabase(): Promise<SupabaseClient> {
  // Return shared instance if already initialized
  if (supabaseInstance) return supabaseInstance;

  // Lazy load for code paths that only import supabase-lazy.ts
  const { supabase } = await import('./supabase');
  return supabase;
}

/**
 * Sync getter for Supabase client.
 * Returns the cached instance if already initialized.
 * Throws if called before initialization.
 */
export function getSupabaseSync(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error('[Supabase] Client not initialized. Use getSupabase() for async access.');
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
 * Preload the Supabase client without blocking.
 */
export function preloadSupabase(): void {
  if (!supabaseInstance) {
    getSupabase().catch(() => {
      // Silently handle preload errors
    });
  }
}
