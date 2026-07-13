/* eslint-disable no-restricted-syntax */
// Async tests required: the dedup contract is about concurrent promise sharing.
// All mocks resolve immediately — no real timers, no hangs.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  return { mockMaybeSingle };
});

vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    }),
  }),
}));

import { getRepositoryByOwnerName, clearRepositoryLookupCache } from '../repository-helpers';

const repoRow = {
  id: 'repo-uuid-1',
  owner: 'continuedev',
  name: 'continue',
  last_updated_at: '2026-07-13T00:00:00Z',
};

describe('getRepositoryByOwnerName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRepositoryLookupCache();
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
});
