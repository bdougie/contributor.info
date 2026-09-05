import type { GitHubWorkItem, GitHubWorkReply } from './github-my-work';
import { fetchWithTimeout } from '@/lib/utils/abort-signal';
import { isBot } from '@/lib/utils/bot-detection';
import { graphqlRateLimiter } from '@/lib/rate-limiter';

interface Actor {
  login: string;
  __typename?: string;
}

interface Comment {
  author: Actor | null;
  bodyText: string;
  url: string;
  createdAt: string;
}

interface Connection<T> {
  nodes: (T | null)[];
  pageInfo: { hasNextPage?: boolean; hasPreviousPage?: boolean };
}

interface Conversation {
  id: string;
  state: string;
  author: Actor | null;
  assignees: Connection<Actor>;
  comments: Connection<Comment>;
  reviewThreads?: Connection<{
    id?: string;
    isResolved: boolean;
    comments: Connection<Comment>;
  }>;
}

interface ReplyData {
  viewer: { login: string };
  nodes: (Conversation | null)[];
}

interface ReplyResponse {
  data?: ReplyData;
  errors?: { message: string }[];
}

interface ValidReplyResponse {
  data: ReplyData;
  errors?: { message: string }[];
}

const commentFields = `nodes { author { login __typename } bodyText url createdAt }
  pageInfo { hasPreviousPage }`;
const conversationFields = `id state author { login }
  assignees(first: 100) { nodes { login } pageInfo { hasNextPage } }
  comments(last: 50) { ${commentFields} }`;
const query = `query WorkspaceReplyQueue($ids: [ID!]!) {
  viewer { login }
  nodes(ids: $ids) {
    ... on Issue { ${conversationFields} }
    ... on PullRequest {
      ${conversationFields}
      reviewThreads(first: 50) {
        nodes { id isResolved comments(last: 50) { ${commentFields} } }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

const BATCH_SIZE = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const TRANSIENT_RETRIES = 2;

class GitHubReplyError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'GitHubReplyError';
  }
}

function isHuman(comment: Comment | null): comment is Comment {
  return (
    !!comment?.author && !isBot({ username: comment.author.login, type: comment.author.__typename })
  );
}

function pendingReply(
  comments: Connection<Comment>,
  viewer: string,
  responsible: boolean,
  item: GitHubWorkItem,
  kind: GitHubWorkReply['kind']
): GitHubWorkReply | undefined {
  const humans = comments.nodes.filter(isHuman);
  const latest = humans[humans.length - 1];
  if (!latest?.author || latest.author.login.toLowerCase() === viewer) return;
  const participated = humans.some((comment) => comment.author?.login.toLowerCase() === viewer);
  const mentions: string[] = latest.bodyText.toLowerCase().match(/@[a-z\d-]+/g) || [];
  if (!responsible && !participated && !mentions.includes(`@${viewer}`)) return;
  // Only allow deep links into the item we requested, not arbitrary comment URLs.
  if (!latest.url.startsWith(`${item.url}#`)) return;
  return {
    author: latest.author.login,
    body: latest.bodyText.replace(/\s+/g, ' ').trim().slice(0, 280),
    url: latest.url,
    createdAt: latest.createdAt,
    kind,
  };
}

async function fetchBatch(
  token: string,
  ids: string[],
  signal: AbortSignal
): Promise<ValidReplyResponse> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetchWithTimeout(
      'https://api.github.com/graphql',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { ids } }),
      },
      signal,
      REQUEST_TIMEOUT_MS
    );
    // GitHub's GraphQL endpoint returns transient 5xx responses under load; retry briefly.
    if (response.status >= 500 && attempt < TRANSIENT_RETRIES && !signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) {
      throw new GitHubReplyError(
        `GitHub could not load comments (HTTP ${response.status}). Try refreshing later.`,
        response.status
      );
    }
    const payload: ReplyResponse = await response.json();
    if (!payload.data?.viewer?.login || !Array.isArray(payload.data.nodes)) {
      throw new GitHubReplyError(
        'GitHub could not load the reply queue. Other work is still available.'
      );
    }
    return { data: payload.data, errors: payload.errors };
  }
}

export async function fetchAwaitingReplies({
  token,
  items,
  signal,
}: {
  token: string;
  items: GitHubWorkItem[];
  signal: AbortSignal;
}): Promise<{ items: GitHubWorkItem[]; incomplete: boolean }> {
  const result: GitHubWorkItem[] = [];
  let incomplete = items.some((item) => !item.nodeId);
  const candidates = items.filter((item) => item.nodeId);
  // Small batches keep nested review-thread queries below GitHub's node limits.
  const batches: GitHubWorkItem[][] = [];
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    batches.push(candidates.slice(offset, offset + BATCH_SIZE));
  }
  // The shared limiter bounds concurrency and retries GitHub rate-limit responses.
  const payloads = await Promise.all(
    batches.map((batch) =>
      graphqlRateLimiter.enqueue(() =>
        fetchBatch(
          token,
          batch.map((item) => item.nodeId as string),
          signal
        )
      )
    )
  );
  // Walk batches in search order so newest activity stays first whatever finished first.
  for (const [index, { data, errors }] of payloads.entries()) {
    incomplete ||= !!errors?.length;
    const viewer = data.viewer.login.toLowerCase();
    for (const item of batches[index]) {
      const node = data.nodes.find((node) => node?.id === item.nodeId);
      if (!node?.comments || !node.assignees) {
        incomplete = true;
        continue;
      }
      // Recheck state after search, which can lag behind a close or merge.
      if (node.state !== 'OPEN') continue;
      const responsible =
        node.author?.login.toLowerCase() === viewer ||
        node.assignees.nodes.some((actor) => actor?.login.toLowerCase() === viewer);
      const replies: GitHubWorkReply[] = [];
      const general = pendingReply(node.comments, viewer, responsible, item, 'conversation');
      if (general) replies.push(general);
      incomplete ||=
        !!node.comments.pageInfo.hasPreviousPage ||
        !!node.assignees.pageInfo.hasNextPage ||
        !!node.reviewThreads?.pageInfo.hasNextPage;
      for (const thread of node.reviewThreads?.nodes || []) {
        if (!thread) {
          incomplete = true;
          continue;
        }
        if (thread.isResolved) continue;
        incomplete ||= !!thread.comments.pageInfo.hasPreviousPage;
        const reply = pendingReply(thread.comments, viewer, responsible, item, 'review');
        if (reply) replies.push({ ...reply, threadId: thread.id });
      }
      replies.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      if (replies.length)
        result.push({
          ...item,
          categories: ['awaiting_reply'],
          replies,
          updatedAt: replies[0].createdAt,
        });
    }
  }
  return { items: result, incomplete };
}
