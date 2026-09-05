import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAwaitingReplies } from '../github-work-replies';
import { fetchGitHubWorkCategory, mergeGitHubWork, type GitHubWorkItem } from '../github-my-work';

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

  it('marks truncated history and inaccessible nodes as incomplete', async () => {
    const node = conversation();
    node.reviewThreads.nodes[0].comments.pageInfo.hasPreviousPage = true;
    mockResponse(node);
    expect((await fetchAwaitingReplies(options())).incomplete).toBe(true);
    expect(
      (await fetchAwaitingReplies({ ...options(), items: [{ ...item, nodeId: 'missing' }] }))
        .incomplete
    ).toBe(true);
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
    ).toEqual({ items: [], incomplete: false });
    expect(fetchMock).not.toHaveBeenCalled();
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
