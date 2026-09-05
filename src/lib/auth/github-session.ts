import { safeGetSession } from './safe-auth';

/** Read GitHub authorization from the existing Supabase sign-in session. */
export async function getGitHubSession(expectedUserId?: string) {
  let result = await safeGetSession();
  if (result.error) throw result.error;
  const initialUserId = result.session?.user.id;
  if (expectedUserId && initialUserId !== expectedUserId) {
    throw new Error('Your sign-in session changed. Refresh the workspace.');
  }
  if (initialUserId && !result.session?.provider_token) {
    // An SDK refresh returns only auth-server fields. Re-read the same auth
    // record after our storage adapter has retained the provider credentials.
    result = await safeGetSession();
    if (result.error) throw result.error;
    if (result.session?.user.id !== initialUserId) {
      throw new Error('Your sign-in session changed. Refresh the workspace.');
    }
  }
  return result.session;
}
