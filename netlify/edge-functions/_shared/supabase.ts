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
 * Fetch repositories by owner (for profile pages)
 */
export async function fetchRepositoriesByOwner(owner: string, limit = 25): Promise<RepoData[]> {
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
    .order('stargazer_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ssr] Failed to fetch repositories for owner %s: %o', owner, error);
    return [];
  }

  return (data || []) as RepoData[];
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

/**
 * Workspace data structure for SSR
 */
export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: string;
  owner_id: string;
  created_at: string;
  repository_count: number;
  member_count: number;
}

/**
 * Workspace preview with repositories for SSR
 */
export interface WorkspacePreview extends WorkspaceData {
  repositories: Array<{
    id: string;
    full_name: string;
    name: string;
    owner: string;
    language: string | null;
    stargazer_count: number;
  }>;
}

/**
 * Fetch user's workspaces by auth token from cookie
 * Returns null if not authenticated or token is invalid
 */
export async function fetchUserWorkspaces(
  authToken: string | null
): Promise<WorkspacePreview[] | null> {
  if (!authToken) {
    return null;
  }

  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey =
    Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[ssr] Missing Supabase environment variables');
    return null;
  }

  // Create a client with the user's auth token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });

  try {
    // First get the user to verify auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authToken);

    if (userError || !user) {
      console.log('[ssr] Auth token invalid or expired');
      return null;
    }

    // Get the app_user_id for this auth user
    const { data: appUser, error: appUserError } = await supabase
      .from('app_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (appUserError || !appUser) {
      console.log('[ssr] No app_user found for auth user');
      return null;
    }

    // Fetch workspaces the user owns or is a member of
    const { data: memberWorkspaces, error: memberError } = await supabase
      .from('workspace_members')
      .select(
        `
        workspace_id,
        workspaces!inner(
          id,
          name,
          slug,
          description,
          tier,
          owner_id,
          created_at,
          is_active
        )
      `
      )
      .eq('user_id', appUser.id);

    if (memberError) {
      console.error('[ssr] Error fetching workspace memberships: %o', memberError);
      return null;
    }

    // Transform and filter active workspaces
    // TODO: Optimize N+1 query pattern by batching repository/member counts
    // Current approach makes 3 queries per workspace (repo count, member count, top repos)
    // Optimization: Create RPC functions to batch these queries:
    //   1. get_workspace_counts(workspace_ids[]) -> returns {workspace_id, repo_count, member_count}[]
    //   2. get_workspace_top_repos(workspace_ids[], limit) -> returns repos grouped by workspace_id
    // This would reduce ~30+ queries (for 10 workspaces) to just 2-3 queries total
    const workspaces: WorkspacePreview[] = [];

    for (const member of memberWorkspaces || []) {
      const ws = member.workspaces as {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        tier: string;
        owner_id: string;
        created_at: string;
        is_active: boolean;
      };

      if (!ws.is_active) continue;

      // Get repository count for this workspace
      const { count: repoCount } = await supabase
        .from('workspace_repositories')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.id);

      // Get member count
      const { count: memberCount } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.id);

      // Get top 3 repositories for preview
      const { data: repos } = await supabase
        .from('workspace_repositories')
        .select(
          `
          repositories(
            id,
            full_name,
            name,
            owner,
            language,
            stargazer_count
          )
        `
        )
        .eq('workspace_id', ws.id)
        .limit(3);

      const repositories = (repos || [])
        .filter((r) => r.repositories)
        .map((r) => {
          const repo = r.repositories as {
            id: string;
            full_name: string;
            name: string;
            owner: string;
            language: string | null;
            stargazer_count: number;
          };
          return repo;
        });

      workspaces.push({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        description: ws.description,
        tier: ws.tier,
        owner_id: ws.owner_id,
        created_at: ws.created_at,
        repository_count: repoCount || 0,
        member_count: memberCount || 0,
        repositories,
      });
    }

    return workspaces;
  } catch (error) {
    console.error('[ssr] Error fetching user workspaces: %o', error);
    return null;
  }
}

/**
 * Fetch demo/public workspace data for unauthenticated users
 */
export async function fetchDemoWorkspaceStats(): Promise<{
  totalWorkspaces: number;
  totalRepositories: number;
}> {
  const supabase = getSupabaseClient();

  const [workspacesResult, reposResult] = await Promise.all([
    supabase.from('workspaces').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('workspace_repositories').select('id', { count: 'exact', head: true }),
  ]);

  return {
    totalWorkspaces: workspacesResult.count || 0,
    totalRepositories: reposResult.count || 0,
  };
}

/**
 * Workspace detail data for SSR
 */
export interface WorkspaceDetailData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: string;
  owner_id: string;
  created_at: string;
  is_public: boolean;
  repository_count: number;
  member_count: number;
  contributor_count: number;
  repositories: Array<{
    id: string;
    full_name: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stargazer_count: number;
  }>;
  owner: {
    id: string;
    github_username: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Fetch a workspace by slug for public viewing
 * Returns null if workspace doesn't exist or isn't accessible
 */
export async function fetchWorkspaceBySlug(slug: string): Promise<WorkspaceDetailData | null> {
  const supabase = getSupabaseClient();

  // First fetch the workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select(
      `
      id,
      name,
      slug,
      description,
      tier,
      owner_id,
      created_at,
      is_active
    `
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (wsError || !workspace) {
    console.error('[ssr] Workspace not found: %s', slug);
    return null;
  }

  // Fetch related data in parallel
  const [repoCountResult, memberCountResult, reposResult, ownerResult] = await Promise.all([
    // Repository count
    supabase
      .from('workspace_repositories')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id),
    // Member count
    supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id),
    // Top repositories (limit 6 for preview)
    supabase
      .from('workspace_repositories')
      .select(
        `
          repositories(
            id,
            full_name,
            name,
            owner,
            description,
            language,
            stargazer_count
          )
        `
      )
      .eq('workspace_id', workspace.id)
      .limit(6),
    // Owner info
    supabase
      .from('app_users')
      .select('id, github_username, avatar_url')
      .eq('id', workspace.owner_id)
      .maybeSingle(),
  ]);

  // Contributor count: hardcoded to 0 for SSR to avoid complex query
  // TODO: Implement RPC function get_workspace_contributor_count(workspace_id UUID)
  //       This function should:
  //       1. Join workspace_repositories with repository_contributors
  //       2. Count DISTINCT contributor_id across all workspace repositories  
  //       3. Return scalar integer count
  //       SQL: SELECT COUNT(DISTINCT rc.contributor_id) 
  //            FROM workspace_repositories wr
  //            JOIN repository_contributors rc ON wr.repository_id = rc.repository_id
  //            WHERE wr.workspace_id = $1
  // For now, client-side will fetch this via a separate query after SSR hydration
  const contributorCount = 0;

  const repositories = (reposResult.data || [])
    .filter((r) => r.repositories)
    .map((r) => {
      const repo = r.repositories as {
        id: string;
        full_name: string;
        name: string;
        owner: string;
        description: string | null;
        language: string | null;
        stargazer_count: number;
      };
      return repo;
    });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    tier: workspace.tier,
    owner_id: workspace.owner_id,
    created_at: workspace.created_at,
    is_public: true, // Will be dynamic when public/private is implemented
    repository_count: repoCountResult.count || 0,
    member_count: memberCountResult.count || 0,
    contributor_count: contributorCount,
    repositories,
    owner: ownerResult.data,
  };
}
