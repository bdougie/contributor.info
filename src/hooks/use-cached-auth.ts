/**
 * React Query-based auth hooks for request deduplication
 *
 * These hooks use React Query to cache and deduplicate auth requests,
 * reducing redundant network calls when multiple components need auth state.
 *
 * @see https://github.com/bdougie/contributor.info/issues/1188
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import { safeGetUser } from '@/lib/auth/safe-auth';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

// Query keys for auth-related queries
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  appUserId: () => [...authKeys.all, 'appUserId'] as const,
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

/**
 * Fetch current authenticated user with timeout protection
 * This is the core query function used by useCachedAuth
 */
async function fetchAuthUser(): Promise<AuthState> {
  logger.log('[Auth Query] Fetching authenticated user...');

  // Check for test mode authentication first (CI/E2E tests)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const isCI = import.meta.env.VITE_CI === 'true';
  const isTestMode =
    supabaseUrl.includes('localhost:54321') || import.meta.env.MODE === 'test' || isCI;

  if (isTestMode && typeof window !== 'undefined' && localStorage.getItem('test-auth-user')) {
    try {
      const testUser = JSON.parse(localStorage.getItem('test-auth-user') || '{}');
      return { user: testUser as User, isAuthenticated: true };
    } catch {
      // Malformed JSON in localStorage, fall through to normal auth
      logger.warn('[Auth Query] Invalid test-auth-user in localStorage, ignoring');
    }
  }

  const { user, error } = await safeGetUser(2000);

  if (error) {
    logger.error('[Auth Query] Auth error:', error.message);
    return { user: null, isAuthenticated: false };
  }

  logger.log('[Auth Query] Auth check complete, authenticated: %s', !!user);
  return { user, isAuthenticated: !!user };
}

/**
 * Fetch app_users.id for the current authenticated user
 * Maps auth.users.id -> app_users.id for workspace operations
 */
async function fetchAppUserId(authUserId: string | undefined): Promise<string | null> {
  if (!authUserId) {
    return null;
  }

  logger.log('[Auth Query] Fetching app_users.id...');
  const supabase = await getSupabase();

  const { data: appUser, error } = await supabase
    .from('app_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    logger.error('[Auth Query] Failed to fetch app_users record:', error.message);
    return null;
  }

  if (!appUser) {
    logger.warn('[Auth Query] No app_users record found for auth_user_id');
    return null;
  }

  logger.log('[Auth Query] Found app_users.id');
  return appUser.id;
}

/**
 * Hook to get the current authenticated user with React Query caching
 *
 * This hook deduplicates auth requests across components. Multiple components
 * using this hook will share the same cached auth state.
 *
 * @returns User object, loading state, and authentication status
 */
export function useCachedAuth() {
  const queryClient = useQueryClient();

  const {
    data: authState,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: authKeys.user(),
    queryFn: fetchAuthUser,
    staleTime: 60 * 1000, // 1 minute - auth state doesn't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on every mount - use cached value
    retry: 1,
  });

  // Set up auth state listener to invalidate cache on auth changes
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const setupListener = async () => {
      try {
        const supabase = await getSupabase();
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          // Only invalidate on actual auth state changes
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            logger.log('[Auth Query] Auth state changed: %s', event);
            // Update cache immediately with new session data
            queryClient.setQueryData(authKeys.user(), {
              user: session?.user ?? null,
              isAuthenticated: !!session?.user,
            });
            // Also invalidate app user ID cache
            queryClient.invalidateQueries({ queryKey: authKeys.appUserId() });
          } else if (event === 'USER_UPDATED') {
            // User metadata changed, update cache
            queryClient.setQueryData(authKeys.user(), {
              user: session?.user ?? null,
              isAuthenticated: !!session?.user,
            });
          }
          // Ignore TOKEN_REFRESHED and other events
        });
        subscription = authListener.subscription;
      } catch (error) {
        logger.error('[Auth Query] Error setting up auth listener:', error);
      }
    };

    setupListener();

    return () => {
      subscription?.unsubscribe();
    };
  }, [queryClient]);

  return {
    user: authState?.user ?? null,
    isAuthenticated: authState?.isAuthenticated ?? false,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to get the app_users.id for the current user
 *
 * This is needed for workspace operations since workspace tables use
 * app_users.id rather than auth.users.id.
 *
 * @returns app_users.id or null if not found/authenticated
 */
export function useAppUserId() {
  const { user, isLoading: authLoading } = useCachedAuth();

  const { data: appUserId, isLoading: appUserLoading } = useQuery({
    queryKey: authKeys.appUserId(),
    queryFn: () => fetchAppUserId(user?.id),
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - app user ID doesn't change
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    appUserId: appUserId ?? null,
    isLoading: authLoading || appUserLoading,
    isAuthenticated: !!user,
    user,
  };
}

/**
 * Get cached auth user synchronously (for non-React code)
 * Returns null if not cached
 */
export function getCachedAuthUser(queryClient: ReturnType<typeof useQueryClient>): User | null {
  const cached = queryClient.getQueryData<AuthState>(authKeys.user());
  return cached?.user ?? null;
}
