/**
 * Shapes for one contributor's review history, plus the pure logic that joins
 * review summaries with their inline review comments.
 *
 * GitHub does not expose a review id on stored review comments, so comments are
 * attached to a review on the same pull request by commit and submission time.
 */

export type ReviewState = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';

export interface ContributorReviewComment {
  id: string;
  github_id: string;
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

export interface ContributorReviewPullRequest {
  id: string;
  number: number;
  title: string;
  html_url: string | null;
  state: string;
  author_login: string | null;
}

export interface ContributorReviewRepository {
  owner: string;
  name: string;
  full_name: string;
}

export interface ContributorReview {
  id: string;
  github_id: string;
  state: ReviewState;
  body: string;
  submitted_at: string;
  commit_id: string | null;
  pull_request: ContributorReviewPullRequest;
  repository: ContributorReviewRepository;
  comments: ContributorReviewComment[];
}

/** A review summary before its inline comments are attached. */
export type ContributorReviewSummary = Omit<ContributorReview, 'comments'>;

function timestamp(value: string): number {
  return new Date(value).getTime();
}

/**
 * Picks the review a comment most plausibly belongs to.
 *
 * Reviews on the same commit are preferred. Within the candidates, the earliest
 * review submitted at or after the comment wins, because batched review
 * comments are created while drafting and the review is submitted afterwards.
 * If the comment is later than every review, the latest review is used.
 */
export function pickReviewForComment(
  reviews: ContributorReviewSummary[],
  comment: ContributorReviewComment
): ContributorReviewSummary | undefined {
  if (reviews.length === 0) return undefined;

  const sameCommit = comment.commit_id
    ? reviews.filter((review) => review.commit_id === comment.commit_id)
    : [];
  const candidates = sameCommit.length > 0 ? sameCommit : reviews;
  const createdAt = timestamp(comment.created_at);

  const sorted = [...candidates].sort(
    (a, b) => timestamp(a.submitted_at) - timestamp(b.submitted_at)
  );
  const submittedAfter = sorted.find((review) => timestamp(review.submitted_at) >= createdAt);

  return submittedAfter ?? sorted[sorted.length - 1];
}

/**
 * Joins review summaries with inline comments, newest review first.
 * Comments inside a review keep creation order.
 */
export function buildContributorReviews(
  summaries: ContributorReviewSummary[],
  comments: ContributorReviewComment[]
): ContributorReview[] {
  const byPullRequest = new Map<string, ContributorReviewSummary[]>();
  for (const summary of summaries) {
    const list = byPullRequest.get(summary.pull_request.id) ?? [];
    list.push(summary);
    byPullRequest.set(summary.pull_request.id, list);
  }

  const commentsByReview = new Map<string, ContributorReviewComment[]>();
  for (const comment of comments) {
    const candidates = byPullRequest.get(comment.pull_request_id) ?? [];
    const review = pickReviewForComment(candidates, comment);
    if (!review) continue;
    const list = commentsByReview.get(review.id) ?? [];
    list.push(comment);
    commentsByReview.set(review.id, list);
  }

  return summaries
    .map((summary) => ({
      ...summary,
      comments: (commentsByReview.get(summary.id) ?? []).sort(
        (a, b) => timestamp(a.created_at) - timestamp(b.created_at)
      ),
    }))
    .sort((a, b) => timestamp(b.submitted_at) - timestamp(a.submitted_at));
}

export interface ContributorReviewCounts {
  total: number;
  approved: number;
  changesRequested: number;
  commented: number;
  inlineComments: number;
}

export function countContributorReviews(reviews: ContributorReview[]): ContributorReviewCounts {
  return reviews.reduce<ContributorReviewCounts>(
    (counts, review) => {
      counts.total += 1;
      if (review.state === 'APPROVED') counts.approved += 1;
      if (review.state === 'CHANGES_REQUESTED') counts.changesRequested += 1;
      if (review.state === 'COMMENTED') counts.commented += 1;
      counts.inlineComments += review.comments.length;
      return counts;
    },
    { total: 0, approved: 0, changesRequested: 0, commented: 0, inlineComments: 0 }
  );
}
