import { safeGetSession } from './safe-auth';

/**
 * Background work can wait longer than the interactive default; an expired JWT
 * makes getSession() refresh over the network before it resolves.
 */
const SESSION_TIMEOUT_MS = 10_000;

const SESSION_CHANGED = 'Your sign-in session changed. Refresh the workspace.';
const SESSION_EXPIRED = 'Your sign-in session has expired. Sign in again from the account menu.';

/** Read GitHub authorization from the existing Supabase sign-in session. */
export async function getGitHubSession(expectedUserId?: string) {
  let result = await safeGetSession(SESSION_TIMEOUT_MS);
  if (result.error) {
    throw new Error('Could not confirm your sign-in session. Check your connection and retry.');
  }
  const initialUserId = result.session?.user.id;
  if (expectedUserId && !initialUserId) throw new Error(SESSION_EXPIRED);
  if (expectedUserId && initialUserId !== expectedUserId) throw new Error(SESSION_CHANGED);
  if (initialUserId && !result.session?.provider_token) {
    // An SDK refresh returns only auth-server fields. Re-read the same auth
    // record after our storage adapter has retained the provider credentials.
    result = await safeGetSession(SESSION_TIMEOUT_MS);
    if (result.error) {
      throw new Error('Could not confirm your sign-in session. Check your connection and retry.');
    }
    if (result.session?.user.id !== initialUserId) throw new Error(SESSION_CHANGED);
  }
  return result.session;
}
