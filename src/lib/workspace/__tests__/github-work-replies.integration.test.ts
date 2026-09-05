import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAwaitingReplies } from '../github-work-replies';
import { fetchGitHubWorkCategory, mergeGitHubWork, type GitHubWorkItem } from '../github-my-work';

// The shared limiter's rate-limit backoff is covered by its own tests; keep these fast.
vi.mock('@/lib/rate-limiter', () => ({
  graphqlRateLimiter: { enqueue: <T>(task: () => Promise<T>) => task() },
}));

const item: GitHubWorkItem = {
  id: 341,
  nodeId: 'PR_341',
  number: 341,
  title: 'Remove transcripts command',
  repository: 'papercomputeco/tapes',
  type: 'pr',
  url: 'https://github.com/papercomputeco/tapes/pull/341',
  author: 'bdougie',
  updatedAt: '2026-09-01T00:00:00Z',
  categories: ['authored'],
};
const comment = (login = 'reviewer', bodyText = 'Can you add a test?', id = 1) => ({
  author: { login, __typename: 'User' },
  bodyText,
  url: `${item.url}#discussion_r${id}`,
  createdAt: `2026-09-0${id}T00:00:00Z`,
});
const comments = (nodes: ReturnType<typeof comment>[] = []) => ({
  nodes,
  pageInfo: { hasPreviousPage: false },
});
const conversation = () => ({
  id: item.nodeId,
  state: 'OPEN',
  author: { login: 'bdougie' },
  assignees: { nodes: [] as { login: string }[], pageInfo: { hasNextPage: false } },
  comments: comments(),
  reviewThreads: {
    nodes: [{ isResolved: false, comments: comments([comment()]) }],
    pageInfo: { hasNextPage: false },
  },
});
function mockResponse(node = conversation()) {
  const fetchMock = vi.fn().mockImplementation(async () =>
    Response.json({
      data: { viewer: { login: 'BDougie' }, nodes: [node] },
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const options = () => ({
  token: 'test-token',
  items: [item],
  signal: new AbortController().signal,
});
afterEach(() => vi.unstubAllGlobals());

describe('GitHub comments awaiting response', () => {
  it('loads review comments with the existing session and returns a safe preview', async () => {
    const fetchMock = mockResponse();
    const result = await fetchAwaitingReplies(options());
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/graphql',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables.ids).toEqual(['PR_341']);
    expect(result).toMatchObject({
      incomplete: false,
      items: [
        {
          categories: ['awaiting_reply'],
          replies: [{ author: 'reviewer', body: 'Can you add a test?', kind: 'review' }],
        },
      ],
    });
  });

  it('clears a thread after the viewer replies, even if a bot comments later', async () => {
    const node = conversation();
    node.reviewThreads.nodes[0].comments = comments([
      comment(),
      comment('bdougie', 'Added it', 2),
      comment('ci[bot]', 'Passed', 3),
    ]);
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toEqual([]);
  });

  it('excludes resolved threads and bot-only comments', async () => {
    const node = conversation();
    node.reviewThreads.nodes[0].isResolved = true;
    node.comments = comments([
      { ...comment('automation'), author: { login: 'automation', __typename: 'Bot' } },
    ]);
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toEqual([]);
  });

  it('ignores another users thread unless the viewer participated or was mentioned', async () => {
    const node = conversation();
    node.author.login = 'someone-else';
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toEqual([]);
    node.reviewThreads.nodes[0].comments = comments([
      comment('bdougie', 'Earlier', 1),
      comment('reviewer', 'Follow-up', 2),
    ]);
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toHaveLength(1);
    node.reviewThreads.nodes[0].comments = comments([
      comment('reviewer', '@bdougie-other not you'),
    ]);
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toEqual([]);
    node.reviewThreads.nodes[0].comments = comments([comment('reviewer', '@BDougie please check')]);
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toHaveLength(1);
  });

  it('includes assigned issue conversations and merges without duplicating the work item', async () => {
    const node = conversation();
    node.author.login = 'someone-else';
    node.assignees.nodes = [{ login: 'bdougie' }];
    node.reviewThreads.nodes = [];
    node.comments = comments([comment()]);
    mockResponse(node);
    const result = await fetchAwaitingReplies(options());
    expect(mergeGitHubWork([item, ...result.items])).toMatchObject([
      { id: 341, categories: ['authored', 'awaiting_reply'], replies: [{ kind: 'conversation' }] },
    ]);
  });

  it('keeps independent unanswered review threads when another thread has a reply', async () => {
    const node = conversation();
    node.reviewThreads.nodes.push({ isResolved: false, comments: comments([comment('bdougie')]) });
    node.comments = comments([comment('bdougie')]);
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items[0].replies).toHaveLength(1);
  });

  it('marks truncated history and inaccessible nodes as incomplete per repository', async () => {
    // The viewer authored this conversation, so the visible window decides it fully.
    const node = conversation();
    node.reviewThreads.nodes[0].comments.pageInfo.hasPreviousPage = true;
    mockResponse(node);
    const decided = await fetchAwaitingReplies(options());
    expect(decided.incomplete).toBe(false);
    expect(decided.items[0].replies).toHaveLength(1);
    // Someone else's conversation with older comments may hide the viewer's participation.
    node.author = { login: 'maintainer' };
    mockResponse(node);
    const uncertain = await fetchAwaitingReplies(options());
    expect(uncertain.items).toEqual([]);
    expect(uncertain.incomplete).toBe(true);
    expect(uncertain.incompleteRepositories).toEqual([item.repository.toLowerCase()]);
    const missing = await fetchAwaitingReplies({
      ...options(),
      items: [{ ...item, nodeId: 'missing' }],
    });
    expect(missing.incomplete).toBe(true);
    expect(missing.incompleteRepositories).toEqual([item.repository.toLowerCase()]);
  });

  it('does not include an item closed since search or an unsafe comment URL', async () => {
    const node = conversation();
    node.state = 'CLOSED';
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toEqual([]);
    node.state = 'OPEN';
    node.reviewThreads.nodes[0].comments.nodes[0].url = 'https://example.com/untrusted';
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).items).toEqual([]);
  });

  it('does not fetch outside an empty workspace', async () => {
    const fetchMock = mockResponse();
    expect(
      await fetchGitHubWorkCategory({ ...options(), repositories: [], category: 'awaiting_reply' })
    ).toEqual({
      items: [],
      incomplete: false,
      unavailableRepositories: [],
      incompleteRepositories: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a transient GitHub outage instead of dropping the reply queue', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(
        Response.json({ data: { viewer: { login: 'BDougie' }, nodes: [conversation()] } })
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchAwaitingReplies(options());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(1);
  });

  it('inspects batches concurrently and keeps search order', async () => {
    const items = Array.from({ length: 15 }, (_, index) => ({
      ...item,
      id: index,
      nodeId: `PR_${index}`,
      number: index,
      url: `https://github.com/papercomputeco/tapes/pull/${index}`,
    }));
    let inFlight = 0;
    let peak = 0;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      const { variables } = JSON.parse(String(init.body)) as { variables: { ids: string[] } };
      return Response.json({
        data: {
          viewer: { login: 'BDougie' },
          nodes: variables.ids.map((id) => {
            const index = Number(id.replace('PR_', ''));
            const url = `https://github.com/papercomputeco/tapes/pull/${index}#discussion_r1`;
            return {
              ...conversation(),
              id,
              reviewThreads: {
                nodes: [{ isResolved: false, comments: comments([{ ...comment(), url }]) }],
                pageInfo: { hasNextPage: false },
              },
            };
          }),
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchAwaitingReplies({ ...options(), items });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(peak).toBeGreaterThan(1);
    expect(result.items.map((entry) => entry.id)).toEqual(items.map((entry) => entry.id));
  });

  it('treats -bot logins like other bots when deciding who spoke last', async () => {
    const node = conversation();
    node.reviewThreads.nodes[0].comments = comments([
      comment('reviewer', 'Can you add a test?', 1),
      {
        ...comment('release-bot', 'Deployed preview', 2),
        author: { login: 'release-bot', __typename: 'User' },
      },
    ]);
    mockResponse(node);
    const result = await fetchAwaitingReplies(options());
    expect(result.items[0]?.replies?.[0]?.author).toBe('reviewer');
  });

  it('surfaces GraphQL failures instead of claiming there are no replies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ errors: [{ message: 'Unavailable' }] }))
    );
    await expect(fetchAwaitingReplies(options())).rejects.toThrow('could not load');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(fetchAwaitingReplies(options())).rejects.toThrow('HTTP 429');
  });
});
