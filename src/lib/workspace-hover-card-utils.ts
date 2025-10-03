import type { PullRequest as WorkspacePR } from '@/components/features/workspace/WorkspacePullRequestsTable';
import type { Issue as WorkspaceIssue } from '@/components/features/workspace/WorkspaceIssuesTable';
import type { ActivityItem } from '@/components/features/workspace/AnalyticsDashboard';
import type { PullRequest as HoverCardPR, RecentIssue, RecentActivity } from '@/lib/types';

// Memoization cache for pre-grouped data by contributor
interface GroupedData {
  prsByAuthor: Map<string, HoverCardPR[]>;
  issuesByAuthor: Map<string, RecentIssue[]>;
  prsByReviewer: Map<string, HoverCardPR[]>;
  activitiesByAuthor: Map<string, RecentActivity[]>;
}

// Cache management constants
const MAX_CACHE_ENTRIES = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedGroupedData: GroupedData | null = null;
let cachedDataHash: string | null = null;
let cacheTimestamp: number = Date.now();
let cacheEntryCount: number = 0;

/**
 * Helper to create a content-based hash for cache invalidation.
 * Uses the most recent updated_at timestamps to detect data changes.
 */
function createDataHash(
  prs: WorkspacePR[],
  issues: WorkspaceIssue[],
  activities: ActivityItem[]
): string {
  // Get most recent timestamps from each dataset
  const latestPR =
    prs.length > 0 ? Math.max(...prs.map((pr) => new Date(pr.updated_at).getTime())) : 0;
  const latestIssue =
    issues.length > 0
      ? Math.max(...issues.map((issue) => new Date(issue.updated_at).getTime()))
      : 0;
  const latestActivity =
    activities.length > 0
      ? Math.max(...activities.map((activity) => new Date(activity.created_at).getTime()))
      : 0;

  // Combine counts and timestamps for a more robust cache key
  return `${prs.length}-${issues.length}-${activities.length}-${latestPR}-${latestIssue}-${latestActivity}`;
}

/**
 * Check if cache should be invalidated based on TTL and size limits
 */
function shouldInvalidateCache(): boolean {
  const now = Date.now();
  const isExpired = now - cacheTimestamp > CACHE_TTL;
  const isOversized = cacheEntryCount > MAX_CACHE_ENTRIES;
  return isExpired || isOversized;
}

/**
 * Clear the cache to prevent memory leaks
 */
function clearCache(): void {
  cachedGroupedData = null;
  cachedDataHash = null;
  cacheTimestamp = Date.now();
  cacheEntryCount = 0;
}

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
 * Pre-group all workspace data by contributor for efficient lookups.
 * This function should be called once when the data changes, not on every hover.
 *
 * PERFORMANCE OPTIMIZATION:
 * To use this optimization, call this function in workspace-page.tsx whenever
 * PRs, issues, or activities data changes (in a useEffect or useMemo), then
 * the individual getter functions will automatically use the cached grouped data.
 *
 * Example usage:
 * ```ts
 * useEffect(() => {
 *   if (prs.length > 0 || issues.length > 0 || activities.length > 0) {
 *     groupWorkspaceDataByContributor(prs, issues, activities);
 *   }
 * }, [prs, issues, activities]);
 * ```
 */
export function groupWorkspaceDataByContributor(
  allPRs: WorkspacePR[],
  allIssues: WorkspaceIssue[],
  allActivities: ActivityItem[]
): GroupedData {
  const dataHash = createDataHash(allPRs, allIssues, allActivities);

  // Check cache expiration and size limits
  if (shouldInvalidateCache()) {
    clearCache();
  }

  // Return cached data if hash matches
  if (cachedDataHash === dataHash && cachedGroupedData) {
    return cachedGroupedData;
  }

  const prsByAuthor = new Map<string, HoverCardPR[]>();
  const issuesByAuthor = new Map<string, RecentIssue[]>();
  const prsByReviewer = new Map<string, HoverCardPR[]>();
  const activitiesByAuthor = new Map<string, RecentActivity[]>();

  // Group PRs by author
  allPRs.forEach((pr) => {
    const username = pr.author.username.toLowerCase();
    if (!prsByAuthor.has(username)) {
      prsByAuthor.set(username, []);
    }
    prsByAuthor.get(username)!.push(transformPRToHoverCard(pr));
  });

  // Sort PRs by updated_at for each author
  prsByAuthor.forEach((prs) => {
    prs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  });

  // Group issues by author
  allIssues.forEach((issue) => {
    const username = issue.author.username.toLowerCase();
    if (!issuesByAuthor.has(username)) {
      issuesByAuthor.set(username, []);
    }
    issuesByAuthor.get(username)!.push({
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
    });
  });

  // Sort issues by updated_at for each author
  issuesByAuthor.forEach((issues) => {
    issues.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  });

  // Group PRs by reviewer
  allPRs.forEach((pr) => {
    const transformedPR = transformPRToHoverCard(pr);

    // Add to requested reviewers
    pr.requested_reviewers?.forEach((reviewer) => {
      const username = reviewer.username.toLowerCase();
      if (!prsByReviewer.has(username)) {
        prsByReviewer.set(username, []);
      }
      prsByReviewer.get(username)!.push(transformedPR);
    });

    // Add to reviewers who have reviewed
    pr.reviewers?.forEach((reviewer) => {
      const username = reviewer.username.toLowerCase();
      if (!prsByReviewer.has(username)) {
        prsByReviewer.set(username, []);
      }
      // Avoid duplicates
      const existingPRs = prsByReviewer.get(username)!;
      if (!existingPRs.some((p) => p.id === transformedPR.id)) {
        existingPRs.push(transformedPR);
      }
    });
  });

  // Sort PRs by updated_at for each reviewer
  prsByReviewer.forEach((prs) => {
    prs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  });

  // Group activities by author
  allActivities.forEach((activity) => {
    const username = activity.author.username.toLowerCase();
    if (!activitiesByAuthor.has(username)) {
      activitiesByAuthor.set(username, []);
    }
    activitiesByAuthor.get(username)!.push({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      created_at: activity.created_at,
      status: activity.status,
      repository: activity.repository,
      url: activity.url,
    });
  });

  // Sort activities by created_at for each author
  activitiesByAuthor.forEach((activities) => {
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  cachedGroupedData = {
    prsByAuthor,
    issuesByAuthor,
    prsByReviewer,
    activitiesByAuthor,
  };
  cachedDataHash = dataHash;
  cacheTimestamp = Date.now();
  cacheEntryCount =
    prsByAuthor.size + issuesByAuthor.size + prsByReviewer.size + activitiesByAuthor.size;

  return cachedGroupedData;
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
  // For backwards compatibility, still support the old API
  // But use grouping if we have cached data
  if (cachedGroupedData) {
    const prs = cachedGroupedData.prsByAuthor.get(contributorUsername.toLowerCase()) || [];
    return prs.slice(0, limit);
  }

  // Fallback to original implementation
  const contributorPRs = allPRs.filter(
    (pr) => pr.author.username.toLowerCase() === contributorUsername.toLowerCase()
  );

  const sortedPRs = contributorPRs.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

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
  // Use cached data if available
  if (cachedGroupedData) {
    const issues = cachedGroupedData.issuesByAuthor.get(contributorUsername.toLowerCase()) || [];
    return issues.slice(0, limit);
  }

  // Fallback to original implementation
  const contributorIssues = allIssues.filter(
    (issue) => issue.author.username.toLowerCase() === contributorUsername.toLowerCase()
  );

  const sortedIssues = contributorIssues.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

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
  // Use cached data if available
  if (cachedGroupedData) {
    const prs = cachedGroupedData.prsByReviewer.get(reviewerUsername.toLowerCase()) || [];
    return prs.slice(0, limit);
  }

  // Fallback to original implementation
  const reviewerPRs = allPRs.filter((pr) => {
    const isRequestedReviewer = pr.requested_reviewers?.some(
      (reviewer) => reviewer.username.toLowerCase() === reviewerUsername.toLowerCase()
    );
    const hasReviewed = pr.reviewers?.some(
      (reviewer) => reviewer.username.toLowerCase() === reviewerUsername.toLowerCase()
    );
    return isRequestedReviewer || hasReviewed;
  });

  const sortedPRs = reviewerPRs.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

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
  // Use cached data if available
  if (cachedGroupedData) {
    const activities =
      cachedGroupedData.activitiesByAuthor.get(contributorUsername.toLowerCase()) || [];
    return activities.slice(0, limit);
  }

  // Fallback to original implementation
  const contributorActivities = allActivities.filter(
    (activity) => activity.author.username.toLowerCase() === contributorUsername.toLowerCase()
  );

  const sortedActivities = contributorActivities.sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
