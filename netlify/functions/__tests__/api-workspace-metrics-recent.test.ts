import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchRecentItems } from '../api-workspace-metrics';

interface RecentRowStub {
  number: number | null;
  title: string | null;
  html_url: string | null;
  created_at: string | null;
  contributors: { username: string | null } | { username: string | null }[] | null;
  repositories: { full_name: string | null } | { full_name: string | null }[] | null;
}

// Builds a supabase stub whose pull_requests / issues queries resolve to the
// given rows (or an error). Records the select column list per table so tests
// can pin the schema contract (the live issues table has no html_url column).
function stubSupabase(
  rowsByTable: Record<string, RecentRowStub[] | { error: string }>,
  selectsByTable: Record<string, string> = {}
): SupabaseClient {
  return {
    from(table: string) {
      const result = rowsByTable[table] ?? [];
      const resolved =
        'error' in result && !Array.isArray(result)
          ? { data: null, error: { message: result.error } }
          : { data: result, error: null };
      const chain = {
        select: vi.fn((columns: string) => {
          selectsByTable[table] = columns;
          return chain;
        }),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(resolved),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const prRow: RecentRowStub = {
  number: 1824,
  title: 'Import an org repos into a workspace',
  html_url: 'https://github.com/bdougie/contributor.info/pull/1824',
  created_at: '2026-07-13T10:00:00Z',
  contributors: { username: 'bdougie' },
  repositories: { full_name: 'bdougie/contributor.info' },
};

const issueRow: RecentRowStub = {
  number: 900,
  title: 'Tray shows stale metrics',
  html_url: null,
  created_at: '2026-07-12T09:00:00Z',
  contributors: [{ username: 'octocat' }],
  repositories: [{ full_name: 'bdougie/contributor.info' }],
};

describe('fetchRecentItems', () => {
  it('maps PR and issue rows to recent items', async () => {
    const supabase = stubSupabase({ pull_requests: [prRow], issues: [issueRow] });

    const { recent_open_prs, recent_open_issues } = await fetchRecentItems(supabase, ['repo-1']);

    expect(recent_open_prs).toEqual([
      {
        number: 1824,
        title: 'Import an org repos into a workspace',
        url: 'https://github.com/bdougie/contributor.info/pull/1824',
        author: 'bdougie',
        repo: 'bdougie/contributor.info',
        created_at: '2026-07-13T10:00:00Z',
      },
    ]);
    // Array-shaped joins are normalized, and a missing html_url falls back to a
    // URL built from the repo full_name and item number.
    expect(recent_open_issues).toEqual([
      {
        number: 900,
        title: 'Tray shows stale metrics',
        url: 'https://github.com/bdougie/contributor.info/issues/900',
        author: 'octocat',
        repo: 'bdougie/contributor.info',
        created_at: '2026-07-12T09:00:00Z',
      },
    ]);
  });

  it('builds a pull URL (not issues) when a PR row lacks html_url', async () => {
    const supabase = stubSupabase({
      pull_requests: [{ ...prRow, html_url: null }],
      issues: [],
    });

    const { recent_open_prs } = await fetchRecentItems(supabase, ['repo-1']);

    expect(recent_open_prs[0].url).toBe('https://github.com/bdougie/contributor.info/pull/1824');
  });

  it('drops rows that have no resolvable URL, title, or number', async () => {
    const supabase = stubSupabase({
      pull_requests: [
        { ...prRow, html_url: null, repositories: null }, // no URL derivable
        { ...prRow, title: null }, // no title
        { ...prRow, number: null, html_url: 'https://github.com/x/y/pull/2' }, // no number
      ],
      issues: [],
    });

    const { recent_open_prs } = await fetchRecentItems(supabase, ['repo-1']);

    expect(recent_open_prs).toEqual([]);
  });

  it('returns null author when the contributor join is missing', async () => {
    const supabase = stubSupabase({
      pull_requests: [{ ...prRow, contributors: null }],
      issues: [],
    });

    const { recent_open_prs } = await fetchRecentItems(supabase, ['repo-1']);

    expect(recent_open_prs[0].author).toBeNull();
  });

  it('returns empty arrays when a query fails, never throwing', async () => {
    const supabase = stubSupabase({
      pull_requests: { error: 'permission denied' },
      issues: [issueRow],
    });

    const result = await fetchRecentItems(supabase, ['repo-1']);

    expect(result).toEqual({ recent_open_prs: [], recent_open_issues: [] });
  });

  it('requests html_url only from pull_requests — the live issues table lacks it', async () => {
    const selects: Record<string, string> = {};
    const supabase = stubSupabase({ pull_requests: [], issues: [] }, selects);

    await fetchRecentItems(supabase, ['repo-1']);

    expect(selects.pull_requests).toContain('html_url');
    expect(selects.issues).toBeDefined();
    expect(selects.issues).not.toContain('html_url');
  });

  it('returns empty arrays without querying when there are no repos', async () => {
    const from = vi.fn();
    const supabase = { from } as unknown as SupabaseClient;

    const result = await fetchRecentItems(supabase, []);

    expect(result).toEqual({ recent_open_prs: [], recent_open_issues: [] });
    expect(from).not.toHaveBeenCalled();
  });
});
