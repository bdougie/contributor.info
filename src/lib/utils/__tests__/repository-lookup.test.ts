/* eslint-disable no-restricted-syntax */
// Async tests required: the dedup contract is about concurrent promise sharing.
// All mocks resolve immediately — no real timers, no hangs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockMaybeSingle, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  }));
  return { mockMaybeSingle, mockFrom };
});

vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

import {
  getRepositoryByOwnerName,
  clearRepositoryLookupCache,
  type RepositoryIdentity,
} from '../repository-helpers';

const repoRow = {
  id: 'repo-uuid-1',
  owner: 'continuedev',
  name: 'continue',
  last_updated_at: '2026-07-13T00:00:00Z',
};

const ssrRow: RepositoryIdentity = {
  id: 'ssr-uuid-1',
  owner: 'continuedev',
  name: 'continue',
  last_updated_at: '2026-07-12T00:00:00Z',
};

describe('getRepositoryByOwnerName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRepositoryLookupCache();
  });

  afterEach(() => {
    delete window.__REPO_SSR__;
  });

  it('dedupes concurrent lookups for the same owner/name into one query', async () => {
    mockMaybeSingle.mockResolvedValue({ data: repoRow, error: null });

    const [a, b, c] = await Promise.all([
      getRepositoryByOwnerName('continuedev', 'continue'),
      getRepositoryByOwnerName('continuedev', 'continue'),
      getRepositoryByOwnerName('continuedev', 'continue'),
    ]);

    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    expect(a).toEqual(repoRow);
    expect(b).toEqual(repoRow);
    expect(c).toEqual(repoRow);
  });

  it('serves sequential lookups for a found repository from cache', async () => {
    mockMaybeSingle.mockResolvedValue({ data: repoRow, error: null });

    await getRepositoryByOwnerName('continuedev', 'continue');
    const second = await getRepositoryByOwnerName('continuedev', 'continue');

    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    expect(second).toEqual(repoRow);
  });

  it('does not cache misses so pollers can see a repo appear', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: repoRow, error: null });

    const miss = await getRepositoryByOwnerName('new', 'repo');
    const hit = await getRepositoryByOwnerName('new', 'repo');

    expect(miss).toBeNull();
    expect(hit).toEqual(repoRow);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it('throws on query error and does not cache the failure', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    mockMaybeSingle.mockResolvedValueOnce({ data: repoRow, error: null });

    await expect(getRepositoryByOwnerName('a', 'b')).rejects.toBeTruthy();
    const retry = await getRepositoryByOwnerName('a', 'b');

    expect(retry).toEqual(repoRow);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it('does not share cache entries across different repositories', async () => {
    mockMaybeSingle.mockResolvedValue({ data: repoRow, error: null });

    await getRepositoryByOwnerName('owner-a', 'repo');
    await getRepositoryByOwnerName('owner-b', 'repo');

    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it('uses a matching SSR payload without querying supabase', async () => {
    window.__REPO_SSR__ = ssrRow;

    const result = await getRepositoryByOwnerName('continuedev', 'continue');

    expect(result).toEqual(ssrRow);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('matches the SSR payload case-insensitively', async () => {
    window.__REPO_SSR__ = { ...ssrRow, owner: 'ContinueDev', name: 'Continue' };

    const result = await getRepositoryByOwnerName('continuedev', 'continue');

    expect(result?.id).toBe('ssr-uuid-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('ignores a mismatched SSR payload and queries normally', async () => {
    window.__REPO_SSR__ = { ...ssrRow, owner: 'someone-else', name: 'other-repo' };
    mockMaybeSingle.mockResolvedValue({ data: repoRow, error: null });

    const result = await getRepositoryByOwnerName('continuedev', 'continue');

    expect(result).toEqual(repoRow);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    // Mismatched payload is left in place for the repository it belongs to
    expect(window.__REPO_SSR__).toBeDefined();
  });

  it('ignores a malformed SSR payload and queries normally', async () => {
    window.__REPO_SSR__ = { id: 123, owner: 'continuedev' } as unknown as RepositoryIdentity;
    mockMaybeSingle.mockResolvedValue({ data: repoRow, error: null });

    const result = await getRepositoryByOwnerName('continuedev', 'continue');

    expect(result).toEqual(repoRow);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('consumes the SSR payload one-shot', async () => {
    window.__REPO_SSR__ = ssrRow;

    const first = await getRepositoryByOwnerName('continuedev', 'continue');
    expect(first).toEqual(ssrRow);
    expect(window.__REPO_SSR__).toBeUndefined();

    // A fresh lookup after the cache is cleared (e.g. TTL expiry) must hit the
    // network, not stale SSR data
    clearRepositoryLookupCache();
    mockMaybeSingle.mockResolvedValue({ data: repoRow, error: null });

    const second = await getRepositoryByOwnerName('continuedev', 'continue');
    expect(second).toEqual(repoRow);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
