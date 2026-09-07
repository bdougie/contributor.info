/**
 * CSV export utility functions
 */

import { unparse } from 'papaparse';
import type { Contributor } from '@/components/features/workspace/ContributorsList';
import type { Issue } from '@/components/features/workspace/WorkspaceIssuesTable';
import type { PullRequest } from '@/components/features/workspace/WorkspacePullRequestsTable';
import type { Discussion } from '@/components/features/workspace/WorkspaceDiscussionsTable';
import type { ContributorReview } from '@/lib/contributors/contributor-reviews';

// ============================================
// Shared Download Helper
// ============================================

/**
 * Downloads text content as a file
 */
function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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
 * Downloads CSV content as a file
 */
function downloadCSV(csvContent: string, filename: string): void {
  downloadTextFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

// ============================================
// Contributors Export
// ============================================

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
  downloadCSV(csv, filename);
}

/**
 * Generates a filename for CSV export
 */
export function generateExportFilename(
  prefix: string,
  entityType: 'issues' | 'pull-requests' | 'discussions' | 'contributors' | 'reviews',
  extension: 'csv' | 'jsonl' = 'csv'
): string {
  const sanitizedPrefix = prefix.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `${sanitizedPrefix}_${entityType}_${date}.${extension}`;
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
  downloadCSV(csv, filename);
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
  'Merged At': string;
  'Closed At': string;
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
    'Merged At': pr.merged_at || '',
    'Closed At': pr.closed_at || '',
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
  downloadCSV(csv, filename);
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
  downloadCSV(csv, filename);
}

// ============================================
// Spammers Export
// ============================================

export interface SpammerCSVRow {
  Rank: number;
  'GitHub Username': string;
  'GitHub Profile': string;
  'Spam PR Count': number;
  'First Reported': string;
  'Last Reported': string;
  'Verification Status': string;
  'Latest Spam PR': string;
}

/** Minimal interface for spammer data needed for CSV export */
export interface SpammerExportData {
  github_login: string;
  spam_pr_count: number;
  first_reported_at: string;
  last_reported_at: string;
  verification_status: string;
  latest_pr_url: string | null;
}

/**
 * Transforms spammer data into CSV-compatible format
 */
export function transformSpammersToCSV(spammers: SpammerExportData[]): SpammerCSVRow[] {
  return spammers.map((spammer, index) => ({
    Rank: index + 1,
    'GitHub Username': spammer.github_login,
    'GitHub Profile': `https://github.com/${spammer.github_login}`,
    'Spam PR Count': spammer.spam_pr_count,
    'First Reported': new Date(spammer.first_reported_at).toLocaleDateString(),
    'Last Reported': new Date(spammer.last_reported_at).toLocaleDateString(),
    'Verification Status': spammer.verification_status,
    'Latest Spam PR': spammer.latest_pr_url || '',
  }));
}

/**
 * Exports spammers to CSV file
 */
export function exportSpammersToCSV(
  spammers: SpammerExportData[],
  filename = 'verified-spammers.csv'
): void {
  const csvData = transformSpammersToCSV(spammers);
  const csv = unparse(csvData);
  downloadCSV(csv, filename);
}

// ============================================
// Contributor Reviews Export
// ============================================

export interface ContributorReviewCSVRow {
  Reviewer: string;
  Repository: string;
  'PR Number': number;
  'PR Title': string;
  'PR Author': string;
  'PR URL': string;
  'Review State': string;
  'Submitted At': string;
  Commit: string;
  'Review Body': string;
  'Inline Comments': number;
  'Review GitHub ID': string;
}

/**
 * Flattens one row per review. Inline comments are counted here and kept in
 * full only in the JSONL export.
 */
export function transformContributorReviewsToCSV(
  reviewer: string,
  reviews: ContributorReview[]
): ContributorReviewCSVRow[] {
  return reviews.map((review) => ({
    Reviewer: reviewer,
    Repository: review.repository.full_name,
    'PR Number': review.pull_request.number,
    'PR Title': review.pull_request.title,
    'PR Author': review.pull_request.author_login ?? '',
    'PR URL': review.pull_request.html_url ?? '',
    'Review State': review.state,
    'Submitted At': review.submitted_at,
    Commit: review.commit_id ?? '',
    'Review Body': review.body,
    'Inline Comments': review.comments.length,
    'Review GitHub ID': review.github_id,
  }));
}

export function exportContributorReviewsToCSV(
  reviewer: string,
  reviews: ContributorReview[],
  filename = generateExportFilename(reviewer, 'reviews')
): void {
  const csv = unparse(transformContributorReviewsToCSV(reviewer, reviews));
  downloadCSV(csv, filename);
}

/** One JSONL record per review, with inline comments nested. */
export interface ContributorReviewRecord {
  reviewer: string;
  review_github_id: string;
  state: ContributorReview['state'];
  body: string;
  submitted_at: string;
  commit_id: string | null;
  repository: string;
  pull_request: {
    number: number;
    title: string;
    url: string | null;
    state: string;
    author: string | null;
  };
  comments: Array<{
    github_id: string;
    path: string | null;
    position: number | null;
    original_position: number | null;
    commit_id: string | null;
    in_reply_to_id: string | null;
    diff_hunk: string | null;
    body: string;
    created_at: string;
  }>;
}

export function transformContributorReviewsToRecords(
  reviewer: string,
  reviews: ContributorReview[]
): ContributorReviewRecord[] {
  return reviews.map((review) => ({
    reviewer,
    review_github_id: review.github_id,
    state: review.state,
    body: review.body,
    submitted_at: review.submitted_at,
    commit_id: review.commit_id,
    repository: review.repository.full_name,
    pull_request: {
      number: review.pull_request.number,
      title: review.pull_request.title,
      url: review.pull_request.html_url,
      state: review.pull_request.state,
      author: review.pull_request.author_login,
    },
    comments: review.comments.map((comment) => ({
      github_id: comment.github_id,
      path: comment.path,
      position: comment.position,
      original_position: comment.original_position,
      commit_id: comment.commit_id,
      in_reply_to_id: comment.in_reply_to_id,
      diff_hunk: comment.diff_hunk,
      body: comment.body,
      created_at: comment.created_at,
    })),
  }));
}

/**
 * Serializes reviews as newline-delimited JSON, the shape labeling tools read.
 */
export function serializeContributorReviewsToJSONL(
  reviewer: string,
  reviews: ContributorReview[]
): string {
  return transformContributorReviewsToRecords(reviewer, reviews)
    .map((record) => JSON.stringify(record))
    .join('\n');
}

export function exportContributorReviewsToJSONL(
  reviewer: string,
  reviews: ContributorReview[],
  filename = generateExportFilename(reviewer, 'reviews', 'jsonl')
): void {
  const jsonl = serializeContributorReviewsToJSONL(reviewer, reviews);
  downloadTextFile(jsonl, filename, 'application/x-ndjson;charset=utf-8;');
}
