/**
 * Supabase client for Netlify Edge Functions
 *
 * Creates a lightweight Supabase client for server-side data fetching.
 * Uses the anon key for public data access (respects RLS policies).
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create a Supabase client for edge functions
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey =
    Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

/**
 * Repository data structure for SSR
 */
export interface RepoData {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stargazer_count: number;
  fork_count: number;
  language: string | null;
  topics: string[] | null;
  contributor_count?: number;
  pr_count?: number;
  updated_at: string;
}

/**
 * Trending repository with score
 */
export interface TrendingRepo extends RepoData {
  score: number;
  recent_prs: number;
  recent_contributors: number;
}

/**
 * Fetch a single repository by owner/name
 */
export async function fetchRepository(owner: string, repo: string): Promise<RepoData | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('repositories')
    .select(
      `
      id,
      owner,
      name,
      full_name,
      description,
      stargazer_count,
      fork_count,
      language,
      topics,
      updated_at
    `
    )
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle();

  if (error || !data) {
    console.error('[ssr] Repository not found: %s/%s', owner, repo);
    return null;
  }

  return data as RepoData;
}

/**
 * Fetch trending repositories
 */
export async function fetchTrendingRepos(limit = 20): Promise<TrendingRepo[]> {
  const supabase = getSupabaseClient();

  // Get repos with recent activity, ordered by a combination of stars and recent PRs
  const { data, error } = await supabase
    .from('repositories')
    .select(
      `
      id,
      owner,
      name,
      full_name,
      description,
      stargazer_count,
      fork_count,
      language,
      topics,
      updated_at
    `
    )
    .order('stargazer_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ssr] Failed to fetch trending repos:', error);
    return [];
  }

  // Add score calculation (simplified for edge function performance)
  return (data || []).map((repo) => ({
    ...repo,
    score: repo.stargazer_count + repo.fork_count * 2,
    recent_prs: 0, // Would need additional query
    recent_contributors: 0, // Would need additional query
  })) as TrendingRepo[];
}

/**
 * Cache for home page stats to reduce database queries and improve TTFB
 */
interface StatsCache {
  data: { totalRepos: number; totalContributors: number; totalPRs: number };
  timestamp: number;
}

let statsCache: StatsCache | null = null;
const STATS_CACHE_TTL_MS = 60 * 1000; // 60 seconds cache TTL

/**
 * Fetch home page stats with in-memory caching
 * Stats don't need real-time accuracy, so we cache for 60s
 */
export async function fetchHomeStats(): Promise<{
  totalRepos: number;
  totalContributors: number;
  totalPRs: number;
}> {
  // Return cached stats if still valid
  if (statsCache && Date.now() - statsCache.timestamp < STATS_CACHE_TTL_MS) {
    return statsCache.data;
  }

  const supabase = getSupabaseClient();

  // Fetch counts in parallel
  const [reposResult, contributorsResult, prsResult] = await Promise.all([
    supabase.from('repositories').select('id', { count: 'exact', head: true }),
    supabase.from('contributors').select('id', { count: 'exact', head: true }),
    supabase.from('pull_requests').select('id', { count: 'exact', head: true }),
  ]);

  const data = {
    totalRepos: reposResult.count || 0,
    totalContributors: contributorsResult.count || 0,
    totalPRs: prsResult.count || 0,
  };

  // Update cache
  statsCache = { data, timestamp: Date.now() };

  return data;
}

/**
 * Fetch contributor stats for a repository
 */
export async function fetchRepoContributorStats(
  owner: string,
  repo: string
): Promise<{
  count: number;
  topContributors: Array<{ login: string; avatar_url: string; contributions: number }>;
}> {
  const supabase = getSupabaseClient();

  // Get contributor count and top contributors in a single query by joining repositories
  const { data: contributors, count } = await supabase
    .from('repository_contributors')
    .select(
      `
      contributions,
      contributors!inner(login, avatar_url),
      repositories!inner(owner, name)
    `,
      { count: 'exact' }
    )
    .eq('repositories.owner', owner)
    .eq('repositories.name', repo)
    .order('contributions', { ascending: false })
    .limit(10);

  const topContributors = (contributors || []).map((c) => ({
    login: (c.contributors as { login: string }).login,
    avatar_url: (c.contributors as { avatar_url: string }).avatar_url,
    contributions: c.contributions,
  }));

  return {
    count: count || 0,
    topContributors,
  };
}
