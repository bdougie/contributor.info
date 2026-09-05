import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkInbox } from '../use-work-inbox';
import { inboxError } from '@/lib/notifications/work-inbox';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  scope: vi.fn(),
  inbox: vi.fn(),
  github: vi.fn(),
  rpc: vi.fn(),
  session: vi.fn(),
  read: vi.fn(),
}));
vi.mock('../use-current-user', () => ({ useCurrentUser: mocks.auth }));
vi.mock('@/lib/supabase-lazy', () => ({ getSupabase: async () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/auth/github-session', () => ({ getGitHubSession: mocks.session }));
vi.mock('@/lib/workspace/github-my-work', () => ({ fetchGitHubWorkCategory: mocks.github }));
vi.mock('@/lib/notifications/work-inbox', async (original) => ({
  ...(await original<typeof import('@/lib/notifications/work-inbox')>()),
  beginWorkScan: mocks.scope,
  getWorkInbox: mocks.inbox,
  markWorkRead: mocks.read,
}));
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </StrictMode>
);
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.auth.mockReturnValue({ user: { id: 'user-1' } });
  mocks.scope.mockResolvedValue({
    observed_at: '2026-09-05T00:00:00Z',
    workspace_count: 2,
    repositories: [{ id: 'repo-1', full_name: 'papercomputeco/tapes' }],
  });
  mocks.inbox.mockResolvedValue({ items: [], unreadCount: 0 });
  mocks.session.mockResolvedValue({ provider_token: 'test-only-token' });
  mocks.github.mockResolvedValue({ items: [], incomplete: false, unavailableRepositories: [] });
  mocks.rpc.mockResolvedValue({ error: null });
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe('Workspace inbox scanning', () => {
  it('separates missing inbox setup from errors without starting GitHub scans', async () => {
    mocks.scope.mockRejectedValue(inboxError({ code: 'PGRST202', message: 'Function missing' }));
    const { result } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.errors).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mocks.github).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not classify network failures as unavailable setup', async () => {
    mocks.scope.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.errors).toEqual(['Failed to fetch']));
    expect(result.current.unavailable).toBe(false);
  });
  it('scans each category once across the union of workspace repositories in StrictMode', async () => {
    const { result } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.errors).toEqual([]);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    expect(mocks.github).toHaveBeenCalledTimes(2);
    expect(mocks.github).toHaveBeenCalledWith(
      expect.objectContaining({ repositories: ['papercomputeco/tapes'] })
    );
  });
  it('never calls GitHub or writes work for a user without workspaces', async () => {
    mocks.scope.mockResolvedValue({ workspace_count: 0, repositories: [], observed_at: 'now' });
    const { result } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.eligible).toBe(false);
    expect(mocks.github).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not resolve work when the GitHub response is incomplete', async () => {
    mocks.github.mockResolvedValue({ items: [], incomplete: true, unavailableRepositories: [] });
    renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_workspace_work_snapshot',
      expect.objectContaining({ p_complete: false })
    );
  });
  it('does not write an inaccessible repository or failed category', async () => {
    mocks.github.mockImplementation(async ({ category }) => {
      if (category === 'review_requested') throw new Error('Rate limited');
      return { items: [], incomplete: true, unavailableRepositories: ['papercomputeco/tapes'] };
    });
    const { result } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.errors).toContain('Rate limited'));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('hides old account work immediately on sign-out', async () => {
    mocks.inbox.mockResolvedValue({ items: [{ id: 'personal' }], unreadCount: 1 });
    const { result, rerender } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.auth.mockReturnValue({ user: null });
    rerender();
    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
  it('rechecks account identity after fetching before writing', async () => {
    mocks.github.mockImplementation(async () => {
      mocks.session.mockRejectedValue(new Error('Session changed'));
      return { items: [], incomplete: false, unavailableRepositories: [] };
    });
    const { result } = renderHook(useWorkInbox, { wrapper });
    await waitFor(() => expect(result.current.errors).toContain('Session changed'));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
