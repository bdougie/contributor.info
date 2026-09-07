/**
 * Unit tests for contributor review exports.
 * Pure transforms only; the download helper is covered by csv-export.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  transformContributorReviewsToCSV,
  transformContributorReviewsToRecords,
  serializeContributorReviewsToJSONL,
  serializeReviewCorpusToJSONL,
  transformReviewCorpusToCSV,
  generateExportFilename,
} from '../csv-export';
import type { ContributorReview } from '@/lib/contributors/contributor-reviews';

const review: ContributorReview = {
  id: 'r1',
  github_id: '111',
  state: 'CHANGES_REQUESTED',
  body: 'Please add a test',
  submitted_at: '2026-01-03T10:00:00Z',
  commit_id: 'abc123',
  pull_request: {
    id: 'pr-1',
    number: 42,
    title: 'Add widgets',
    html_url: 'https://github.com/acme/widgets/pull/42',
    state: 'open',
    author_login: 'author',
  },
  repository: { owner: 'acme', name: 'widgets', full_name: 'acme/widgets' },
  comments: [
    {
      id: 'c1',
      github_id: '222',
      body: 'nit: rename',
      path: 'src/a.ts',
      diff_hunk: '@@ -1 +1 @@',
      position: 3,
      original_position: 3,
      commit_id: 'abc123',
      in_reply_to_id: null,
      created_at: '2026-01-03T09:00:00Z',
      updated_at: '2026-01-03T09:00:00Z',
      pull_request_id: 'pr-1',
    },
  ],
};

describe('transformContributorReviewsToCSV', () => {
  it('flattens one row per review with a comment count', () => {
    const rows = transformContributorReviewsToCSV('reviewer', [review]);
    expect(rows).toEqual([
      {
        Reviewer: 'reviewer',
        Repository: 'acme/widgets',
        'PR Number': 42,
        'PR Title': 'Add widgets',
        'PR Author': 'author',
        'PR URL': 'https://github.com/acme/widgets/pull/42',
        'Review State': 'CHANGES_REQUESTED',
        'Submitted At': '2026-01-03T10:00:00Z',
        Commit: 'abc123',
        'Review Body': 'Please add a test',
        'Inline Comments': 1,
        'Review GitHub ID': '111',
      },
    ]);
  });

  it('writes empty strings for missing optional fields', () => {
    const rows = transformContributorReviewsToCSV('reviewer', [
      {
        ...review,
        commit_id: null,
        pull_request: { ...review.pull_request, html_url: null, author_login: null },
      },
    ]);
    expect(rows[0]['PR URL']).toBe('');
    expect(rows[0]['PR Author']).toBe('');
    expect(rows[0].Commit).toBe('');
  });
});

describe('transformContributorReviewsToRecords', () => {
  it('nests inline comments with their diff context', () => {
    const [record] = transformContributorReviewsToRecords('reviewer', [review]);
    expect(record.reviewer).toBe('reviewer');
    expect(record.repository).toBe('acme/widgets');
    expect(record.pull_request).toEqual({
      number: 42,
      title: 'Add widgets',
      url: 'https://github.com/acme/widgets/pull/42',
      state: 'open',
      author: 'author',
    });
    expect(record.comments).toEqual([
      {
        github_id: '222',
        path: 'src/a.ts',
        position: 3,
        original_position: 3,
        commit_id: 'abc123',
        in_reply_to_id: null,
        diff_hunk: '@@ -1 +1 @@',
        body: 'nit: rename',
        created_at: '2026-01-03T09:00:00Z',
      },
    ]);
  });
});

describe('serializeContributorReviewsToJSONL', () => {
  it('emits one JSON object per line with no trailing newline', () => {
    const second = { ...review, id: 'r2', github_id: '333', comments: [] };
    const jsonl = serializeContributorReviewsToJSONL('reviewer', [review, second]);
    const lines = jsonl.split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).review_github_id).toBe('111');
    expect(JSON.parse(lines[1]).review_github_id).toBe('333');
    expect(JSON.parse(lines[1]).comments).toEqual([]);
  });

  it('returns an empty string for no reviews', () => {
    expect(serializeContributorReviewsToJSONL('reviewer', [])).toBe('');
  });
});

describe('generateExportFilename', () => {
  it('supports a jsonl extension and keeps csv as the default', () => {
    expect(generateExportFilename('Octo Cat', 'reviews', 'jsonl')).toMatch(
      /^octo-cat_reviews_\d{4}-\d{2}-\d{2}\.jsonl$/
    );
    expect(generateExportFilename('Octo Cat', 'reviews')).toMatch(/\.csv$/);
  });
});

describe('review corpus export', () => {
  it('concatenates every reviewer into one JSONL stream, skipping empty reviewers', () => {
    const second = { ...review, id: 'r2', github_id: '333', comments: [] };
    const jsonl = serializeReviewCorpusToJSONL([
      { reviewer: 'alice', reviews: [review] },
      { reviewer: 'nobody', reviews: [] },
      { reviewer: 'bob', reviews: [second] },
    ]);
    const records = jsonl.split('\n').map((line) => JSON.parse(line));

    expect(records.map((r) => r.reviewer)).toEqual(['alice', 'bob']);
    expect(records.map((r) => r.review_github_id)).toEqual(['111', '333']);
  });

  it('flattens every reviewer into one CSV row set with the reviewer column', () => {
    const rows = transformReviewCorpusToCSV([
      { reviewer: 'alice', reviews: [review] },
      { reviewer: 'bob', reviews: [review] },
    ]);

    expect(rows.map((r) => r.Reviewer)).toEqual(['alice', 'bob']);
  });
});
