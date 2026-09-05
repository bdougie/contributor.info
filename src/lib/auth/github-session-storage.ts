import type { SupportedStorage } from '@supabase/supabase-js';

interface StoredGitHubSession {
  access_token: string;
  provider_token?: string | null;
  provider_refresh_token?: string | null;
  user: { id: string; app_metadata: { provider: string } };
}

function readGitHubSession(value: string | null): StoredGitHubSession | null {
  if (!value) return null;
  try {
    const session = JSON.parse(value);
    if (
      typeof session?.access_token !== 'string' ||
      typeof session?.user?.id !== 'string' ||
      session.user.app_metadata?.provider !== 'github'
    )
      return null;
    return session;
  } catch {
    return null;
  }
}

function sessionId(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    // Only compare the session identity here; Supabase remains responsible for JWT validation.
    const claims = JSON.parse(atob(payload));
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

/** Keep the provider credentials in the existing auth record, not a second token store. */
export function createGitHubSessionStorage(storage: SupportedStorage): SupportedStorage {
  return {
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    async setItem(key, value) {
      const next = readGitHubSession(value);
      if (next && !Object.prototype.hasOwnProperty.call(next, 'provider_token')) {
        const previous = readGitHubSession(await storage.getItem(key));
        const id = sessionId(next.access_token);
        if (
          previous &&
          id &&
          id === sessionId(previous.access_token) &&
          previous.user.id === next.user.id
        ) {
          value = JSON.stringify({
            ...next,
            provider_token: previous.provider_token,
            provider_refresh_token: previous.provider_refresh_token,
          });
        }
      }
      await storage.setItem(key, value);
    },
  };
}

export function getBrowserGitHubSessionStorage(): SupportedStorage | undefined {
  try {
    if (typeof window !== 'undefined') {
      const storage = window.localStorage;
      const probe = `github-session-storage-check-${Math.random()}`;
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return createGitHubSessionStorage(storage);
    }
  } catch {
    // Let Supabase use its in-memory fallback when browser storage is unavailable.
  }
  return undefined;
}
