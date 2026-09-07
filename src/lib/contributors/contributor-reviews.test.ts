import { describe, it, expect } from 'vitest';
import {
  buildContributorReviews,
  countContributorReviews,
  DEFAULT_REVIEW_FILTERS,
  filterContributorReviews,
  hasFeedback,
  pickReviewForComment,
  reviewRepositories,
  isOwnPullRequest,
  pullRequestUrl,
  reviewUrl,
  type ContributorReviewComment,
  type ContributorReviewSummary,
} from './contributor-reviews';

const repository = { owner: 'acme', name: 'widgets', full_name: 'acme/widgets' };

function summary(
  overrides: Partial<ContributorReviewSummary> & { id: string; submitted_at: string }
): ContributorReviewSummary {
  return {
    github_id: overrides.id,
    state: 'COMMENTED',
    body: '',
    commit_id: null,
    pull_request: {
      id: 'pr-1',
      number: 1,
      title: 'Add widgets',
      html_url: 'https://github.com/acme/widgets/pull/1',
      state: 'open',
      author_login: 'author',
    },
    repository,
    is_own_pr: false,
    ...overrides,
  };
}

function comment(
  overrides: Partial<ContributorReviewComment> & { id: string; created_at: string }
): ContributorReviewComment {
  return {
    github_id: overrides.id,
    body: 'nit',
    path: 'src/a.ts',
    diff_hunk: null,
    position: 1,
    original_position: 1,
    commit_id: null,
    in_reply_to_id: null,
    updated_at: overrides.created_at,
    pull_request_id: 'pr-1',
    ...overrides,
  };
}

describe('pickReviewForComment', () => {
  it('prefers the earliest review submitted at or after the comment', () => {
    const early = summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z' });
    const late = summary({ id: 'r2', submitted_at: '2026-01-01T12:00:00Z' });
    const picked = pickReviewForComment(
      [late, early],
      comment({ id: 'c1', created_at: '2026-01-01T11:00:00Z' })
    );
    expect(picked?.id).toBe('r2');
  });

  it('falls back to the latest review when the comment is newer than all reviews', () => {
    const early = summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z' });
    const late = summary({ id: 'r2', submitted_at: '2026-01-01T12:00:00Z' });
    const picked = pickReviewForComment(
      [early, late],
      comment({ id: 'c1', created_at: '2026-01-02T00:00:00Z' })
    );
    expect(picked?.id).toBe('r2');
  });

  it('prefers a review on the same commit over a closer one on another commit', () => {
    const other = summary({ id: 'r1', submitted_at: '2026-01-01T10:30:00Z', commit_id: 'aaa' });
    const same = summary({ id: 'r2', submitted_at: '2026-01-01T18:00:00Z', commit_id: 'bbb' });
    const picked = pickReviewForComment(
      [other, same],
      comment({ id: 'c1', created_at: '2026-01-01T10:00:00Z', commit_id: 'bbb' })
    );
    expect(picked?.id).toBe('r2');
  });

  it('returns undefined with no reviews', () => {
    expect(
      pickReviewForComment([], comment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' }))
    ).toBeUndefined();
  });
});

describe('buildContributorReviews', () => {
  it('nests comments under the matching review, newest review first', () => {
    const r1 = summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z' });
    const r2 = summary({ id: 'r2', submitted_at: '2026-01-03T10:00:00Z' });
    const comments = [
      comment({ id: 'c2', created_at: '2026-01-03T09:30:00Z' }),
      comment({ id: 'c1', created_at: '2026-01-03T09:00:00Z' }),
      comment({ id: 'c0', created_at: '2026-01-01T09:00:00Z' }),
    ];

    const reviews = buildContributorReviews([r1, r2], comments);

    expect(reviews.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(reviews[0].comments.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(reviews[1].comments.map((c) => c.id)).toEqual(['c0']);
  });

  it('drops comments whose pull request has no review by this contributor', () => {
    const r1 = summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z' });
    const stray = comment({
      id: 'c9',
      created_at: '2026-01-01T09:00:00Z',
      pull_request_id: 'pr-other',
    });

    const reviews = buildContributorReviews([r1], [stray]);

    expect(reviews[0].comments).toEqual([]);
  });
});

describe('countContributorReviews', () => {
  it('tallies states and inline comments', () => {
    const reviews = buildContributorReviews(
      [
        summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z', state: 'APPROVED' }),
        summary({ id: 'r2', submitted_at: '2026-01-02T10:00:00Z', state: 'CHANGES_REQUESTED' }),
        summary({ id: 'r3', submitted_at: '2026-01-03T10:00:00Z', state: 'COMMENTED' }),
      ],
      [
        comment({ id: 'c1', created_at: '2026-01-03T09:00:00Z' }),
        comment({ id: 'c2', created_at: '2026-01-03T09:10:00Z' }),
      ]
    );

    expect(countContributorReviews(reviews)).toEqual({
      total: 3,
      approved: 1,
      changesRequested: 1,
      commented: 1,
      inlineComments: 2,
      ownPullRequests: 0,
      othersPullRequests: 3,
    });
  });

  it('separates reviews on own pull requests from reviews on others', () => {
    const reviews = buildContributorReviews(
      [
        summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z', is_own_pr: true }),
        summary({ id: 'r2', submitted_at: '2026-01-02T10:00:00Z' }),
      ],
      []
    );
    const counts = countContributorReviews(reviews);
    expect(counts.ownPullRequests).toBe(1);
    expect(counts.othersPullRequests).toBe(1);
  });
});

describe('isOwnPullRequest', () => {
  it('matches the reviewer to the PR author case-insensitively', () => {
    expect(isOwnPullRequest('BDougie', 'bdougie')).toBe(true);
    expect(isOwnPullRequest('bdougie', 'jpmcb')).toBe(false);
    expect(isOwnPullRequest('bdougie', null)).toBe(false);
  });
});

describe('review links', () => {
  it('derives the PR link from repository and number when html_url is empty', () => {
    const review = summary({
      id: 'r1',
      submitted_at: '2026-01-01T10:00:00Z',
      pull_request: {
        id: 'pr-1',
        number: 42,
        title: 'x',
        html_url: null,
        state: 'open',
        author_login: null,
      },
    });
    expect(pullRequestUrl(review)).toBe('https://github.com/acme/widgets/pull/42');
    expect(reviewUrl(review)).toBe('https://github.com/acme/widgets/pull/42#pullrequestreview-r1');
  });

  it('prefers the stored html_url when present', () => {
    const review = summary({ id: 'r1', submitted_at: '2026-01-01T10:00:00Z' });
    expect(reviewUrl(review)).toBe('https://github.com/acme/widgets/pull/1#pullrequestreview-r1');
  });
});

describe('filterContributorReviews', () => {
  const approvedEmpty = {
    ...summary({ id: 'a', submitted_at: '2026-01-01T00:00:00Z', state: 'APPROVED' }),
    comments: [],
  };
  const approvedWithBody = {
    ...summary({
      id: 'b',
      submitted_at: '2026-01-02T00:00:00Z',
      state: 'APPROVED',
      body: 'LGTM but check x',
    }),
    comments: [],
  };
  const commentedInline = {
    ...summary({ id: 'c', submitted_at: '2026-01-03T00:00:00Z', is_own_pr: true }),
    comments: [comment({ id: 'c1', created_at: '2026-01-03T00:00:00Z' })],
  };
  const otherRepo = {
    ...summary({
      id: 'd',
      submitted_at: '2026-01-04T00:00:00Z',
      repository: { owner: 'acme', name: 'gears', full_name: 'acme/gears' },
    }),
    comments: [],
  };
  const all = [approvedEmpty, approvedWithBody, commentedInline, otherRepo];

  it('returns everything with default filters', () => {
    expect(filterContributorReviews(all, DEFAULT_REVIEW_FILTERS)).toHaveLength(4);
  });

  it('keeps only reviews with a body or inline comments when feedbackOnly is set', () => {
    const kept = filterContributorReviews(all, { ...DEFAULT_REVIEW_FILTERS, feedbackOnly: true });
    expect(kept.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('filters by state, ownership, and repository', () => {
    expect(
      filterContributorReviews(all, { ...DEFAULT_REVIEW_FILTERS, state: 'APPROVED' }).map(
        (r) => r.id
      )
    ).toEqual(['a', 'b']);
    expect(
      filterContributorReviews(all, { ...DEFAULT_REVIEW_FILTERS, ownership: 'own' }).map(
        (r) => r.id
      )
    ).toEqual(['c']);
    expect(
      filterContributorReviews(all, { ...DEFAULT_REVIEW_FILTERS, ownership: 'others' })
    ).toHaveLength(3);
    expect(
      filterContributorReviews(all, { ...DEFAULT_REVIEW_FILTERS, repository: 'acme/gears' }).map(
        (r) => r.id
      )
    ).toEqual(['d']);
  });

  it('treats whitespace-only bodies as no feedback', () => {
    expect(hasFeedback({ ...approvedEmpty, body: '   ' })).toBe(false);
  });

  it('lists distinct repositories in first-seen order', () => {
    expect(reviewRepositories(all)).toEqual(['acme/widgets', 'acme/gears']);
  });
});
