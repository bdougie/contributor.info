import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import { getRepoOwnerAvatarUrl } from '@/lib/utils/avatar';

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
  };
};

export interface UseUserWorkspacesReturn {
  workspaces: WorkspacePreviewData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch workspaces for the current authenticated user
 * Returns user's workspaces with repository preview data
 */
export function useUserWorkspaces(): UseUserWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<WorkspacePreviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isFetchingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchUserWorkspaces = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    // Cancel any existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isFetchingRef.current = true;
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated - with AbortController timeout
      let user = null;

      // Add timeout using AbortSignal
      const authTimeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 2000);

      try {
        console.log('[Workspace] Checking auth status...');

        // Check if aborted
        if (signal.aborted) {
          throw new Error('Request aborted');
        }

        const authResult = await supabase.auth.getUser();
        clearTimeout(authTimeoutId);

        const { data: authData, error: authError } = authResult;

        // If auth error, try to get session as fallback
        if (authError) {
          console.log('[Workspace] Auth _error, checking session:', authError.message);
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            console.log('[Workspace] No session found, user is not authenticated');
            setWorkspaces([]);
            setLoading(false);
            hasInitialLoadRef.current = true;
            return;
          }
          user = session.user;
        } else {
          user = authData?.user;
        }
      } catch (timeoutError) {
        clearTimeout(authTimeoutId);

        if (signal.aborted) {
          console.warn('[Workspace] Auth check aborted or timed out, using session fallback');
        }

        // Try to get session directly as fallback
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            user = session.user;
          } else {
            console.log('[Workspace] No session in fallback, setting empty workspaces');
            setWorkspaces([]);
            setLoading(false);
            hasInitialLoadRef.current = true;
            return;
          }
        } catch (sessionError) {
          console.error('[Workspace] Failed to get session:', sessionError);
          setWorkspaces([]);
          setLoading(false);
          setError(new Error('Unable to verify authentication'));
          hasInitialLoadRef.current = true;
          return;
        }
      }

      if (!user) {
        console.log('[Workspace] No user found after auth check');
        setWorkspaces([]);
        setLoading(false);
        hasInitialLoadRef.current = true;
        return;
      }

      console.log('[Workspace] User authenticated, fetching workspaces...');

      // Fetch workspaces where user is owner or member
      // First try to get workspaces where user is the owner
      const { data: ownedWorkspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_active', true);

      // Then get workspace IDs where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id);

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
        console.log('[Workspace] User has no workspaces');
        setWorkspaces([]);
        setLoading(false);
        hasInitialLoadRef.current = true;
        return;
      }

      console.log('[Workspace] Found %d workspace(s) for user', workspaceIds.size);

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
        `,
        )
        .in('id', workspaceIdsArray)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .returns<WorkspaceWithMember[]>();

      if (workspaceError) {
        throw new Error(`Failed to fetch workspaces: ${workspaceError.message}`);
      }

      if (!workspaceData || workspaceData.length === 0) {
        setWorkspaces([]);
        return;
      }

      // Fetch additional data for each workspace
      const enrichedWorkspaces = await Promise.all(
        workspaceData.map(async (workspace) => {
          // Get repository count and member count
          const [repositoriesResult, repoCountResult, membersResult] = await Promise.all([
            supabase
              .from('workspace_repositories')
              .select(
                `
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
                  open_issues_count
                )
              `,
              )
              .eq('workspace_id', workspace.id)
              .order('is_pinned', { ascending: false })
              .limit(10) // Fetch more to sort client-side
              .returns<RepositoryWithWorkspace[]>(),

            // Get actual total count of repositories (not just the displayed 3)
            supabase
              .from('workspace_repositories')
              .select('id', { count: 'exact', head: true })
              .eq('workspace_id', workspace.id),

            supabase.from('workspace_members').select('id').eq('workspace_id', workspace.id),
          ]);

          // Check for errors in individual queries and fail fast for critical data
          if (repositoriesResult._error) {
            console.error(
              `Failed to fetch repositories for workspace ${workspace.id}:`,
              repositoriesResult._error.message,
            );
            // For critical data failures, throw to trigger error state
            throw new Error(
              `Unable to load workspace repositories: ${repositoriesResult._error.message}`,
            );
          }
          if (membersResult._error) {
            console.warn(
              `Failed to fetch members for workspace ${workspace.id}:`,
              membersResult._error.message,
            );
            // Members count is less critical, can continue with fallback
          }

          // Sort repositories by pinned status first, then by github_pushed_at
          const sortedRepositories = repositoriesResult.data?.sort((a, b) => {
            // First sort by pinned status
            if (a.is_pinned !== b.is_pinned) {
              return a.is_pinned ? -1 : 1;
            }
            // Then sort by pushed_at date
            const dateA = new Date(a.repositories.github_pushed_at || 0).getTime();
            const dateB = new Date(b.repositories.github_pushed_at || 0).getTime();
            return dateB - dateA;
          });

          const repositories =
            sortedRepositories?.slice(0, 3).map((item) => {
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
                avatar_url: getRepoOwnerAvatarUrl(item.repositories.owner),
                html_url: `https://github.com/${item.repositories.full_name}`,
              };
            }) || [];

          // Use current user's metadata if they're the owner
          const ownerMetadata = workspace.owner_id === user.id ? user.user_metadata : null;

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
            repository_count: repoCountResult.count || 0,
            member_count: membersResult.data?.length || 0,
            repositories,
            created_at: workspace.created_at,
          } as WorkspacePreviewData;
        }),
      );

      console.log('[Workspace] Successfully loaded %d workspace(s)', enrichedWorkspaces.length);
      setWorkspaces(enrichedWorkspaces);
      hasInitialLoadRef.current = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workspaces';
      console.error('[Workspace] Error fetching workspaces:', _errorMessage);
      setError(new Error(_errorMessage));
      setWorkspaces([]);
      hasInitialLoadRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadingTimeout: NodeJS.Timeout;

    const initFetch = async () => {
      if (!mounted) return;

      // Add a shorter timeout to prevent infinite loading state
      loadingTimeout = setTimeout(() => {
        if (loading && mounted && !hasInitialLoadRef.current) {
          console.error('[Workspace] Loading timed out after 10 seconds');
          setLoading(false);
          setError(new Error('Workspace loading timed out. Please refresh the page.'));
          hasInitialLoadRef.current = true;
        }
      }, 10000);

      await fetchUserWorkspaces();
      clearTimeout(loadingTimeout);
    };

    initFetch();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Only refetch on actual sign in/out, not token refresh
        await fetchUserWorkspaces();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  return {
    workspaces,
    loading,
    error,
    refetch: fetchUserWorkspaces,
  };
}

/**
 * Hook to get the user's primary workspace (first one)
 * Useful for showing a single workspace preview on homepage
 */
export function usePrimaryWorkspace() {
  const { workspaces, loading, error: _error, refetch } = useUserWorkspaces();

  return {
    workspace: workspaces[0] || null,
    hasWorkspace: workspaces.length > 0,
    loading,
    error,
    refetch,
  };
}
