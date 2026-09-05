import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGitHubSessionStorage } from '../github-session-storage';

function jwt(session = 'session-one', user = 'user-one') {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user, session_id: session, exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
}
const session = (id = 'session-one', user = 'user-one') => ({
  access_token: jwt(id, user),
  refresh_token: 'test-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: user,
    aud: 'authenticated',
    app_metadata: { provider: 'github' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
});
function makeStorage() {
  const records = new Map<string, string>();
  const storage = createGitHubSessionStorage({
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => {
      records.set(key, value);
    },
    removeItem: (key) => {
      records.delete(key);
    },
  });
  return { storage, records };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('provider token retention in Supabase session storage', () => {
  it('retains tokens across auth refresh without creating a separate token store', async () => {
    const { storage, records } = makeStorage();
    await storage.setItem(
      'auth',
      JSON.stringify({
        ...session(),
        provider_token: 'test-github',
        provider_refresh_token: 'test-provider-refresh',
      })
    );
    await storage.setItem('auth', JSON.stringify({ ...session(), refresh_token: 'rotated' }));
    expect(JSON.parse((await storage.getItem('auth'))!)).toMatchObject({
      refresh_token: 'rotated',
      provider_token: 'test-github',
      provider_refresh_token: 'test-provider-refresh',
    });
    expect(records.size).toBe(1);
  });

  it.each([
    ['different session', session('another-session')],
    ['different account', session('session-one', 'another-user')],
    [
      'another provider',
      { ...session(), user: { ...session().user, app_metadata: { provider: 'google' } } },
    ],
    ['invalid session identity', { ...session(), access_token: 'invalid' }],
  ])('does not retain credentials for a %s', async (_, next) => {
    const { storage } = makeStorage();
    await storage.setItem('auth', JSON.stringify({ ...session(), provider_token: 'test-github' }));
    await storage.setItem('auth', JSON.stringify(next));
    expect(JSON.parse((await storage.getItem('auth'))!).provider_token).toBeUndefined();
  });

  it('honors new credentials and explicit removal', async () => {
    const { storage } = makeStorage();
    await storage.setItem(
      'auth',
      JSON.stringify({ ...session(), provider_token: 'old-test-token' })
    );
    await storage.setItem(
      'auth',
      JSON.stringify({ ...session(), provider_token: 'new-test-token' })
    );
    expect(JSON.parse((await storage.getItem('auth'))!).provider_token).toBe('new-test-token');
    await storage.setItem('auth', JSON.stringify({ ...session(), provider_token: null }));
    await storage.setItem('auth', JSON.stringify(session()));
    expect(JSON.parse((await storage.getItem('auth'))!).provider_token).toBeNull();
    await storage.removeItem('auth');
    await storage.setItem('auth', JSON.stringify(session()));
    expect(JSON.parse((await storage.getItem('auth'))!).provider_token).toBeUndefined();
  });

  it('passes through verifier and non-session storage records unchanged', async () => {
    const { storage } = makeStorage();
    await storage.setItem('auth-code-verifier', 'not-json');
    expect(await storage.getItem('auth-code-verifier')).toBe('not-json');
  });

  it('works through the real SDK callback, refresh, reload, and sign-out lifecycle', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const { storage } = makeStorage();
    const current = session();
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/user')) return Response.json(current.user);
      if (url.includes('/token')) return Response.json({ ...current, refresh_token: 'rotated' });
      if (url.includes('/logout')) return new Response(null, { status: 204 });
      throw new Error('Unexpected auth request');
    });
    const hash = new URLSearchParams({
      access_token: current.access_token,
      refresh_token: current.refresh_token,
      token_type: 'bearer',
      expires_in: '3600',
      provider_token: 'test-github',
    });
    window.history.replaceState({}, '', `/i/open-source-repos?keep=yes#${hash}`);
    const options = {
      auth: {
        storage,
        storageKey: 'test-github-session',
        autoRefreshToken: false,
        detectSessionInUrl: true,
        flowType: 'implicit' as const,
      },
      global: { fetch: apiFetch },
    };
    const client = createClient('https://example.supabase.co', 'test-anon', options);
    const initial = await client.auth.getSession();
    expect(initial.error).toBeNull();
    expect(initial.data.session?.provider_token).toBe('test-github');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?keep=yes');
    expect((await client.auth.refreshSession()).error).toBeNull();
    expect((await client.auth.getSession()).data.session?.provider_token).toBe('test-github');
    const reloaded = createClient('https://example.supabase.co', 'test-anon', {
      ...options,
      auth: { ...options.auth, detectSessionInUrl: false },
    });
    expect((await reloaded.auth.getSession()).data.session?.provider_token).toBe('test-github');
    expect((await reloaded.auth.signOut({ scope: 'local' })).error).toBeNull();
    expect(await storage.getItem('test-github-session')).toBeNull();
    client.auth.stopAutoRefresh();
    reloaded.auth.stopAutoRefresh();
  });
});
