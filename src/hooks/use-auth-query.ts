import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

/**
 * Query keys for auth-related queries
 */
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  appUser: (authUserId: string) => [...authKeys.all, 'app-user', authUserId] as const,
};

/**
 * Hook to get the current authenticated user with automatic deduplication
 * 
 * This replaces direct `supabase.auth.getUser()` calls to prevent redundant
 * auth checks that were causing 4-5x duplicate requests.
 * 
 * @see https://github.com/bdougie/contributor.info/issues/1188
 */
export function useAuthUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async (): Promise<User | null> => {
      try {
        logger.debug('[Auth Query] Checking auth status...');
        
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          logger.debug('[Auth Query] Auth error, checking session:', error.message);
          
          // Fallback to session if getUser fails
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            logger.debug('[Auth Query] Found user via session fallback');
            return sessionData.session.user;
          }
          
          logger.debug('[Auth Query] No authenticated user found');
          return null;
        }
        
        if (data?.user) {
          logger.debug('[Auth Query] Authenticated user found:', data.user.id);
        } else {
          logger.debug('[Auth Query] No authenticated user');
        }
        
        return data?.user || null;
      } catch (error) {
        logger.error('[Auth Query] Error checking auth:', error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - auth rarely changes
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    retry: 1,
  });
}

/**
 * Hook to get the app_users.id for the current authenticated user
 * 
 * @param authUserId - The auth user ID from Supabase Auth
 */
export function useAppUserId(authUserId: string | undefined) {
  return useQuery({
    queryKey: authKeys.appUser(authUserId || ''),
    queryFn: async (): Promise<string | null> => {
      if (!authUserId) {
        return null;
      }
      
      logger.debug('[Auth Query] Fetching app_users.id for auth user:', authUserId);
      
      const { data, error } = await supabase
        .from('app_users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      
      if (error) {
        logger.error('[Auth Query] Error fetching app_users record:', error.message);
        return null;
      }
      
      if (data) {
        logger.debug('[Auth Query] Found app_user id:', data.id);
      } else {
        logger.debug('[Auth Query] No app_users record found');
      }
      
      return data?.id || null;
    },
    enabled: !!authUserId, // Only run when we have an auth user ID
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}
