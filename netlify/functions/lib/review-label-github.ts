import type { ReviewComment, ReviewHunk, ReviewPR } from '../../../src/types/review-labels';

export interface GitHubPerson {
  id: number;
  login: string;
  type?: string;
}
interface Pull {
  number: number;
  title: string;
  user: GitHubPerson;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  head: { sha: string };
}
export interface InlineComment {
  id: number;
  user: GitHubPerson;
  body: string;
  path: string;
  diff_hunk: string;
  created_at: string;
  html_url: string;
  in_reply_to_id?: number;
  original_commit_id: string;
  original_line: number | null;
  pull_request_review_id: number;
}
export interface PullReview {
  id: number;
  user: GitHubPerson;
  state: string;
  body: string | null;
  submitted_at: string;
  html_url: string;
}
interface IssueComment {
  user: GitHubPerson;
}
interface PullFile {
  filename: string;
  patch?: string;
}
interface Thread {
  isResolved: boolean;
  isOutdated: boolean;
  comments: { nodes: { databaseId: number }[] };
}
interface ThreadResponse {
  data?: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: Thread[];
          pageInfo: { hasNextPage: boolean; endCursor: string };
        };
      };
    };
  };
  errors?: { message: string }[];
}

export async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub access is not configured on the server');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'contributor-info-review-labels',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`GitHub request failed (${response.status}). Please try again later.`);
  return response.json() as Promise<T>;
}

async function allPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await github<T[]>(`${path}?per_page=100&page=${page}`);
    rows.push(...batch);
    if (batch.length < 100) return rows;
    // Stop with an error rather than presenting a truncated snapshot as complete.
    if (page >= 100)
      throw new Error('This PR exceeds the capture limit; its review was not imported');
  }
}

export function splitHunks(path: string, patch: string, prefix: string): ReviewHunk[] {
  if (!/\.(go|rs)$/.test(path)) return [];
  return patch
    .split(/(?=^@@ )/m)
    .filter((diff) => diff.startsWith('@@ '))
    .map((diff, index) => ({
      id: `${prefix}:${index}`,
      path,
      language: path.endsWith('.go') ? 'Go' : 'Rust',
      startLine: Number(diff.match(/^@@ -\d+(?:,\d+)? \+(\d+)/)?.[1] || 1),
      diff,
    }));
}

export function participation(
  githubId: string,
  author: GitHubPerson,
  reviews: PullReview[],
  comments: InlineComment[],
  discussion: IssueComment[]
): string | null {
  const matches = (person: GitHubPerson) => String(person.id) === githubId;
  if (matches(author)) return 'You authored this PR';
  if (reviews.some((r) => matches(r.user))) return 'You reviewed this PR';
  if (comments.some((c) => matches(c.user)) || discussion.some((c) => matches(c.user)))
    return 'You commented on this PR';
  return null;
}

export function buildComments(
  comments: InlineComment[],
  reviews: PullReview[],
  threads: Map<number, { isResolved: boolean; isOutdated: boolean }>
): { hunks: ReviewHunk[]; comments: ReviewComment[] } {
  const hunks: ReviewHunk[] = [];
  const result: ReviewComment[] = [];
  for (const comment of comments) {
    if (comment.in_reply_to_id || !comment.diff_hunk || !/\.(go|rs)$/.test(comment.path)) continue;
    const hunk: ReviewHunk = {
      id: `comment:${comment.id}`,
      path: comment.path,
      language: comment.path.endsWith('.go') ? 'Go' : 'Rust',
      startLine: Number(comment.diff_hunk.match(/^@@ -\d+(?:,\d+)? \+(\d+)/)?.[1] || 1),
      diff: comment.diff_hunk,
    };
    hunks.push(hunk);
    const thread = threads.get(comment.id);
    result.push({
      id: String(comment.id),
      author: comment.user.login,
      authorId: String(comment.user.id),
      isBot: comment.user.type === 'Bot',
      body: comment.body,
      url: comment.html_url,
      hunkId: hunk.id,
      commitId: comment.original_commit_id,
      originalLine: comment.original_line,
      replies: comments
        .filter((reply) => reply.in_reply_to_id === comment.id)
        .map((reply) => ({
          author: reply.user.login,
          body: reply.body,
          time: reply.created_at,
          url: reply.html_url,
        })),
      resolved: thread?.isResolved ?? null,
      outdated: thread?.isOutdated ?? null,
      laterApprovals: reviews
        .filter(
          (review) =>
            review.state === 'APPROVED' &&
            !review.body?.trim() &&
            review.submitted_at > comment.created_at &&
            !comments.some((inline) => inline.pull_request_review_id === review.id)
        )
        .map((review) => ({
          author: review.user.login,
          body: review.body ?? '',
          time: review.submitted_at,
          url: review.html_url,
        })),
    });
  }
  const evidencePriority = (comment: ReviewComment) =>
    Number(
      comment.isBot &&
        (comment.replies.length > 0 || comment.resolved || comment.laterApprovals.length > 0)
    );
  return { hunks, comments: result.sort((a, b) => evidencePriority(b) - evidencePriority(a)) };
}

async function reviewThreads(
  repo: string,
  number: number
): Promise<Map<number, { isResolved: boolean; isOutdated: boolean }>> {
  const [owner, name] = repo.split('/');
  const result = new Map<number, { isResolved: boolean; isOutdated: boolean }>();
  let after: string | null = null;
  for (;;) {
    const response: ThreadResponse = await github<ThreadResponse>('/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$after){nodes{isResolved isOutdated comments(first:1){nodes{databaseId}}} pageInfo{hasNextPage endCursor}}}}}`,
        variables: { owner, name, number, after },
      }),
    });
    if (response.errors?.length || !response.data)
      throw new Error('Review thread context could not be loaded. Please retry.');
    const connection: NonNullable<
      ThreadResponse['data']
    >['repository']['pullRequest']['reviewThreads'] =
      response.data.repository.pullRequest.reviewThreads;
    for (const thread of connection.nodes) {
      const id = thread.comments.nodes[0]?.databaseId;
      if (id) result.set(id, { isResolved: thread.isResolved, isOutdated: thread.isOutdated });
    }
    if (!connection.pageInfo.hasNextPage) return result;
    after = connection.pageInfo.endCursor;
  }
}

// Creation order over ALL PRs stays stable as open PRs close. No search API's
// 1,000-result ceiling, time-window truncation, or advancing past a failed import.
export async function captureNextPR(
  repo: string,
  page: number,
  cutoff: string,
  reviewerId: string
): Promise<{
  finished: boolean;
  pr: Omit<ReviewPR, 'id'> | null;
}> {
  const meta = await github<{ private: boolean }>(`/repos/${repo}`);
  if (meta.private) throw new Error('Private repositories require a separate access rollout');
  const pulls = await github<Pull[]>(
    `/repos/${repo}/pulls?state=all&sort=created&direction=asc&per_page=1&page=${page}`
  );
  const pull = pulls[0];
  if (!pull || new Date(pull.created_at) > new Date(cutoff)) return { finished: true, pr: null };
  if (!pull.closed_at || new Date(pull.closed_at) > new Date(cutoff))
    return { finished: false, pr: null };
  const [reviews, comments, discussion] = await Promise.all([
    allPages<PullReview>(`/repos/${repo}/pulls/${pull.number}/reviews`),
    allPages<InlineComment>(`/repos/${repo}/pulls/${pull.number}/comments`),
    allPages<IssueComment>(`/repos/${repo}/issues/${pull.number}/comments`),
  ]);
  const role = participation(reviewerId, pull.user, reviews, comments, discussion);
  if (!role) return { finished: false, pr: null };
  const [files, threads] = await Promise.all([
    allPages<PullFile>(`/repos/${repo}/pulls/${pull.number}/files`),
    reviewThreads(repo, pull.number),
  ]);
  // REST caps the files endpoint at 3,000 even when there are more files.
  if (files.length >= 3000)
    throw new Error('This PR exceeds GitHub’s file limit; its review was not imported');
  const inline = buildComments(comments, reviews, threads);
  const hunks = [
    ...inline.hunks,
    ...files.flatMap((file) =>
      splitHunks(file.filename, file.patch || '', `file:${file.filename}`)
    ),
  ];
  if (!hunks.length) return { finished: false, pr: null };
  return {
    finished: false,
    pr: {
      repo,
      number: pull.number,
      title: pull.title,
      author: pull.user.login,
      url: pull.html_url,
      closedAt: pull.closed_at,
      headSha: pull.head.sha,
      participation: role,
      hunks,
      comments: inline.comments,
      unavailableFiles: files
        .filter((file) => /\.(go|rs)$/.test(file.filename) && !file.patch)
        .map((file) => file.filename),
    },
  };
}
