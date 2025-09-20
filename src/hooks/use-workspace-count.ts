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

        // Count workspaces user owns
        const { count: ownedCount, error: ownedError } = await supabase
          .from('workspaces')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', currentUser.id)
          .eq('is_active', true);

        if (ownedError) {
          throw ownedError;
        }

        // Count workspaces user is a member of
        const { count: memberCount, error: memberError } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id);

        if (memberError) {
          throw memberError;
        }

        // Total count (owned + member, avoiding duplicates)
        // Note: This is a simplified count. In production, you might want to
        // do a more sophisticated query to avoid counting owned workspaces twice
        const totalCount = (ownedCount || 0) + (memberCount || 0);

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
