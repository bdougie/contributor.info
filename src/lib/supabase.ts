import { createClient } from '@supabase/supabase-js';

// Helper function to create the Supabase client
export function createSupabaseClient() {
  // Check required environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('Supabase Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'Missing');
  
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
        detectSessionInUrl: false, // Disable automatic detection since we're handling manually
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
  console.log('Current session:', data.session);
  console.log('Session error:', error);
  return { session: data.session, error };
};
