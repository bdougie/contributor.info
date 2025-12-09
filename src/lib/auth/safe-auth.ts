/**
 * Safe Supabase Auth Utilities
 *
 * Provides timeout-protected wrappers for Supabase auth calls to prevent
 * infinite loading states. All Supabase auth calls should use these utilities.
 *
 * @see https://github.com/supabase/supabase-js/issues/1234 - Known hanging issue
 */

import { getSupabase } from '@/lib/supabase-lazy';
import { logger } from '@/lib/logger';
import type { User, Session, AuthError } from '@supabase/supabase-js';

/**
 * Default timeout for auth operations (2 seconds)
 * This is sufficient for most network conditions while preventing indefinite hangs
 */
const DEFAULT_AUTH_TIMEOUT_MS = 2000;

/**
 * Generic timeout wrapper for promises
 * Races a promise against a timeout to prevent infinite hangs
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Safe wrapper for supabase.auth.getUser()
 * Includes timeout protection and automatic session fallback
 *
 * @param timeoutMs - Optional custom timeout in milliseconds
 * @returns User data or null if not authenticated
 * @throws Error if both getUser and getSession fail/timeout
 */
export async function safeGetUser(
  timeoutMs: number = DEFAULT_AUTH_TIMEOUT_MS
): Promise<{ user: User | null; error: AuthError | Error | null }> {
  try {
    const supabase = await getSupabase();

    // Track slow auth calls for monitoring
    const slowAuthTimer = setTimeout(() => {
      logger.log(`[Auth] getUser() taking longer than expected (>${timeoutMs}ms)...`);
    }, timeoutMs);

    try {
      const result = await withTimeout(supabase.auth.getUser(), timeoutMs, 'getUser');
      clearTimeout(slowAuthTimer);

      if (result.error) {
        logger.log('[Auth] getUser() error, trying session fallback:', result.error.message);
        // Try session fallback
        return await safeGetSession(timeoutMs);
      }

      return {
        user: result.data?.user || null,
        error: null,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      clearTimeout(slowAuthTimer);

      // If getUser times out or fails, try session fallback
      logger.warn('[Auth] getUser() timed out or failed, using session fallback');
      return await safeGetSession(timeoutMs);
    }
  } catch (error) {
    const authError = error instanceof Error ? error : new Error('Unknown auth error');
    logger.error('[Auth] Both getUser() and session fallback failed:', authError);
    return {
      user: null,
      error: authError,
    };
  }
}

/**
 * Safe wrapper for supabase.auth.getSession()
 * Includes timeout protection
 *
 * @param timeoutMs - Optional custom timeout in milliseconds
 * @returns Session data or null if not authenticated
 * @throws Error if getSession fails/times out
 */
export async function safeGetSession(
  timeoutMs: number = DEFAULT_AUTH_TIMEOUT_MS
): Promise<{ user: User | null; session: Session | null; error: AuthError | Error | null }> {
  try {
    const supabase = await getSupabase();
    const result = await withTimeout(supabase.auth.getSession(), timeoutMs, 'getSession');

    if (result.error) {
      return {
        user: null,
        session: null,
        error: result.error,
      };
    }

    return {
      user: result.data.session?.user || null,
      session: result.data.session || null,
      error: null,
    };
  } catch (error) {
    const authError = error instanceof Error ? error : new Error('Unknown session error');
    logger.error('[Auth] getSession() timed out or failed:', authError);
    return {
      user: null,
      session: null,
      error: authError,
    };
  }
}

/**
 * Check if user is authenticated (convenience wrapper)
 * Returns boolean instead of throwing errors
 *
 * @param timeoutMs - Optional custom timeout in milliseconds
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(timeoutMs?: number): Promise<boolean> {
  const { user, error } = await safeGetUser(timeoutMs);
  if (error) {
    logger.warn('[Auth] Authentication check failed:', error);
    return false;
  }
  return user !== null;
}

/**
 * Get current user or throw error
 * Use this when authentication is required for the operation
 *
 * @param timeoutMs - Optional custom timeout in milliseconds
 * @returns User object
 * @throws Error if not authenticated or auth call fails
 */
export async function requireAuth(timeoutMs?: number): Promise<User> {
  const { user, error } = await safeGetUser(timeoutMs);

  if (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user;
}
