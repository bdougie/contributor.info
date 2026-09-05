import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWorkQueries, fetchGitHubWorkCategory, mergeGitHubWork } from '../github-my-work';

afterEach(() => vi.unstubAllGlobals());
const source = {
  id: 33,
  number: 33,
  title: 'Raspberry Pi support',
  repository_url: 'https://api.github.com/repos/papercomputeco/stereOS',
  updated_at: '2026-05-07T16:42:58Z',
  state: 'open',
  user: { login: 'yeazelm' },
  pull_request: { url: 'unused' },
};
const options = () => ({
  token: 'test-only-token',
  repositories: ['papercomputeco/stereOS'],
  category: 'review_requested' as const,
  signal: new AbortController().signal,
});

describe('GitHub personal work queries', () => {
  it('uses GitHub review search, including team requests, scoped to workspace repos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ total_count: 1, incomplete_results: false, items: [source] })
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchGitHubWorkCategory(options());
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe('https://api.github.com');
    expect(url.searchParams.get('q')).toBe(
      'is:open is:pr review-requested:@me repo:papercomputeco/stereOS'
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-token');
    expect(result.items[0]).toMatchObject({
      number: 33,
      categories: ['review_requested'],
      url: 'https://github.com/papercomputeco/stereOS/pull/33',
    });
  });

  it('builds authored PR and assigned issue queries without a date cutoff', () => {
    expect(buildWorkQueries(['papercomputeco/tapes'], 'authored')).toEqual([
      'is:open is:pr author:@me repo:papercomputeco/tapes',
    ]);
    expect(buildWorkQueries(['papercomputeco/tapes'], 'assigned')).toEqual([
      'is:open is:issue assignee:@me repo:papercomputeco/tapes',
    ]);
  });

  it('never searches account-wide for an empty workspace', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchGitHubWorkCategory({ ...options(), repositories: [] })).toEqual({
      items: [],
      incomplete: false,
      unavailableRepositories: [],
      incompleteRepositories: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('narrows the search to readable repositories when GitHub rejects one qualifier', async () => {
    const readable = 'is:open is:pr review-requested:@me repo:papercomputeco/stereOS';
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const q = new URL(url).searchParams.get('q') || '';
      if (q.includes('repo:papercomputeco/private')) {
        return Response.json(
          { message: 'The listed repositories cannot be searched' },
          { status: 422 }
        );
      }
      return Response.json({ total_count: 1, incomplete_results: false, items: [source] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchGitHubWorkCategory({
      ...options(),
      repositories: ['papercomputeco/stereOS', 'papercomputeco/private', 'papercomputeco/tapes'],
    });
    expect(result.items).toHaveLength(1);
    expect(result.unavailableRepositories).toEqual(['papercomputeco/private']);
    const queries = fetchMock.mock.calls.map((call) => new URL(call[0]).searchParams.get('q'));
    expect(queries).toContain(readable);
    expect(queries).toContain('is:open is:pr review-requested:@me repo:papercomputeco/tapes');
  });

  it('works without AbortSignal.any or AbortSignal.timeout', async () => {
    vi.stubGlobal('AbortSignal', { ...AbortSignal, any: undefined, timeout: undefined });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(false);
      return Response.json({ total_count: 1, incomplete_results: false, items: [source] });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchGitHubWorkCategory(options())).items).toHaveLength(1);
  });

  it('aborts the request when the caller aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            );
          })
      )
    );
    const pending = fetchGitHubWorkCategory({ ...options(), signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow('Aborted');
  });

  it('rejects query injection in repository names', () => {
    expect(() => buildWorkQueries(['org/repo author:someone'], 'authored')).toThrow('invalid');
  });

  it('batches long repo lists without dropping scope or exceeding the search limit', () => {
    const repositories = Array.from(
      { length: 20 },
      (_, index) => `organization/repository-with-long-name-${index}`
    );
    const queries = buildWorkQueries(repositories, 'review_requested');
    expect(queries.length).toBeGreaterThan(1);
    expect(queries.every((query) => query.length <= 256 && query.includes('repo:'))).toBe(true);
    expect(queries.join(' ').match(/repo:/g)).toHaveLength(20);
  });

  it('paginates all search results instead of silently returning only 100', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...source, id: index + 100 }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ total_count: 101, incomplete_results: false, items: firstPage })
      )
      .mockResolvedValueOnce(
        Response.json({ total_count: 101, incomplete_results: false, items: [source] })
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchGitHubWorkCategory(options());
    expect(result.items).toHaveLength(101);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('page')).toBe('2');
  });

  it('does not admit items from other repos or closed PRs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          total_count: 2,
          items: [
            { ...source, repository_url: 'https://api.github.com/repos/other/private' },
            { ...source, state: 'closed' },
          ],
        })
      )
    );
    expect((await fetchGitHubWorkCategory(options())).items).toEqual([]);
  });

  it('flags incomplete search results for the searched repositories', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ total_count: 1, incomplete_results: true, items: [source] })
        )
    );
    const result = await fetchGitHubWorkCategory(options());
    expect(result.incomplete).toBe(true);
    expect(result.incompleteRepositories).toEqual(['papercomputeco/stereos']);
  });

  it('treats results from a renamed repository as incomplete instead of empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          total_count: 1,
          incomplete_results: false,
          items: [
            { ...source, repository_url: 'https://api.github.com/repos/papercomputeco/stereos-v2' },
          ],
        })
      )
    );
    const result = await fetchGitHubWorkCategory(options());
    expect(result.items).toEqual([]);
    expect(result.incomplete).toBe(true);
    expect(result.incompleteRepositories).toEqual(['papercomputeco/stereos']);
  });

  it('surfaces expired auth instead of silently returning no work', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(fetchGitHubWorkCategory(options())).rejects.toThrow('GitHub rejected');
  });

  it('surfaces API rate limiting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(fetchGitHubWorkCategory(options())).rejects.toThrow('limited');
  });

  it('deduplicates items while retaining their relationships', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ total_count: 1, items: [source] }))
    );
    const { items } = await fetchGitHubWorkCategory(options());
    expect(mergeGitHubWork([...items, { ...items[0], categories: ['authored'] }])).toMatchObject([
      { id: 33, categories: ['review_requested', 'authored'] },
    ]);
  });
});
