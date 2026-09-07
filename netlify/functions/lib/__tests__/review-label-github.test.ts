import { describe, it, expect } from 'vitest';
import {
  buildComments,
  participation,
  splitHunks,
  type InlineComment,
  type PullReview,
} from '../review-label-github';
import { reviewInvitePath } from '../../../../src/types/review-labels';
import { redactReviewInviteTokens } from '../../../../src/lib/review-labels-privacy';

const human = { id: 22, login: 'jpmcb', type: 'User' };
const bot = { id: 44, login: 'greptile[bot]', type: 'Bot' };
const inline: InlineComment = {
  id: 10,
  user: bot,
  body: 'Check `close(done)`.\nKeep the second line.',
  path: 'main.go',
  diff_hunk: '@@ -10,1 +12,1 @@\n-close(done)\n+stop()',
  created_at: '2026-09-01T10:00:00Z',
  html_url: 'https://github.com/papercomputeco/tapes/pull/1#discussion_r10',
  original_commit_id: 'sha',
  original_line: 10,
  pull_request_review_id: 3,
};
const review: PullReview = {
  id: 4,
  user: human,
  state: 'APPROVED',
  body: '',
  submitted_at: '2026-09-01T12:00:00Z',
  html_url: 'https://github.com/papercomputeco/tapes/pull/1#pullrequestreview-4',
};

describe('Review-label source integrity', () => {
  it('requires actual participation by numeric ID, not a matching login or reviewer request', () => {
    expect(participation('22', human, [], [], [])).toBe('You authored this PR');
    expect(participation('22', bot, [review], [], [])).toBe('You reviewed this PR');
    expect(participation('22', bot, [], [], [{ user: human }])).toBe('You commented on this PR');
    expect(participation('999', human, [review], [inline], [])).toBeNull();
  });
  it('keeps both human and bot roots verbatim, with replies and silent approval evidence', () => {
    const reply = {
      ...inline,
      id: 11,
      user: human,
      body: 'This is already handled.',
      in_reply_to_id: 10,
      pull_request_review_id: 5,
    };
    const personComment = { ...inline, id: 12, user: human, body: 'Use sync.Once.' };
    const data = buildComments(
      [personComment, inline, reply],
      [review],
      new Map([[10, { isResolved: true, isOutdated: false }]])
    );
    expect(data.comments).toHaveLength(2);
    expect(data.comments[0].body).toBe(inline.body);
    expect(data.comments[0].resolved).toBe(true);
    expect(data.comments[0].replies[0].body).toBe(reply.body);
    expect(data.comments[0].laterApprovals[0].body).toBe('');
    expect(data.comments[1].isBot).toBe(false);
    expect(data.hunks.find((h) => h.id === data.comments[0].hunkId)?.diff).toBe(inline.diff_hunk);
  });
  it('does not claim a review containing inline comments was silent', () => {
    const data = buildComments(
      [inline, { ...inline, id: 12, user: human, pull_request_review_id: 4 }],
      [review],
      new Map()
    );
    expect(data.comments[0].laterApprovals).toEqual([]);
    expect(data.comments[0].resolved).toBeNull();
  });
  it('excludes unsupported files or missing hunks without inventing context', () => {
    expect(
      buildComments(
        [
          { ...inline, path: 'readme.md' },
          { ...inline, diff_hunk: '' },
        ],
        [],
        new Map()
      ).comments
    ).toEqual([]);
  });
  it('splits Go/Rust file patches and retains original line anchors and newlines', () => {
    const patch = '@@ -1 +3 @@\n-a\n+b\n@@ -30 +50 @@\n-c\n+d';
    const hunks = splitHunks('lib.rs', patch, 'file:lib.rs');
    expect(hunks.map((h) => h.startLine)).toEqual([3, 50]);
    expect(hunks.map((h) => h.diff).join('')).toBe(patch);
    expect(splitHunks('README.md', patch, 'readme')).toEqual([]);
  });
});
describe('Personal invite links', () => {
  it('ends in /invite and redacts the token from nested analytics properties', () => {
    const token = 'a'.repeat(64);
    const path = reviewInvitePath(token);
    expect(path).toBe(`/review-labels/${token}/invite`);
    const event = {
      properties: { $initial_current_url: `https://contributor.info${path}` },
      breadcrumbs: [{ message: path }],
    };
    const redacted = redactReviewInviteTokens(event);
    expect(JSON.stringify(redacted)).not.toContain(token);
    expect(redacted.breadcrumbs[0].message).toBe('/review-labels/[redacted]/invite');
    expect(event.breadcrumbs[0].message).toBe(path);
  });
});
