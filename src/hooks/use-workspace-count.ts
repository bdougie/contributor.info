import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface WorkspaceCountResult {
  workspaceCount: number;
  hasWorkspaces: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check the number of workspaces a user has access to
 * Returns count, whether user has any workspaces, and loading state
 *
 * @returns {WorkspaceCountResult} Workspace count information
 */
export function useWorkspaceCount(): WorkspaceCountResult {
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchWorkspaceCount() {
      try {
        // Get current user
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!currentUser || !mounted) {
          setWorkspaceCount(0);
          setLoading(false);
          return;
        }

        // Count distinct workspaces user has access to (either as owner or member)
        // Use a query that gets all workspaces where user is either owner or member, avoiding duplicates
        const { data: distinctWorkspaces, error: workspaceError } = await supabase.rpc(
          'get_user_workspace_count',
          {
            p_user_id: currentUser.id,
          }
        );

        if (workspaceError) {
          // Fallback: Use separate queries if RPC function doesn't exist yet
          console.warn('RPC function not available, using fallback method:', workspaceError);

          // Get workspaces where user is owner
          const { data: ownedWorkspaces, error: ownedError } = await supabase
            .from('workspaces')
            .select('id')
            .eq('owner_id', currentUser.id)
            .eq('is_active', true);

          if (ownedError) throw ownedError;

          // Get workspaces where user is a member (excluding where they're also owner)
          const { data: memberWorkspaces, error: memberError } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', currentUser.id)
            .not(
              'workspace_id',
              'in',
              `(${(ownedWorkspaces || []).map((w) => `'${w.id}'`).join(',') || 'null'})`
            );

          if (memberError) throw memberError;

          const totalCount = (ownedWorkspaces?.length || 0) + (memberWorkspaces?.length || 0);

          if (mounted) {
            setWorkspaceCount(totalCount);
            setError(null);
          }
          return;
        }

        const totalCount = distinctWorkspaces || 0;

        if (mounted) {
          setWorkspaceCount(totalCount);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching workspace count:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch workspace count');
          setWorkspaceCount(0);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchWorkspaceCount();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchWorkspaceCount();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    workspaceCount,
    hasWorkspaces: workspaceCount > 0,
    loading,
    error,
  };
}

/**
 * Hook to check if user needs workspace onboarding
 * Returns true if user is logged in but has no workspaces
 */
export function useNeedsWorkspaceOnboarding(): {
  needsOnboarding: boolean;
  loading: boolean;
} {
  const { hasWorkspaces, loading: workspaceLoading } = useWorkspaceCount();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    needsOnboarding: isAuthenticated && !hasWorkspaces,
    loading: authLoading || workspaceLoading,
  };
}
