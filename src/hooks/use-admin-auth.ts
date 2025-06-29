import { useState, useEffect } from 'react';
import { useGitHubAuth } from './use-github-auth';
import { supabase } from '@/lib/supabase';

interface AdminUser {
  id: string;
  github_user_id: number;
  github_username: string;
  display_name?: string;
  avatar_url?: string;
  email?: string;
  is_admin: boolean;
  last_login_at: string;
}

interface AdminAuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  error: string | null;
}

/**
 * Hook for admin authentication that extends GitHub authentication
 * with database-verified admin checking
 */
export function useAdminAuth(): AdminAuthState {
  const { isLoggedIn, loading: githubLoading } = useGitHubAuth();
  const [adminState, setAdminState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
    user: null,
    error: null,
  });

  useEffect(() => {
    async function checkAdminStatus() {
      if (githubLoading) {
        return; // Still loading GitHub auth
      }

      if (!isLoggedIn) {
        // Not authenticated with GitHub
        setAdminState({
          isAuthenticated: false,
          isAdmin: false,
          isLoading: false,
          user: null,
          error: null,
        });
        return;
      }

      try {
        // Get current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          setAdminState({
            isAuthenticated: false,
            isAdmin: false,
            isLoading: false,
            user: null,
            error: sessionError?.message || 'No active session',
          });
          return;
        }

        // Get GitHub user ID from metadata and check admin status
        const githubId = session.user.user_metadata?.provider_id || session.user.user_metadata?.sub;
        if (!githubId) {
          setAdminState({
            isAuthenticated: true,
            isAdmin: false,
            isLoading: false,
            user: null,
            error: null,
          });
          return;
        }

        // Check admin status in database using RPC to bypass RLS
        const { data: isAdminResult, error } = await supabase
          .rpc('is_user_admin', { user_github_id: parseInt(githubId) });

        if (error) {
          console.error('Error checking admin status:', error);
          setAdminState({
            isAuthenticated: true,
            isAdmin: false,
            isLoading: false,
            user: null,
            error: `Failed to verify admin status: ${error.message}`,
          });
          return;
        }

        const isAdmin = isAdminResult === true;

        // If user is admin, get their full user data using RPC to bypass RLS
        let adminUser = null;
        if (isAdmin) {
          try {
            // Use RPC to get user data since direct queries may fail due to RLS
            const { data: userData } = await supabase
              .rpc('get_user_by_github_id', { user_github_id: parseInt(githubId) });
            adminUser = userData?.[0] || null; // RPC returns array
          } catch (err) {
            console.warn('Could not fetch admin user data:', err);
          }
        }

        setAdminState({
          isAuthenticated: true,
          isAdmin,
          isLoading: false,
          user: adminUser,
          error: null,
        });

      } catch (err) {
        console.error('Error in admin auth check:', err);
        setAdminState({
          isAuthenticated: true,
          isAdmin: false,
          isLoading: false,
          user: null,
          error: 'Failed to verify admin status',
        });
      }
    }

    checkAdminStatus();
  }, [isLoggedIn, githubLoading]);

  return adminState;
}

/**
 * Hook to get current admin user's GitHub ID for logging actions
 */
export function useAdminGitHubId(): number | null {
  const { user } = useAdminAuth();
  return user?.github_user_id || null;
}

/**
 * Function to log admin actions for audit trail
 */
export async function logAdminAction(
  adminGitHubId: number,
  actionType: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('admin_action_logs').insert({
      admin_user_id: adminGitHubId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      details: details || {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failure shouldn't break admin functionality
  }
}