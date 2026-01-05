import type { PullRequest as WorkspacePR } from '@/components/features/workspace/WorkspacePullRequestsTable';
import type { Issue as WorkspaceIssue } from '@/components/features/workspace/WorkspaceIssuesTable';
import type { ActivityItem } from '@/components/features/workspace/AnalyticsDashboard';
import type { PullRequest as HoverCardPR, RecentIssue, RecentActivity } from '@/lib/types';

/**
 * Helper to transform workspace PR to hover card format
 */
function transformPRToHoverCard(pr: WorkspacePR): HoverCardPR {
  return {
    id: parseInt(pr.id, 10) || 0,
    number: pr.number,
    title: pr.title,
    state: pr.state === 'merged' || pr.state === 'open' || pr.state === 'draft' ? 'open' : 'closed',
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    merged_at: pr.merged_at || null,
    closed_at: pr.closed_at || null,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    repository_owner: pr.repository.owner,
    repository_name: pr.repository.name,
    user: {
      id: 0,
      login: pr.author.username,
      avatar_url: pr.author.avatar_url,
    },
    html_url: pr.url,
  };
}

/**
 * Get recent PRs for a specific contributor from workspace PR data
 * @param contributorUsername - The username to filter PRs for
 * @param allPRs - All PRs from the workspace
 * @param limit - Maximum number of PRs to return (default: 5)
 * @returns Array of recent PRs in hover card format
 */
export function getRecentPRsForContributor(
  contributorUsername: string,
  allPRs: WorkspacePR[],
  limit = 5
): HoverCardPR[] {
  const contributorPRs = allPRs.filter(
    (pr) => pr.author.username.toLowerCase() === contributorUsername.toLowerCase()
  );

  // Use string comparison for sorting - ISO date strings sort lexicographically
  const sortedPRs = contributorPRs.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return sortedPRs.slice(0, limit).map(transformPRToHoverCard);
}

/**
 * Get recent issues for a specific contributor from workspace issue data
 * @param contributorUsername - The username to filter issues for
 * @param allIssues - All issues from the workspace
 * @param limit - Maximum number of issues to return (default: 5)
 * @returns Array of recent issues in hover card format
 */
export function getRecentIssuesForContributor(
  contributorUsername: string,
  allIssues: WorkspaceIssue[],
  limit = 5
): RecentIssue[] {
  const contributorIssues = allIssues.filter(
    (issue) => issue.author.username.toLowerCase() === contributorUsername.toLowerCase()
  );

  // Use string comparison for sorting - ISO date strings sort lexicographically
  const sortedIssues = contributorIssues.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return sortedIssues.slice(0, limit).map((issue) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at,
    repository_owner: issue.repository.owner,
    repository_name: issue.repository.name,
    comments_count: issue.comments_count,
    html_url: issue.url,
  }));
}

/**
 * Get recent PRs where a contributor is a requested reviewer or has reviewed
 * @param reviewerUsername - The username to filter PRs for
 * @param allPRs - All PRs from the workspace
 * @param limit - Maximum number of PRs to return (default: 5)
 * @returns Array of recent PRs in hover card format
 */
export function getRecentPRsForReviewer(
  reviewerUsername: string,
  allPRs: WorkspacePR[],
  limit = 5
): HoverCardPR[] {
  const reviewerPRs = allPRs.filter((pr) => {
    const isRequestedReviewer = pr.requested_reviewers?.some(
      (reviewer) => reviewer.username.toLowerCase() === reviewerUsername.toLowerCase()
    );
    const hasReviewed = pr.reviewers?.some(
      (reviewer) => reviewer.username.toLowerCase() === reviewerUsername.toLowerCase()
    );
    return isRequestedReviewer || hasReviewed;
  });

  // Use string comparison for sorting - ISO date strings sort lexicographically
  const sortedPRs = reviewerPRs.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return sortedPRs.slice(0, limit).map(transformPRToHoverCard);
}

/**
 * Get recent activities for a specific contributor from workspace activity data
 * @param contributorUsername - The username to filter activities for
 * @param allActivities - All activities from the workspace
 * @param limit - Maximum number of activities to return (default: 5)
 * @returns Array of recent activities in hover card format
 */
export function getRecentActivitiesForContributor(
  contributorUsername: string,
  allActivities: ActivityItem[],
  limit = 5
): RecentActivity[] {
  const contributorActivities = allActivities.filter(
    (activity) => activity.author.username.toLowerCase() === contributorUsername.toLowerCase()
  );

  // Use string comparison for sorting - ISO date strings sort lexicographically
  const sortedActivities = contributorActivities.sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  return sortedActivities.slice(0, limit).map((activity) => ({
    id: activity.id,
    type: activity.type,
    title: activity.title,
    created_at: activity.created_at,
    status: activity.status,
    repository: activity.repository,
    url: activity.url,
  }));
}
