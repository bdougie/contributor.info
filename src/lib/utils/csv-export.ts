/**
 * CSV export utility functions
 */

import { unparse } from 'papaparse';
import type { Contributor } from '@/components/features/workspace/ContributorsList';
import type { Issue } from '@/components/features/workspace/WorkspaceIssuesTable';
import type { PullRequest } from '@/components/features/workspace/WorkspacePullRequestsTable';
import type { Discussion } from '@/components/features/workspace/WorkspaceDiscussionsTable';

export interface ContributorCSVRow {
  Username: string;
  Name: string;
  'Pull Requests': number;
  Issues: number;
  Commits: number;
  'Repositories Contributed': number;
}

/**
 * Transforms contributor data into CSV-compatible format
 */
export function transformContributorsToCSV(contributors: Contributor[]): ContributorCSVRow[] {
  return contributors.map((contributor) => ({
    Username: contributor.username,
    Name: contributor.name || contributor.username,
    'Pull Requests': contributor.contributions.pull_requests,
    Issues: contributor.contributions.issues,
    Commits: contributor.contributions.commits,
    'Repositories Contributed': contributor.stats.repositories_contributed,
  }));
}

/**
 * Exports contributors to CSV file
 */
export function exportContributorsToCSV(
  contributors: Contributor[],
  filename = 'contributors.csv'
): void {
  const csvData = transformContributorsToCSV(contributors);
  const csv = unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a filename for CSV export
 */
export function generateExportFilename(
  prefix: string,
  entityType: 'issues' | 'pull-requests' | 'discussions' | 'contributors'
): string {
  const sanitizedPrefix = prefix.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `${sanitizedPrefix}_${entityType}_${date}.csv`;
}

// ============================================
// Issues Export
// ============================================

export interface IssueCSVRow {
  Number: number;
  Title: string;
  State: string;
  Repository: string;
  Author: string;
  'Created At': string;
  'Updated At': string;
  Labels: string;
  Assignees: string;
  'Comments Count': number;
  URL: string;
}

/**
 * Transforms issue data into CSV-compatible format
 */
export function transformIssuesToCSV(issues: Issue[]): IssueCSVRow[] {
  return issues.map((issue) => ({
    Number: issue.number,
    Title: issue.title,
    State: issue.state,
    Repository: `${issue.repository.owner}/${issue.repository.name}`,
    Author: issue.author.username,
    'Created At': issue.created_at,
    'Updated At': issue.updated_at,
    Labels: issue.labels.map((l) => l.name).join('; '),
    Assignees: issue.assignees?.map((a) => a.login).join('; ') || '',
    'Comments Count': issue.comments_count,
    URL: issue.url,
  }));
}

/**
 * Exports issues to CSV file
 */
export function exportIssuesToCSV(issues: Issue[], filename = 'issues.csv'): void {
  const csvData = transformIssuesToCSV(issues);
  const csv = unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// Pull Requests Export
// ============================================

export interface PullRequestCSVRow {
  Number: number;
  Title: string;
  State: string;
  Repository: string;
  Author: string;
  'Created At': string;
  'Updated At': string;
  Additions: number;
  Deletions: number;
  'Changed Files': number;
  Reviewers: string;
  Labels: string;
  URL: string;
}

/**
 * Transforms pull request data into CSV-compatible format
 */
export function transformPullRequestsToCSV(prs: PullRequest[]): PullRequestCSVRow[] {
  return prs.map((pr) => ({
    Number: pr.number,
    Title: pr.title,
    State: pr.state,
    Repository: `${pr.repository.owner}/${pr.repository.name}`,
    Author: pr.author.username,
    'Created At': pr.created_at,
    'Updated At': pr.updated_at,
    Additions: pr.additions,
    Deletions: pr.deletions,
    'Changed Files': pr.changed_files,
    Reviewers: pr.reviewers?.map((r) => r.username).join('; ') || '',
    Labels: pr.labels.map((l) => l.name).join('; '),
    URL: pr.url,
  }));
}

/**
 * Exports pull requests to CSV file
 */
export function exportPullRequestsToCSV(prs: PullRequest[], filename = 'pull-requests.csv'): void {
  const csvData = transformPullRequestsToCSV(prs);
  const csv = unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// Discussions Export
// ============================================

export interface DiscussionCSVRow {
  Number: number;
  Title: string;
  Category: string;
  Author: string;
  'Created At': string;
  'Updated At': string;
  'Is Answered': string;
  'Upvote Count': number;
  'Comment Count': number;
  Repository: string;
  URL: string;
}

/**
 * Transforms discussion data into CSV-compatible format
 */
export function transformDiscussionsToCSV(discussions: Discussion[]): DiscussionCSVRow[] {
  return discussions.map((discussion) => ({
    Number: discussion.number,
    Title: discussion.title,
    Category: discussion.category_name || '',
    Author: discussion.author_login || '',
    'Created At': discussion.created_at,
    'Updated At': discussion.updated_at,
    'Is Answered': discussion.is_answered ? 'Yes' : 'No',
    'Upvote Count': discussion.upvote_count,
    'Comment Count': discussion.comment_count,
    Repository: discussion.repositories?.full_name || '',
    URL: discussion.url,
  }));
}

/**
 * Exports discussions to CSV file
 */
export function exportDiscussionsToCSV(
  discussions: Discussion[],
  filename = 'discussions.csv'
): void {
  const csvData = transformDiscussionsToCSV(discussions);
  const csv = unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
