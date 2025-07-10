import { createClient } from '@supabase/supabase-js';
import { clientEnv } from './env';

// Helper function to create the Supabase client
export function createSupabaseClient() {
  // Use secure environment access
  const supabaseUrl = clientEnv.SUPABASE_URL;
  const supabaseAnonKey = clientEnv.SUPABASE_ANON_KEY;
  
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
