import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase-lazy';
import {
  buildContributorReviews,
  isOwnPullRequest,
  type ContributorReview,
  type ContributorReviewComment,
  type ContributorReviewSummary,
  type ReviewState,
} from '@/lib/contributors/contributor-reviews';

/** Supabase caps a single response at this many rows. */
const PAGE_SIZE = 1000;
/** Keeps the `in` filter on pull request ids well under URL length limits. */
const ID_CHUNK_SIZE = 200;

interface ReviewRow {
  id: string;
  github_id: number | string;
  state: string;
  body: string | null;
  submitted_at: string;
  commit_id: string | null;
  pull_requests: {
    id: string;
    number: number;
    title: string;
    html_url: string | null;
    state: string;
    repository_id: string;
    author: { username: string } | null;
    repositories: { owner: string; name: string; full_name: string } | null;
  } | null;
}

interface ReviewCommentRow {
  id: string;
  github_id: number | string;
  body: string;
  path: string | null;
  diff_hunk: string | null;
  position: number | null;
  original_position: number | null;
  commit_id: string | null;
  in_reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  pull_request_id: string;
}

/**
 * Reads every page of a query built by `buildPage`, stopping on a short page.
 */
async function fetchAllPages<Row>(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Row[] | null; error: PostgrestError | null }>
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toSummary(row: ReviewRow, reviewerLogin: string): ContributorReviewSummary | null {
  const pr = row.pull_requests;
  if (!pr || !pr.repositories) return null;
  return {
    id: row.id,
    github_id: String(row.github_id),
    state: row.state as ReviewState,
    body: row.body ?? '',
    submitted_at: row.submitted_at,
    commit_id: row.commit_id,
    pull_request: {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      html_url: pr.html_url,
      state: pr.state,
      author_login: pr.author?.username ?? null,
    },
    repository: {
      owner: pr.repositories.owner,
      name: pr.repositories.name,
      full_name: pr.repositories.full_name,
    },
    is_own_pr: isOwnPullRequest(reviewerLogin, pr.author?.username ?? null),
  };
}

function toComment(row: ReviewCommentRow): ContributorReviewComment {
  return {
    id: row.id,
    github_id: String(row.github_id),
    body: row.body,
    path: row.path,
    diff_hunk: row.diff_hunk,
    position: row.position,
    original_position: row.original_position,
    commit_id: row.commit_id,
    in_reply_to_id: row.in_reply_to_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    pull_request_id: row.pull_request_id,
  };
}

/**
 * Loads every review and inline review comment a contributor authored across
 * a workspace's tracked repositories. Returns an empty list when the
 * contributor or workspace repositories cannot be found.
 */
export async function fetchContributorReviews(
  contributorUsername: string,
  workspaceId: string
): Promise<ContributorReview[]> {
  const supabase = await getSupabase();

  const { data: contributor, error: contributorError } = await supabase
    .from('contributors')
    .select('id')
    .eq('username', contributorUsername)
    .maybeSingle();
  if (contributorError) throw contributorError;
  if (!contributor) return [];

  const { data: workspaceRepos, error: reposError } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);
  if (reposError) throw reposError;
  const repoIds = (workspaceRepos ?? []).map((row) => row.repository_id);
  if (repoIds.length === 0) return [];

  const reviewRows = await fetchAllPages<ReviewRow>((from, to) =>
    supabase
      .from('reviews')
      .select(
        `
        id,
        github_id,
        state,
        body,
        submitted_at,
        commit_id,
        pull_requests!inner(
          id,
          number,
          title,
          html_url,
          state,
          repository_id,
          author:contributors!author_id(username),
          repositories!inner(owner, name, full_name)
        )
      `
      )
      .eq('author_id', contributor.id)
      .in('pull_requests.repository_id', repoIds)
      .order('submitted_at', { ascending: false })
      .range(from, to)
      .returns<ReviewRow[]>()
  );

  const summaries = reviewRows
    .map((row) => toSummary(row, contributorUsername))
    .filter((summary): summary is ContributorReviewSummary => summary !== null);

  const pullRequestIds = [...new Set(summaries.map((summary) => summary.pull_request.id))];
  const commentRows: ReviewCommentRow[] = [];
  for (const ids of chunk(pullRequestIds, ID_CHUNK_SIZE)) {
    const rows = await fetchAllPages<ReviewCommentRow>((from, to) =>
      supabase
        .from('comments')
        .select(
          `
          id,
          github_id,
          body,
          path,
          diff_hunk,
          position,
          original_position,
          commit_id,
          in_reply_to_id,
          created_at,
          updated_at,
          pull_request_id
        `
        )
        .eq('commenter_id', contributor.id)
        .eq('comment_type', 'review_comment')
        .in('pull_request_id', ids)
        .order('created_at', { ascending: true })
        .range(from, to)
        .returns<ReviewCommentRow[]>()
    );
    commentRows.push(...rows);
  }

  return buildContributorReviews(summaries, commentRows.map(toComment));
}
