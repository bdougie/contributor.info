/**
 * Server-side Supabase client for SSR loaders
 *
 * This creates a fresh Supabase client for each request, avoiding
 * any browser-specific configurations like session persistence.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-side env access
function getServerEnv(key: string): string {
  if (typeof process !== 'undefined' && process.env) {
    // Try VITE_ prefixed first (for consistency), then non-prefixed
    return process.env[`VITE_${key}`] || process.env[key] || '';
  }
  return '';
}

let serverSupabaseClient: SupabaseClient | null = null;

/**
 * Get or create a server-side Supabase client
 * Uses the anon key for public data fetching
 */
export function getServerSupabase(): SupabaseClient {
  if (serverSupabaseClient) {
    return serverSupabaseClient;
  }

  const supabaseUrl = getServerEnv('SUPABASE_URL');
  const supabaseAnonKey = getServerEnv('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables for SSR');
  }

  serverSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Disable session persistence on server
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
  });

  return serverSupabaseClient;
}

/**
 * Fetch basic repository info for SSR
 */
export async function fetchRepositoryBasics(owner: string, repo: string) {
  const supabase = getServerSupabase();
  const fullName = `${owner}/${repo}`;

  // Fetch basic repository data
  const { data: repository } = await supabase
    .from('tracked_repositories')
    .select('id, full_name, owner, name, description, stars, language, created_at')
    .eq('full_name', fullName)
    .maybeSingle();

  return { repository };
}

/**
 * Fetch trending repositories for SSR
 */
export async function fetchTrendingRepositories(limit = 50) {
  const supabase = getServerSupabase();

  const { data: repositories } = await supabase
    .from('trending_repositories')
    .select('*')
    .order('trending_score', { ascending: false })
    .limit(limit);

  return { repositories: repositories || [] };
}
