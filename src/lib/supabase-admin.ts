import { createClient } from '@supabase/supabase-js';
import { env, serverEnv } from './env';

/**
 * Creates a Supabase client with service role key for admin operations
 * This should only be used in server-side code (Netlify functions, Inngest functions)
 * NEVER expose this to the browser!
 */
export function createSupabaseAdmin() {
  const supabaseUrl = env.SUPABASE_URL;
  // Check for SUPABASE_TOKEN (Netlify) or SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleKey = serverEnv.SUPABASE_TOKEN || serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL');
  }
  
  if (!serviceRoleKey) {
    // Fall back to anon key if service key not available
    console.warn('Service role key not found, falling back to anon key');
    const anonKey = env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('Missing both service role key and SUPABASE_ANON_KEY');
    }
    return createClient(supabaseUrl, anonKey);
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

// Only create the admin client in server-side environments
export const supabaseAdmin = typeof window === 'undefined' 
  ? createSupabaseAdmin() 
  : null;