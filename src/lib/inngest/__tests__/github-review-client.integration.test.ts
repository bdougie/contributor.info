import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../supabase', () => ({ supabase: {} }));
vi.mock('../../env', () => ({ serverEnv: { NODE_ENV: 'test' } }));
import { getOctokit } from '../github-client';

afterEach(() => vi.unstubAllGlobals());

describe('Review client pagination', () => {
  it('passes the requested page and size to GitHub using the repository token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ id: 101 }]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getOctokit('test-token').rest.pulls.listReviews({
      owner: 'papercomputeco',
      repo: 'tapes',
      pull_number: 341,
      page: 2,
      per_page: 100,
    });
    expect(result.data).toEqual([{ id: 101 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/papercomputeco/tapes/pulls/341/reviews?per_page=100&page=2',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'token test-token' }),
      })
    );
  });
});
