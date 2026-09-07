import type { GitHubWorkItem, GitHubWorkReply } from './github-my-work';
import { fetchWithTimeout } from '@/lib/utils/abort-signal';
import { isBot } from '@/lib/utils/bot-detection';
import { graphqlRateLimiter } from '@/lib/rate-limiter';
import { replySignal } from './reply-signals';

interface Actor {
  login: string;
  __typename?: string;
}

interface Comment {
  author: Actor | null;
  bodyText: string;
  body?: string;
  url: string;
  createdAt: string;
  kind?: GitHubWorkReply['kind'];
  reviewState?: string;
}

interface Review extends Omit<Comment, 'createdAt'> {
  id: string;
  state: string;
  submittedAt: string | null;
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
  reviews?: Connection<Review>;
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

const commentFields = `nodes { author { login __typename } body bodyText url createdAt }
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
      reviews(last: 50) {
        nodes { id author { login __typename } state body bodyText url submittedAt }
        pageInfo { hasPreviousPage }
      }
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

function isHuman(comment: Comment | null): comment is Comment & { author: Actor } {
  return (
    !!comment?.author && !isBot({ username: comment.author.login, type: comment.author.__typename })
  );
}

interface ReplyDecision {
  reply?: GitHubWorkReply;
  /** The visible comment window was too short to rule the conversation in or out. */
  uncertain: boolean;
}

function pendingReply(
  comments: Connection<Comment>,
  viewer: string,
  responsible: boolean,
  item: GitHubWorkItem,
  kind: GitHubWorkReply['kind']
): ReplyDecision {
  const humans = comments.nodes.filter(isHuman);
  const participated = humans.some((comment) => comment.author?.login.toLowerCase() === viewer);
  let uncertain = false;
  const seenAuthors = new Set<string>();
  for (const latest of [...humans].reverse()) {
    const author = latest.author.login.toLowerCase();
    if (author === viewer) return { uncertain };
    // An acknowledgment supersedes that author's request, not someone else's.
    if (seenAuthors.has(author)) continue;
    seenAuthors.add(author);
    const reason = replySignal(latest.body ?? latest.bodyText, {
      unresolvedThread: kind === 'review',
      changesRequested: latest.reviewState === 'CHANGES_REQUESTED',
    });
    if (!reason) continue;
    const mentions: string[] = latest.bodyText.toLowerCase().match(/@[a-z\d-]+/g) || [];
    if (!responsible && !participated && !mentions.includes(`@${viewer}`)) {
      // Comments before the window could show the viewer took part in this conversation.
      uncertain ||= !!comments.pageInfo.hasPreviousPage;
      continue;
    }
    // Only allow deep links into the item we requested, not arbitrary comment URLs.
    if (!latest.url.startsWith(`${item.url}#`)) continue;
    return {
      uncertain,
      reply: {
        author: latest.author.login,
        body: latest.bodyText.replace(/\s+/g, ' ').trim().slice(0, 280),
        url: latest.url,
        createdAt: latest.createdAt,
        kind: latest.kind ?? kind,
        reason,
      },
    };
  }
  return { uncertain: uncertain || !!comments.pageInfo.hasPreviousPage };
}

function generalConversation(node: Conversation): Connection<Comment> {
  // A later review from the same reviewer supersedes their earlier summary.
  // Inline threads retain their own resolution and reply boundaries.
  const latestReviews = new Map<string, Review>();
  for (const review of node.reviews?.nodes || []) {
    if (!review?.author || !review.submittedAt || review.state === 'PENDING') continue;
    const key = review.author.login.toLowerCase();
    const previous = latestReviews.get(key);
    if (!previous || Date.parse(review.submittedAt) >= Date.parse(previous.submittedAt!))
      latestReviews.set(key, review);
  }
  const summaries: Comment[] = [...latestReviews.values()]
    .filter((review) => review.state !== 'DISMISSED')
    .map((review) => ({
      ...review,
      createdAt: review.submittedAt!,
      kind: 'review_summary',
      reviewState: review.state,
    }));
  return {
    nodes: [...node.comments.nodes, ...summaries]
      .filter((comment): comment is Comment => !!comment)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    pageInfo: {
      hasPreviousPage:
        node.comments.pageInfo.hasPreviousPage || node.reviews?.pageInfo.hasPreviousPage,
    },
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
}): Promise<{ items: GitHubWorkItem[]; incomplete: boolean; incompleteRepositories: string[] }> {
  const result: GitHubWorkItem[] = [];
  const incompleteRepositories = new Set<string>();
  const markIncomplete = (item: GitHubWorkItem) => {
    incompleteRepositories.add(item.repository.toLowerCase());
  };
  for (const item of items) if (!item.nodeId) markIncomplete(item);
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
    if (errors?.length) batches[index].forEach(markIncomplete);
    const viewer = data.viewer.login.toLowerCase();
    for (const item of batches[index]) {
      const node = data.nodes.find((node) => node?.id === item.nodeId);
      if (!node?.comments || !node.assignees) {
        markIncomplete(item);
        continue;
      }
      // Recheck state after search, which can lag behind a close or merge.
      if (node.state !== 'OPEN') continue;
      const responsible =
        node.author?.login.toLowerCase() === viewer ||
        node.assignees.nodes.some((actor) => actor?.login.toLowerCase() === viewer);
      const replies: GitHubWorkReply[] = [];
      const general = pendingReply(
        generalConversation(node),
        viewer,
        responsible,
        item,
        'conversation'
      );
      if (general.reply) replies.push(general.reply);
      if (
        general.uncertain ||
        node.reviews?.pageInfo.hasPreviousPage ||
        node.assignees.pageInfo.hasNextPage ||
        node.reviewThreads?.pageInfo.hasNextPage
      )
        markIncomplete(item);
      for (const thread of node.reviewThreads?.nodes || []) {
        if (!thread) {
          markIncomplete(item);
          continue;
        }
        if (thread.isResolved) continue;
        const decision = pendingReply(thread.comments, viewer, responsible, item, 'review');
        if (decision.uncertain) markIncomplete(item);
        if (decision.reply) replies.push({ ...decision.reply, threadId: thread.id });
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
  return {
    items: result,
    incomplete: incompleteRepositories.size > 0,
    incompleteRepositories: [...incompleteRepositories].sort(),
  };
}
