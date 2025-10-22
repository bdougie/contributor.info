/**
 * Authentication Helper Functions
 * Utilities for mapping between auth.users and app_users tables
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Get the app_users.id for the currently authenticated user
 *
 * After the workspace migration, workspace tables reference app_users.id,
 * but auth.getUser() returns auth.users.id (stored as auth_user_id in app_users).
 * This helper maps auth_user_id -> app_users.id.
 *
 * @returns app_users.id or null if not found/authenticated
 */
export async function getAppUserId(): Promise<string | null> {
  try {
    // Get the authenticated user's auth.users.id
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      logger.debug('[Auth] No authenticated user found');
      return null;
    }

    const authUserId = authData.user.id;

    // Map to app_users.id
    const { data: appUser, error: appUserError } = await supabase
      .from('app_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (appUserError) {
      logger.error('[Auth] Failed to fetch app_users record:', appUserError.message);
      return null;
    }

    if (!appUser) {
      logger.warn('[Auth] No app_users record found for auth_user_id:', authUserId);
      return null;
    }

    return appUser.id;
  } catch (error) {
    logger.error('[Auth] Error in getAppUserId:', error);
    return null;
  }
}

/**
 * Get both auth user and app_users.id in one call
 * Useful when you need both the auth user object and the app_users.id
 *
 * @returns Object with user (auth user) and appUserId (app_users.id)
 */
export async function getAuthUserWithAppId(): Promise<{
  user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
  appUserId: string | null;
}> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return { user: null, appUserId: null };
    }

    const appUserId = await getAppUserId();
    return { user: authData.user, appUserId };
  } catch (error) {
    logger.error('[Auth] Error in getAuthUserWithAppId:', error);
    return { user: null, appUserId: null };
  }
}
