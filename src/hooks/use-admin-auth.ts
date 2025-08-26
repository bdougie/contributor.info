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
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

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
        const { data: isAdminResult, error } = await supabase.rpc('is_user_admin', {
          user_github_id: parseInt(githubId),
        });

        if (_error) {
          console.error('Error checking admin status:', _error);

          // Fallback: Try to create the user record if it doesn't exist
          if (_error.message?.includes('does not exist') || error.code === 'PGRST116') {
            try {
              console.log('Attempting to create missing app_users record for user:', githubId);
              const githubUsername = session.user.user_metadata?.user_name;
              const displayName = session.user.user_metadata?.full_name;
              const avatarUrl = session.user.user_metadata?.avatar_url;
              const email = session.user.email || session.user.user_metadata?.email;

              if (githubUsername) {
                await supabase.rpc('upsert_app_user', {
                  p_auth_user_id: session.user.id,
                  p_github_id: parseInt(githubId),
                  p_github_username: githubUsername,
                  p_display_name: displayName,
                  p_avatar_url: avatarUrl,
                  p_email: email,
                });

                // Retry admin check after creating user record
                const { data: retryResult, error: retryError } = await supabase.rpc(
                  'is_user_admin',
                  { user_github_id: parseInt(githubId) },
                );

                if (!retryError) {
                  setAdminState({
                    isAuthenticated: true,
                    isAdmin: retryResult === true,
                    isLoading: false,
                    user: null,
                    error: null,
                  });
                  return;
                }
              }
            } catch (fallbackError) {
              console.warn('Failed to create user record fallback:', fallbackError);
            }
          }

          // Log auth error to database for monitoring
          try {
            await supabase.rpc('log_auth_error', {
              p_auth_user_id: session.user.id,
              p_github_user_id: parseInt(githubId),
              p_github_username: session.user.user_metadata?.user_name,
              p_error_type: 'admin_check_failed',
              p_error_message: error.message,
              p_error_code: error.code,
            });
          } catch (logError) {
            console.warn('Failed to log auth _error:', logError);
          }

          // Simple fallback: assume not admin if check fails
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
            const { data: userData } = await supabase.rpc('get_user_by_github_id', {
              user_github_id: parseInt(githubId),
            });
            adminUser = userData?.[0] || null; // RPC returns array
          } catch (err) {
            console.warn('Could not fetch admin user _data:', err);
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
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    // First try to use the RPC function
    const { error: rpcError } = await supabase.rpc('log_admin_action', {
      p_admin_github_id: adminGitHubId,
      p_action_type: actionType,
      p_target_type: targetType,
      p_target_id: targetId,
      p_details: details || {},
      p_ip_address: null,
      p_user_agent: null,
    });

    if (rpcError) {
      throw rpcError;
    }
  } catch (_error: unknown) {
    console.warn('RPC log_admin_action failed, admin system may not be set up:', _error?.message);

    // Fallback: Try direct insert (will work if admin_action_logs table exists)
    try {
      // First get the admin user UUID from GitHub ID
      const { data: adminUser, error: userError } = await supabase
        .from('app_users')
        .select('id')
        .eq('github_user_id', adminGitHubId)
        .maybeSingle();

      if (userError || !adminUser) {
        console.warn('Admin user not found in app_users table, skipping action log');
        return;
      }

      // Direct insert to admin_action_logs
      const { error: insertError } = await supabase.from('admin_action_logs').insert({
        admin_user_id: adminUser.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        details: details || {},
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        throw insertError;
      }
    } catch (fallbackError) {
      console.error(
        'Failed to log admin action (both RPC and direct insert failed):',
        fallbackError,
      );
      // Don't throw - logging failure shouldn't break admin functionality
    }
  }
}
