import { describe, expect, it } from 'vitest';
import type { Issue } from '@/components/features/workspace/WorkspaceIssuesTable';
import {
  mergeRefreshedIssues,
  summarizeIssueRefresh,
  type IssueRefreshRepositoryResult,
  type RefreshedIssueRow,
} from '../github-issue-refresh';

const repositories = [
  { id: 'repo-a', owner: 'acme', name: 'widgets', avatar_url: 'https://img/acme' },
  { id: 'repo-b', owner: 'acme', name: 'gadgets' },
];

function cachedIssue(overrides: Partial<Issue> & { number: number }): Issue {
  return {
    id: `db-${overrides.number}`,
    title: `Saved #${overrides.number}`,
    state: 'open',
    repository: { name: 'widgets', owner: 'acme', avatar_url: 'https://img/acme' },
    author: { username: 'saved-author', avatar_url: '' },
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    comments_count: 1,
    labels: [],
    assignees: [],
    url: `https://github.com/acme/widgets/issues/${overrides.number}`,
    ...overrides,
  };
}

function freshRow(overrides: Partial<RefreshedIssueRow> & { number: number }): RefreshedIssueRow {
  return {
    id: `db-${overrides.number}`,
    github_id: 1000 + overrides.number,
    repository_id: 'repo-a',
    title: `Fresh #${overrides.number}`,
    state: 'open',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    closed_at: null,
    comments_count: 4,
    labels: [{ name: 'bug', color: 'ff0000' }],
    assignees: [{ login: 'dev', avatar_url: 'https://img/dev' }],
    author: { username: 'fresh-author', avatar_url: 'https://img/fresh', is_bot: false },
    url: `https://github.com/acme/widgets/issues/${overrides.number}`,
    ...overrides,
  };
}

function result(
  overrides: Partial<IssueRefreshRepositoryResult> & { repositoryId: string }
): IssueRefreshRepositoryResult {
  return {
    repository: overrides.repositoryId === 'repo-a' ? 'acme/widgets' : 'acme/gadgets',
    status: 'refreshed',
    fetched: overrides.issues?.length ?? 0,
    stored: overrides.issues?.length ?? 0,
    issues: [],
    ...overrides,
  };
}

describe('mergeRefreshedIssues', () => {
  it('overlays fresh GitHub rows while keeping response tracking and linked PRs from saved rows', () => {
    const cached = [
      cachedIssue({
        number: 1,
        responded_by: 'user-1',
        responded_at: '2026-08-03T00:00:00Z',
        linked_pull_requests: [
          { number: 9, url: 'https://github.com/acme/widgets/pull/9', state: 'open' },
        ],
      }),
    ];
    const merged = mergeRefreshedIssues(
      cached,
      [result({ repositoryId: 'repo-a', issues: [freshRow({ number: 1, title: 'Renamed' })] })],
      repositories
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'db-1',
      title: 'Renamed',
      comments_count: 4,
      author: { username: 'fresh-author' },
      responded_by: 'user-1',
      responded_at: '2026-08-03T00:00:00Z',
    });
    expect(merged[0].linked_pull_requests).toEqual(cached[0].linked_pull_requests);
  });

  it('keeps saved rows for repositories that failed and for issues outside the refresh window', () => {
    const cached = [
      cachedIssue({ number: 1 }),
      cachedIssue({ number: 2, repository: { name: 'gadgets', owner: 'acme' } }),
    ];
    const merged = mergeRefreshedIssues(
      cached,
      [
        result({ repositoryId: 'repo-a', issues: [freshRow({ number: 7 })] }),
        result({
          repositoryId: 'repo-b',
          status: 'failed',
          stage: 'github',
          error: 'GitHub denied access.',
          issues: [freshRow({ number: 99, repository_id: 'repo-b' })],
        }),
      ],
      repositories
    );

    const keys = merged.map((issue) => `${issue.repository.name}#${issue.number}`);
    expect(keys).toEqual(['widgets#7', 'widgets#1', 'gadgets#2']);
  });

  it('shows rows that were fetched but not stored, using the saved id or a GitHub-derived one', () => {
    const cached = [cachedIssue({ number: 1 })];
    const merged = mergeRefreshedIssues(
      cached,
      [
        result({
          repositoryId: 'repo-a',
          status: 'fetched_not_stored',
          stage: 'database',
          stored: 0,
          issues: [freshRow({ number: 1, id: null }), freshRow({ number: 2, id: null })],
        }),
      ],
      repositories
    );

    const byNumber = new Map(merged.map((issue) => [issue.number, issue]));
    expect(byNumber.get(1)?.id).toBe('db-1');
    expect(byNumber.get(2)?.id).toBe('github:1002');
  });

  it('ignores results for repositories the tab does not know', () => {
    const merged = mergeRefreshedIssues(
      [],
      [result({ repositoryId: 'repo-x', issues: [freshRow({ number: 1 })] })],
      repositories
    );
    expect(merged).toEqual([]);
  });
});

describe('summarizeIssueRefresh', () => {
  it('reports each failed repository with its cause and keeps saved rows wording', () => {
    const summary = summarizeIssueRefresh([
      result({ repositoryId: 'repo-a' }),
      result({
        repositoryId: 'repo-b',
        status: 'failed',
        stage: 'github',
        httpStatus: 404,
        error:
          'GitHub could not find acme/gadgets for this account (private, renamed, or deleted).',
      }),
    ]);

    expect(summary.freshRepositoryIds).toEqual(['repo-a']);
    expect(summary.errorMessage).toBe(
      'Could not refresh acme/gadgets (GitHub could not find acme/gadgets for this account (private, renamed, or deleted)). Showing saved issues for it.'
    );
    expect(summary.warningMessage).toBeNull();
  });

  it('distinguishes rows shown live but not saved from outright failures', () => {
    const summary = summarizeIssueRefresh([
      result({
        repositoryId: 'repo-a',
        status: 'fetched_not_stored',
        stage: 'database',
        error: 'Could not store issues: permission denied.',
      }),
    ]);

    expect(summary.errorMessage).toBeNull();
    expect(summary.freshRepositoryIds).toEqual(['repo-a']);
    expect(summary.warningMessage).toBe(
      'Showing live GitHub issues for acme/widgets (Could not store issues: permission denied); they could not be saved.'
    );
  });

  it('treats a legitimate empty window as a completed refresh', () => {
    const summary = summarizeIssueRefresh([result({ repositoryId: 'repo-a', issues: [] })]);
    expect(summary.refreshed).toHaveLength(1);
    expect(summary.errorMessage).toBeNull();
  });
});
