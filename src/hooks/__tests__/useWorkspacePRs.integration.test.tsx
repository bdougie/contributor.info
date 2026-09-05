import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspacePRs } from '../useWorkspacePRs';
import type { Repository } from '@/components/features/workspace';

const mocks = vi.hoisted(() => ({ from: vi.fn(), sync: vi.fn() }));
vi.mock('@/lib/supabase-lazy', () => ({ getSupabase: async () => ({ from: mocks.from }) }));
vi.mock('@/lib/sync-pr-reviewers', () => ({ syncPullRequestReviewersWithStatus: mocks.sync }));

const repository = { id: 'tapes', owner: 'papercomputeco', name: 'tapes' } as Repository;
const savedAt = '2026-01-01T00:00:00Z';
const savedPR = {
  id: 'pr-341',
  number: 341,
  title: 'Saved PR',
  state: 'open',
  repository_id: 'tapes',
  last_synced_at: savedAt,
  created_at: savedAt,
  updated_at: savedAt,
  repositories: repository,
  contributors: { username: 'bdougie', avatar_url: '' },
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('workspace PR cache and refresh', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sync.mockResolvedValue({ prs: [], persisted: false });
    mocks.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [savedPR], error: null }),
    }));
  });
  afterEach(cleanup);

  it('shows stored PRs while GitHub refresh is still pending', async () => {
    let finish!: (value: { prs: []; persisted: boolean }) => void;
    mocks.sync.mockReturnValue(
      new Promise<{ prs: []; persisted: boolean }>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.pullRequests[0]?.number).toBe(341));
    expect(result.current.loading).toBe(false);
    expect(result.current.isSyncing).toBe(true);
    await act(async () => finish({ prs: [], persisted: true }));
    await waitFor(() => expect(result.current.isSyncing).toBe(false));
  });

  it('does not mark unchanged DB snapshots fresh after a fallback fetch', async () => {
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.isSyncing).toBe(false));
    expect(result.current.isStale).toBe(true);
    expect(result.current.lastSynced?.toISOString()).toBe(new Date(savedAt).toISOString());
  });

  it('marks the snapshot fresh once every repository has been stored', async () => {
    mocks.sync.mockResolvedValue({ prs: [], persisted: true });
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.isSyncing).toBe(false));
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastSynced?.getTime()).toBeGreaterThan(new Date(savedAt).getTime());
  });

  it("judges freshness by each repository's newest row, not its oldest closed PR", async () => {
    const recent = new Date().toISOString();
    mocks.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [savedPR, { ...savedPR, id: 'pr-342', number: 342, last_synced_at: recent }],
        error: null,
      }),
    }));
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStale).toBe(false);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('shows saved PRs when only the freshness check fails', async () => {
    let calls = 0;
    mocks.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(async () => {
        calls += 1;
        return calls === 1
          ? { data: [savedPR], error: null }
          : { data: null, error: { message: 'timeout' } };
      }),
    }));
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.error).toContain('freshness'));
    expect(result.current.pullRequests).toHaveLength(1);
    expect(result.current.isStale).toBe(true);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('keeps cached rows and exposes failed refreshes', async () => {
    mocks.sync.mockRejectedValue(new Error('GitHub unavailable'));
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.error).toContain('could not be refreshed'));
    expect(result.current.pullRequests).toHaveLength(1);
    expect(result.current.isStale).toBe(true);
  });

  it('allows manual sync when automatic sync is disabled', async () => {
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [repository],
          selectedRepositories: [],
          workspaceId: 'workspace',
          autoSyncOnMount: false,
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.sync).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.refresh();
    });
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
});
