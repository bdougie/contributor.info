// Database helpers for Inngest Edge Functions
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

// Helper function to ensure contributors exist and return their UUIDs
export interface GitHubUser {
  databaseId?: number;
  login?: string;
  avatarUrl?: string;
  __typename?: string;
  name?: string;
  email?: string;
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  following?: number;
  createdAt?: string;
}

export async function ensureContributorExists(githubUser: GitHubUser): Promise<string | null> {
  if (!githubUser || !githubUser.databaseId) {
    console.warn('Missing github user data or databaseId');
    return null;
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: githubUser.databaseId.toString(),
        username: githubUser.login,
        display_name: githubUser.name || null,
        email: githubUser.email || null,
        avatar_url: githubUser.avatarUrl || null,
        profile_url: `https://github.com/${githubUser.login}`,
        bio: githubUser.bio || null,
        company: githubUser.company || null,
        location: githubUser.location || null,
        blog: githubUser.blog || null,
        public_repos: githubUser.public_repos || 0,
        public_gists: githubUser.public_gists || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        github_created_at: githubUser.createdAt || new Date().toISOString(),
        is_bot: githubUser.__typename === 'Bot',
        is_active: true,
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single();

  if (error) {
    console.error(
      'Error upserting contributor %s (ID: %s): %s',
      githubUser.login,
      githubUser.databaseId,
      error.message
    );
    throw new Error(`Failed to upsert contributor ${githubUser.login}: ${error.message}`);
  }

  if (!data) {
    console.error('No data returned after upserting contributor %s', githubUser.login);
    throw new Error(`No data returned for contributor ${githubUser.login}`);
  }

  return data.id;
}

// Helper to map PR state
export function getPRState(pr: any): string {
  if (pr.state?.toLowerCase() === 'open') {
    return 'open';
  }
  if (pr.merged) {
    return 'merged';
  }
  return 'closed';
}

// Sync rate limiting constants (in hours)
export const SYNC_RATE_LIMITS = {
  DEFAULT: 12,        // Default for GraphQL sync
  SCHEDULED: 2,       // Scheduled syncs
  PR_ACTIVITY: 1,     // PR activity updates
  MANUAL: 5 / 60,     // 5-minute cooldown for manual syncs (0.083 hours)
  AUTO_FIX: 1,        // Hourly auto-fix syncs for corrupted data
} as const;

// Queue configuration
export const QUEUE_CONFIG = {
  maxPrsPerSync: 150, // Higher limit for GraphQL due to efficiency
  largeRepoThreshold: 1000,
  defaultDaysLimit: 30,
  maxDetailJobs: 50, // Higher than REST due to single-query efficiency
} as const;