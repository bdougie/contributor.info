/**
 * Supabase client for server-side Inngest functions
 * Uses service role key to bypass RLS
 */
import { supabaseAdmin } from '../supabase-admin';

if (!supabaseAdmin) {
  throw new Error('Supabase admin client not available in server environment');
}

export const supabase = supabaseAdmin;
