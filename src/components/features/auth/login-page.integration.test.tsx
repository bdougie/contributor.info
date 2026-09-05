import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LoginPage from './login-page';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn(),
  isLoggedIn: false,
  trackLoginInitiated: vi.fn(),
  trackLoginSuccessful: vi.fn(),
}));
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock('@/hooks/use-github-auth', () => ({
  useGitHubAuth: () => ({ login: mocks.login, isLoggedIn: mocks.isLoggedIn }),
}));
vi.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => mocks }));
vi.mock('@/components/common/layout', () => ({ SocialMetaTags: () => null }));

describe('workspace login return path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.isLoggedIn = false;
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_CI', 'false');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
  });

  it.each(['redirectTo', 'redirect'])('accepts the %s workspace return parameter', (parameter) => {
    window.history.replaceState({}, '', `/login?${parameter}=%2Fworkspaces`);
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/create and manage your workspaces/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /github/i }));
    expect(localStorage.getItem('redirectAfterLogin')).toBe('/workspaces');
    expect(mocks.login).toHaveBeenCalledOnce();
  });

  it('preserves the pending repository after authentication', () => {
    const destination = '/workspaces/new?repository=papercomputeco%2Ftapes';
    window.history.replaceState(
      {},
      '',
      `/login?${new URLSearchParams({ redirectTo: destination })}`
    );
    mocks.isLoggedIn = true;
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(mocks.navigate).toHaveBeenCalledWith(destination, { replace: true });
  });

  it('replaces stale return destinations instead of accepting an external URL', () => {
    window.history.replaceState({}, '', '/login?redirectTo=https%3A%2F%2Fevil.test');
    localStorage.setItem('redirectAfterLogin', '/stale');
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /github/i }));
    expect(localStorage.getItem('redirectAfterLogin')).toBe('/');
  });
});
