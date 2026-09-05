import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase-lazy', () => ({ getSupabase: vi.fn() }));
import { inboxError, toWorkSnapshot, WorkInboxUnavailableError } from '../work-inbox';
import type { GitHubWorkItem } from '@/lib/workspace/github-my-work';

const item: GitHubWorkItem = {
  id: 123,
  nodeId: 'PR_123',
  number: 12,
  repository: 'papercomputeco/tapes',
  type: 'pr',
  url: 'https://github.com/papercomputeco/tapes/pull/12',
  title: 'Update docs',
  author: 'author',
  updatedAt: '2026-09-05T00:00:00Z',
  categories: ['review_requested'],
};
describe('Workspace inbox availability', () => {
  it.each(['PGRST202', '42P01'])('classifies missing database setup (%s) separately', (code) => {
    expect(inboxError({ code, message: 'Missing database object' })).toBeInstanceOf(
      WorkInboxUnavailableError
    );
  });
  it('preserves other failures as errors', () => {
    const error = inboxError({ code: '42501', message: 'Permission denied' });
    expect(error).not.toBeInstanceOf(WorkInboxUnavailableError);
    expect(error.message).toBe('Permission denied');
  });
});
describe('Account-wide work identity', () => {
  it('does not duplicate the same item from overlapping workspaces', () => {
    expect(toWorkSnapshot([item, item], 'review_requested')).toHaveLength(1);
  });
  it('does not treat unrelated PR updates as new review requests', () => {
    const first = toWorkSnapshot([item], 'review_requested')[0];
    const next = toWorkSnapshot(
      [{ ...item, updatedAt: '2026-09-06T00:00:00Z' }],
      'review_requested'
    )[0];
    expect(next.source_version).toBe(first.source_version);
    expect(next.subject_key).toBe(first.subject_key);
  });
  it('keeps a stable thread identity but changes the event for a new comment', () => {
    const reply = {
      threadId: 'THREAD_1',
      author: 'reviewer',
      body: 'Question',
      url: `${item.url}#discussion_r1`,
      createdAt: item.updatedAt,
      kind: 'review' as const,
    };
    const first = toWorkSnapshot([{ ...item, replies: [reply] }], 'awaiting_reply')[0];
    const next = toWorkSnapshot(
      [{ ...item, replies: [{ ...reply, url: `${item.url}#discussion_r2` }] }],
      'awaiting_reply'
    )[0];
    expect(next.subject_key).toBe(first.subject_key);
    expect(next.source_version).not.toBe(first.source_version);
  });
  it('keeps general comments and separate review threads distinct', () => {
    const reply = {
      author: 'reviewer',
      body: 'Question',
      url: `${item.url}#discussion_r1`,
      createdAt: item.updatedAt,
    };
    expect(
      toWorkSnapshot(
        [
          {
            ...item,
            replies: [
              { ...reply, kind: 'conversation' },
              { ...reply, kind: 'review', threadId: 'THREAD_1' },
              { ...reply, kind: 'review', threadId: 'THREAD_2' },
            ],
          },
        ],
        'awaiting_reply'
      )
    ).toHaveLength(3);
  });
});
