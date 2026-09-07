import { describe, expect, it, vi } from 'vitest';

vi.mock('../../client', () => ({ inngest: { createFunction: vi.fn() } }));
vi.mock('../../supabase-server', () => ({ supabase: {} }));
vi.mock('../../github-client', () => ({ getOctokitForRepo: vi.fn() }));
vi.mock('../../sync-logger', () => ({ SyncLogger: vi.fn() }));

import { fetchAllReviewPages } from '../capture-pr-reviews';

describe('Review capture pagination', () => {
  it('captures later pages and stops at the first short page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, id) => ({ id }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ id: 100 }]);
    expect(await fetchAllReviewPages(fetchPage)).toEqual([...firstPage, { id: 100 }]);
    expect(fetchPage.mock.calls).toEqual([
      [1, 100],
      [2, 100],
    ]);
  });
  it('checks one more page at an exact page boundary', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, id) => id))
      .mockResolvedValueOnce([]);
    expect(await fetchAllReviewPages(fetchPage)).toHaveLength(100);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
  it('does not return a partial history when a later page fails', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, id) => id))
      .mockRejectedValueOnce(new Error('Rate limited'));
    await expect(fetchAllReviewPages(fetchPage)).rejects.toThrow('Rate limited');
  });
});
