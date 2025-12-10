import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import { getRepoOwnerAvatarUrl } from '@/lib/utils/avatar';
import { logger } from '@/lib/logger';
import { useAppUserId, authKeys } from '@/hooks/use-cached-auth';

// Types for Supabase query results
type WorkspaceWithMember = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  created_at: string;
};

type RepositoryWithWorkspace = {
  id: string;
  workspace_id: string;
  is_pinned: boolean;
  repositories: {
    id: string;
    full_name: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    github_pushed_at: string | null;
    pull_request_count: number | null;
    open_issues_count: number | null;
    avatar_url: string | null;
  };
};

type WorkspacePreviewStats = {
  workspace_id: string;
  repository_count: number;
  member_count: number;
};

// Query keys for workspace queries
export const workspaceKeys = {
  all: ['workspaces'] as const,
  userWorkspaces: (appUserId: string | null) => [...workspaceKeys.all, 'user', appUserId] as const,
};

export interface UseUserWorkspacesReturn {
  workspaces: WorkspacePreviewData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch workspaces for a given app user ID
 */
async function fetchUserWorkspaces(
  appUserId: string,
  authUser: { id: string; user_metadata: Record<string, string> } | null
): Promise<WorkspacePreviewData[]> {
  logger.log('[Workspace Query] Fetching workspaces for app user...');

  const supabase = await getSupabase();

  // Fetch workspaces where user is owner or member
  // First try to get workspaces where user is the owner
  const { data: ownedWorkspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', appUserId)
    .eq('is_active', true);

  // Then get workspace IDs where user is a member
  const { data: memberData, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', appUserId);

  if (memberError && !ownedWorkspaces) {
    throw new Error(`Failed to fetch workspace memberships: ${memberError.message}`);
  }

  // Combine owned and member workspace IDs
  const workspaceIds = new Set<string>();
  if (ownedWorkspaces) {
    ownedWorkspaces.forEach((w) => workspaceIds.add(w.id));
  }
  if (memberData) {
    memberData.forEach((m) => workspaceIds.add(m.workspace_id));
  }

  if (workspaceIds.size === 0) {
    logger.log('[Workspace Query] User has no workspaces');
    return [];
  }

  logger.log('[Workspace Query] Found %d workspace(s) for user', workspaceIds.size);

  const workspaceIdsArray = Array.from(workspaceIds);

  // Now fetch the workspace details
  const { data: workspaceData, error: workspaceError } = await supabase
    .from('workspaces')
    .select(
      `
      id,
      name,
      slug,
      description,
      owner_id,
      created_at
    `
    )
    .in('id', workspaceIdsArray)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<WorkspaceWithMember[]>();

  if (workspaceError) {
    throw new Error(`Failed to fetch workspaces: ${workspaceError.message}`);
  }

  if (!workspaceData || workspaceData.length === 0) {
    return [];
  }

  // Fetch additional data for all workspaces in batched queries (Phase 1 optimization)
  // This replaces the N+1 query problem with 3 batched queries

  // 1. Fetch workspace stats from materialized view (replaces 2N queries)
  const { data: workspaceStats } = await supabase
    .from('workspace_preview_stats')
    .select('workspace_id, repository_count, member_count')
    .in('workspace_id', workspaceIdsArray)
    .returns<WorkspacePreviewStats[]>();

  // Create lookup map for O(1) access
  const statsMap = new Map(workspaceStats?.map((stat) => [stat.workspace_id, stat]) || []);

  // 2. Fetch ALL repositories for ALL workspaces in one query
  // Dynamic limit: 10 repos per workspace (we only show 3, but fetch 10 for sorting flexibility)
  // Capped at 100 to prevent excessive memory usage
  const repoLimit = Math.min(workspaceIdsArray.length * 10, 100);

  const { data: allRepositories, error: reposError } = await supabase
    .from('workspace_repositories')
    .select(
      `
      workspace_id,
      id,
      is_pinned,
      repositories!inner(
        id,
        full_name,
        name,
        owner,
        description,
        language,
        github_pushed_at,
        pull_request_count,
        open_issues_count,
        avatar_url
      )
    `
    )
    .in('workspace_id', workspaceIdsArray)
    .order('is_pinned', { ascending: false })
    .limit(repoLimit)
    .returns<RepositoryWithWorkspace[]>();

  if (reposError) {
    logger.error('Failed to fetch workspace repositories: %s', reposError.message);
    throw new Error(`Unable to load workspace repositories: ${reposError.message}`);
  }

  // 3. Group repositories by workspace_id
  const reposByWorkspace = new Map<string, RepositoryWithWorkspace[]>();
  allRepositories?.forEach((repo) => {
    const existing = reposByWorkspace.get(repo.workspace_id) || [];
    existing.push(repo);
    reposByWorkspace.set(repo.workspace_id, existing);
  });

  // 4. Enrich workspaces (no async operations needed!)
  const enrichedWorkspaces = workspaceData.map((workspace) => {
    // Get stats from materialized view
    const stats = statsMap.get(workspace.id);
    const repositoryCount = stats?.repository_count || 0;
    const memberCount = stats?.member_count || 0;

    // Get repositories for this workspace
    const workspaceRepos = reposByWorkspace.get(workspace.id) || [];

    // Sort repositories by pinned status first, then by github_pushed_at
    const sortedRepositories = workspaceRepos.sort((a, b) => {
      // First sort by pinned status
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      // Then sort by pushed_at date
      const dateA = new Date(a.repositories.github_pushed_at || 0).getTime();
      const dateB = new Date(b.repositories.github_pushed_at || 0).getTime();
      return dateB - dateA;
    });

    // Take top 3 repositories for preview
    const repositories =
      sortedRepositories.slice(0, 3).map((item) => {
        // Calculate activity score: weight issues 2x higher than PRs
        const issueScore = (item.repositories.open_issues_count || 0) * 2;
        const prScore = item.repositories.pull_request_count || 0;
        const activityScore = issueScore + prScore;

        return {
          id: item.repositories.id,
          full_name: item.repositories.full_name,
          name: item.repositories.name,
          owner: item.repositories.owner,
          description: item.repositories.description,
          language: item.repositories.language,
          activity_score: activityScore,
          last_activity: item.repositories.github_pushed_at || new Date().toISOString(),
          avatar_url: getRepoOwnerAvatarUrl(
            item.repositories.owner,
            item.repositories.avatar_url || undefined
          ),
          html_url: `https://github.com/${item.repositories.full_name}`,
        };
      }) || [];

    // Use current user's metadata if they're the owner
    // Compare against appUserId since workspace.owner_id is app_users.id
    const ownerMetadata = workspace.owner_id === appUserId ? authUser?.user_metadata : null;

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      owner: {
        id: workspace.owner_id,
        avatar_url: ownerMetadata?.avatar_url,
        display_name: ownerMetadata?.full_name || ownerMetadata?.name,
      },
      repository_count: repositoryCount,
      member_count: memberCount,
      repositories,
      created_at: workspace.created_at,
    } as WorkspacePreviewData;
  });

  logger.log('[Workspace Query] Successfully loaded %d workspace(s)', enrichedWorkspaces.length);
  return enrichedWorkspaces;
}

/**
 * Hook to fetch workspaces for the current authenticated user
 * Returns user's workspaces with repository preview data
 *
 * Uses React Query for automatic request deduplication and caching.
 * Multiple components using this hook will share the same cached data.
 */
export function useUserWorkspaces(): UseUserWorkspacesReturn {
  const queryClient = useQueryClient();
  const { appUserId, isLoading: authLoading, user } = useAppUserId();

  const {
    data: workspaces = [],
    isLoading: workspacesLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: workspaceKeys.userWorkspaces(appUserId),
    queryFn: () => {
      if (!appUserId) return [];
      return fetchUserWorkspaces(appUserId, user);
    },
    enabled: !!appUserId, // Only fetch when we have an app user ID
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cached value on mount
    retry: 1,
  });

  // Invalidate workspace cache when auth changes
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const setupListener = async () => {
      try {
        const supabase = await getSupabase();
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
          // Only invalidate on actual auth state changes
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            logger.log('[Workspace Query] Auth state changed, invalidating workspace cache');
            queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
          }
        });
        subscription = authListener.subscription;
      } catch (error) {
        logger.error('[Workspace Query] Error setting up auth listener:', error);
      }
    };

    setupListener();

    return () => {
      subscription?.unsubscribe();
    };
  }, [queryClient]);

  // Invalidate workspaces when app user ID changes (from auth query)
  useEffect(() => {
    if (appUserId) {
      // When app user ID becomes available, the query will auto-fetch
      // due to the enabled condition
    }
  }, [appUserId]);

  const loading = authLoading || workspacesLoading;

  return {
    workspaces,
    loading,
    error: error as Error | null,
    refetch: async () => {
      // First invalidate auth to get fresh user data
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
      // Then refetch workspaces
      await refetch();
    },
  };
}

/**
 * Hook to get the user's primary workspace (first one)
 * Useful for showing a single workspace preview on homepage
 */
export function usePrimaryWorkspace() {
  const { workspaces, loading, error, refetch } = useUserWorkspaces();

  return {
    workspace: workspaces[0] || null,
    hasWorkspace: workspaces.length > 0,
    loading,
    error,
    refetch,
  };
}
