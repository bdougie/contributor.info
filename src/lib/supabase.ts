import { createClient } from '@supabase/supabase-js';

import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } from './env';

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
        detectSessionInUrl: false, // Manual session handling prevents 401 errors with OAuth redirect tokens
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
