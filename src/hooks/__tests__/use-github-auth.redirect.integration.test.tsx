import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGitHubAuth } from '../use-github-auth';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSession: vi.fn(),
  signInWithOAuth: vi.fn(),
  safeGetSession: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/auth/safe-auth', () => ({ safeGetSession: mocks.safeGetSession }));
vi.mock('@/lib/auth/auth-utils', () => ({
  getAuthRedirectURL: () =>
    window.location.origin + window.location.pathname + window.location.search,
}));
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: () =>
    Promise.resolve({
      auth: {
        setSession: mocks.setSession,
        signInWithOAuth: mocks.signInWithOAuth,
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } }),
      },
    }),
}));

describe('GitHub OAuth workspace return paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.safeGetSession.mockResolvedValue({ session: null, error: null });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('stores the complete path including the pending repository when starting OAuth', async () => {
    const destination = '/workspaces/new?repository=papercomputeco%2Ftapes';
    window.history.replaceState({}, '', destination);
    const { result } = renderHook(() => useGitHubAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login();
    });
    expect(localStorage.getItem('redirectAfterLogin')).toBe(destination);
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ redirectTo: window.location.origin + destination }),
      })
    );
  });

  it('lets Supabase consume the complete callback without rebuilding the session', async () => {
    const search = `?${new URLSearchParams({ redirectTo: '/workspaces/new?repository=papercomputeco%2Ftapes' })}`;
    window.history.replaceState(
      {},
      '',
      `/login${search}#access_token=test-access&refresh_token=test-refresh&provider_token=test-github`
    );
    mocks.safeGetSession.mockImplementationOnce(async () => {
      expect(window.location.hash).toContain('provider_token=test-github');
      window.history.replaceState({}, '', `/login${search}`);
      return { session: { user: { id: 'auth-user' }, provider_token: 'test-github' }, error: null };
    });
    const { result } = renderHook(() => useGitHubAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe(search);
  });

  it.each([
    [
      '/workspaces/new?repository=papercomputeco%2Ftapes',
      '/workspaces/new?repository=papercomputeco%2Ftapes',
    ],
    ['https://evil.test', '/'],
  ])('validates stored OAuth destination %s before navigating', async (stored, expected) => {
    window.history.replaceState({}, '', '/login');
    localStorage.setItem('redirectAfterLogin', stored);
    mocks.safeGetSession.mockResolvedValue({ session: { user: { id: 'auth-user' } }, error: null });
    const { result } = renderHook(() => useGitHubAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.navigate).toHaveBeenCalledWith(expected);
    expect(localStorage.getItem('redirectAfterLogin')).toBeNull();
  });
});
