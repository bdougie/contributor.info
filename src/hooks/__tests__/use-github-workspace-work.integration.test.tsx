import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGitHubWorkspaceWork } from '../use-github-workspace-work';
import type { GitHubWorkItem } from '@/lib/workspace/github-my-work';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  fetchWork: vi.fn(),
  from: vi.fn(),
}));
vi.mock('../use-current-user', () => ({ useCurrentUser: mocks.auth }));
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: async () => ({ auth: { getSession: mocks.session }, from: mocks.from }),
}));
vi.mock('@/lib/workspace/github-my-work', async (original) => ({
  ...(await original<typeof import('@/lib/workspace/github-my-work')>()),
  fetchGitHubWorkCategory: mocks.fetchWork,
}));
const item: GitHubWorkItem = {
  id: 341,
  number: 341,
  title: 'Your PR',
  repository: 'papercomputeco/tapes',
  type: 'pr',
  url: 'https://github.com/papercomputeco/tapes/pull/341',
  updatedAt: '2026-09-03T00:00:00Z',
  author: 'bdougie',
  categories: ['authored'],
};

// The hook relies on the application's shared client for focus refetching, so every
// test renders inside a provider the way the page does.
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const strictWrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </StrictMode>
);

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient();
  mocks.auth.mockReturnValue({ user: { id: 'user-1', last_sign_in_at: 'now' }, loading: false });
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: 'user-1' }, provider_token: 'test-token' } },
    error: null,
  });
  mocks.fetchWork.mockResolvedValue({ items: [item], incomplete: false });
});
afterEach(cleanup);

describe('GitHub workspace work authentication and scope', () => {
  it('reuses the retained Supabase provider token after an auth refresh', async () => {
    mocks.session.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.errors).toEqual([]);
    expect(mocks.fetchWork).toHaveBeenCalledWith(expect.objectContaining({ token: 'test-token' }));
  });
  it('loads under React StrictMode without getting stuck after cleanup', async () => {
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper: strictWrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('does not use another account session during an authentication transition', async () => {
    mocks.session.mockResolvedValue({
      data: { session: { user: { id: 'another-user' }, provider_token: 'other-test-token' } },
      error: null,
    });
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.errors[0]).toContain('session changed'));
    expect(mocks.fetchWork).not.toHaveBeenCalled();
  });
  it('reads session authorization but never queries Supabase activity tables', async () => {
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetchWork).toHaveBeenCalledTimes(4);
    expect(mocks.fetchWork).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-token',
        repositories: ['papercomputeco/tapes'],
        category: 'authored',
      })
    );
  });

  it('does not substitute a shared token when provider authorization is absent', async () => {
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.errors[0]).toContain('missing its GitHub token'));
    expect(mocks.fetchWork).not.toHaveBeenCalled();
  });

  it('clears displayed personal data immediately on sign-out', async () => {
    const { result, rerender } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.auth.mockReturnValue({ user: null, loading: false });
    rerender();
    expect(result.current.items).toEqual([]);
    expect(result.current.signedIn).toBe(false);
  });

  it('does not show the previous repository results while the new selection loads', async () => {
    const { result, rerender } = renderHook(
      ({ repos }) => useGitHubWorkspaceWork('workspace', repos),
      { initialProps: { repos: ['papercomputeco/tapes'] }, wrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.fetchWork.mockResolvedValue({ items: [], incomplete: false });
    rerender({ repos: ['papercomputeco/stereOS'] });
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('keeps personal work out of the persisted cache and refetches on focus', async () => {
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const queries = client.getQueryCache().findAll({ queryKey: ['github-work'] });
    expect(queries).toHaveLength(4);
    expect(queries.every((query) => query.meta?.persist === false)).toBe(true);
    expect(queries.every((query) => query.options.refetchOnWindowFocus === true)).toBe(true);
  });

  it('retains independently successful categories when one fails', async () => {
    mocks.fetchWork.mockImplementation(async ({ category }) => {
      if (category === 'assigned') throw new Error('GitHub unavailable');
      return { items: [item], incomplete: false };
    });
    const { result } = renderHook(
      () => useGitHubWorkspaceWork('workspace', ['papercomputeco/tapes']),
      { wrapper }
    );
    await waitFor(() => expect(result.current.errors).toHaveLength(1));
    expect(result.current.items).toHaveLength(1);
  });
});
