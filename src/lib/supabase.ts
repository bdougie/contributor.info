import { createClient } from '@supabase/supabase-js';

// Environment variables - direct access (with type assertion for build compatibility)
const VITE_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Helper function to create the Supabase client
export function createSupabaseClient() {
  // Check required environment variables
  const supabaseUrl = VITE_SUPABASE_URL;
  const supabaseAnonKey = VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('Missing environment variable: VITE_SUPABASE_URL');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
  }
  
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Enable automatic session detection for OAuth redirects
        flowType: 'implicit'
      }
    }
  );
}

// Export the Supabase client instance
export const supabase = createSupabaseClient();

// Helper to debug authentication issues
export const debugAuthSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};
