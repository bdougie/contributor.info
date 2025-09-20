import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook to check if the current user has access to any paid workspace
 * Returns true if user is a member of a pro, team, or enterprise workspace
 */
export function useHasPaidWorkspace(): {
  hasPaidWorkspace: boolean;
  loading: boolean;
} {
  const [hasPaidWorkspace, setHasPaidWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkPaidWorkspaceAccess() {
      try {
        // Check if user is authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !mounted) {
          setHasPaidWorkspace(false);
          setLoading(false);
          return;
        }

        // Check if user owns any paid workspaces
        const { data: ownedWorkspaces } = await supabase
          .from('workspaces')
          .select('id, tier')
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .in('tier', ['pro', 'team', 'enterprise']);

        if (ownedWorkspaces && ownedWorkspaces.length > 0) {
          setHasPaidWorkspace(true);
          setLoading(false);
          return;
        }

        // Check if user is a member of any paid workspaces
        const { data: memberWorkspaces } = await supabase
          .from('workspace_members')
          .select(
            `
            workspace_id,
            workspaces!inner (
              id,
              tier,
              is_active
            )
          `
          )
          .eq('user_id', user.id)
          .eq('workspaces.is_active', true)
          .in('workspaces.tier', ['pro', 'team', 'enterprise']);

        if (memberWorkspaces && memberWorkspaces.length > 0) {
          setHasPaidWorkspace(true);
        } else {
          setHasPaidWorkspace(false);
        }
      } catch (error) {
        console.error('Error checking paid workspace access:', error);
        setHasPaidWorkspace(false);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkPaidWorkspaceAccess();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        checkPaidWorkspaceAccess();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { hasPaidWorkspace, loading };
}
