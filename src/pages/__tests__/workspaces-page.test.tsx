import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspacesPage from '../workspaces-page';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), workspaces: vi.fn() }));
vi.mock('@/hooks/use-cached-auth', () => ({ useCachedAuth: mocks.auth }));
vi.mock('@/hooks/use-user-workspaces', () => ({
  useUserWorkspaces: mocks.workspaces,
  workspaceKeys: { all: ['workspaces'], demoStats: () => ['workspaces', 'demo-stats'] },
}));
vi.mock('@/lib/supabase-lazy', () => ({ getSupabase: vi.fn(() => new Promise(() => {})) }));

const workspace: WorkspacePreviewData = {
  id: 'ws-1',
  name: 'Paper Compute',
  slug: 'paper-compute',
  description: 'Tooling',
  tier: 'pro',
  owner: { id: 'owner-1' },
  repository_count: 4,
  member_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  repositories: [
    {
      id: 'repo-1',
      full_name: 'papercomputeco/tapes',
      name: 'tapes',
      owner: 'papercomputeco',
      activity_score: 0,
      last_activity: '2026-01-01T00:00:00Z',
      html_url: 'https://github.com/papercomputeco/tapes',
    },
  ],
};
const ssrWindow = window as { __SSR_DATA__?: unknown };
const seedPage = (data: object, ageSeconds = 0) => {
  ssrWindow.__SSR_DATA__ = {
    route: 'workspaces',
    data,
    timestamp: Date.now() - ageSeconds * 1000,
  };
};
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/workspaces']}>
        <WorkspacesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  delete ssrWindow.__SSR_DATA__;
  mocks.auth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { id: 'u' } });
  mocks.workspaces.mockReturnValue({ workspaces: [workspace], loading: false, error: null });
});
afterEach(cleanup);

describe('WorkspacesPage', () => {
  it('renders the cached workspace list on the first frame without a skeleton', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Your Workspaces' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Paper Compute/ })).toHaveAttribute(
      'href',
      '/i/paper-compute'
    );
    expect(screen.getByText('pro')).toBeInTheDocument();
    expect(screen.getByText('4 repos')).toBeInTheDocument();
    expect(screen.getByText('tapes')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows the skeleton on a cold signed-in load with no edge render', () => {
    mocks.workspaces.mockReturnValue({ workspaces: [], loading: true, error: null });
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Your Workspaces' })).not.toBeInTheDocument();
  });

  it('keeps the edge-rendered list on screen while the client query loads', () => {
    mocks.auth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null });
    mocks.workspaces.mockReturnValue({ workspaces: [], loading: true, error: null });
    seedPage({
      authenticated: true,
      workspaces: [
        {
          id: 'ws-ssr',
          name: 'Edge Workspace',
          slug: 'edge',
          description: null,
          repository_count: 1,
          member_count: 1,
          repositories: [],
        },
      ],
    });
    renderPage();
    expect(screen.getByText('Edge Workspace')).toBeInTheDocument();
    expect(screen.getByText('free')).toBeInTheDocument();
    expect(ssrWindow.__SSR_DATA__).toBeUndefined();
  });

  it('renders the empty state once the query resolves with no workspaces', () => {
    mocks.workspaces.mockReturnValue({ workspaces: [], loading: false, error: null });
    renderPage();
    expect(screen.getByText('No workspaces yet')).toBeInTheDocument();
  });

  it('shows signed-out visitors the marketing page with fresh edge-rendered stats', () => {
    mocks.auth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    mocks.workspaces.mockReturnValue({ workspaces: [], loading: false, error: null });
    seedPage({ authenticated: false, stats: { totalWorkspaces: 1200, totalRepositories: 34 } });
    renderPage();
    expect(screen.getByText('Organize Your Open Source Insights')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
  });

  it('shows stale edge-rendered stats while the counts refresh', () => {
    mocks.auth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    mocks.workspaces.mockReturnValue({ workspaces: [], loading: false, error: null });
    seedPage({ authenticated: false, stats: { totalWorkspaces: 7, totalRepositories: 9 } }, 600);
    renderPage();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
