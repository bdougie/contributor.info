import { createClient } from '@supabase/supabase-js';
import { env } from './env.ts';
import { safeGetSession } from './auth/safe-auth';

// Helper function to create the Supabase client
// CACHE BUST: Fixed 406 errors by removing .single() calls - v2
export function createSupabaseClient() {
  // Use universal environment access (works in both browser and server)
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
      detectSessionInUrl: true, // Enable automatic session detection for OAuth redirects
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

// Export the Supabase client instance
export const supabase = createSupabaseClient();

// Helper to debug authentication issues with timeout protection
export const debugAuthSession = async () => {
  const { session, error } = await safeGetSession();
  return { session, error };
};
