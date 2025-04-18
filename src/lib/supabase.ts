import { createClient } from '@supabase/supabase-js';

// Helper function to create the Supabase client
export function createSupabaseClient() {
  // Check required environment variables
  if (!import.meta.env.VITE_SUPABASE_URL) {
    throw new Error('Missing environment variable: VITE_SUPABASE_URL');
  }

  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
  }

  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );
}

// Export the Supabase client instance
export const supabase = createSupabaseClient();