/**
 * Utility functions and types for PR review status calculations
 */

/**
 * Represents a reviewer's information from a pull request
 */
export interface PRReviewer {
  username: string;
  avatar_url: string;
  approved: boolean;
  state?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  submitted_at?: string;
}

/**
 * Represents the review status for a single reviewer across all PRs
 */
export interface ReviewerStatus {
  username: string;
  avatar_url: string;
  openPRsCount: number;
  requestedReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  changesRequestedReviews: number;
  commentedReviews: number;
  dismissedReviews: number;
  blockedPRs: number; // PRs waiting for this reviewer
  isBot: boolean;
  averageReviewTime?: number; // in hours
}

/**
 * Special reviewer status for PRs that need reviewers
 */
export const NEEDS_REVIEWER_KEY = '__needs_reviewer__';

/**
 * Creates an empty ReviewerStatus object
 */
export function createEmptyReviewerStatus(
  username: string,
  avatar_url: string,
  isBot: boolean
): ReviewerStatus {
  return {
    username,
    avatar_url,
    openPRsCount: 0,
    requestedReviews: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    changesRequestedReviews: 0,
    commentedReviews: 0,
    dismissedReviews: 0,
    blockedPRs: 0,
    isBot,
  };
}

/**
 * Creates the special "Needs Reviewer" status entry
 */
export function createNeedsReviewerStatus(): ReviewerStatus {
  return {
    username: 'Needs Reviewer',
    avatar_url: '',
    openPRsCount: 0,
    requestedReviews: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    changesRequestedReviews: 0,
    commentedReviews: 0,
    dismissedReviews: 0,
    blockedPRs: 0,
    isBot: false,
  };
}

/**
 * Validates if a reviewer object has the required properties
 */
export function isValidReviewer(reviewer: unknown): reviewer is PRReviewer {
  if (!reviewer || typeof reviewer !== 'object') {
    return false;
  }
  const r = reviewer as Record<string, unknown>;
  return (
    typeof r.username === 'string' &&
    r.username.length > 0 &&
    typeof r.avatar_url === 'string' &&
    typeof r.approved === 'boolean'
  );
}

/**
 * Updates reviewer status based on their review state
 */
export function updateReviewerStatus(
  status: ReviewerStatus,
  reviewer: PRReviewer,
  isBlocked: boolean
): void {
  // Validate reviewer data before processing
  if (!isValidReviewer(reviewer)) {
    console.warn('Invalid reviewer data, skipping:', reviewer);
    return;
  }

  status.openPRsCount++;

  // Update based on review state
  if (reviewer.state) {
    switch (reviewer.state) {
      case 'APPROVED':
        status.approvedReviews++;
        break;
      case 'CHANGES_REQUESTED':
        status.changesRequestedReviews++;
        if (isBlocked) {
          status.blockedPRs++;
        }
        break;
      case 'COMMENTED':
        status.commentedReviews++;
        break;
      case 'DISMISSED':
        status.dismissedReviews++;
        break;
      case 'PENDING':
      default:
        status.pendingReviews++;
        if (isBlocked) {
          status.blockedPRs++;
        }
        break;
    }
  } else {
    // Fallback to simple approved/pending logic
    if (reviewer.approved) {
      status.approvedReviews++;
    } else {
      status.pendingReviews++;
      if (isBlocked) {
        status.blockedPRs++;
      }
    }
  }
}

/**
 * Checks if a PR is blocked (no approved reviews)
 */
export function isPRBlocked(reviewers: PRReviewer[]): boolean {
  if (reviewers.length === 0) return true;
  return !reviewers.some((r) => r.approved || r.state === 'APPROVED');
}

/**
 * Sorts reviewer statuses by priority (blocked PRs first, then by total count)
 */
export function sortReviewerStatuses(statuses: ReviewerStatus[]): ReviewerStatus[] {
  return [...statuses].sort((a, b) => {
    // "Needs Reviewer" always comes first
    if (a.username === 'Needs Reviewer') return -1;
    if (b.username === 'Needs Reviewer') return 1;

    // Sort by blocked PRs (descending)
    if (a.blockedPRs !== b.blockedPRs) {
      return b.blockedPRs - a.blockedPRs;
    }

    // Then by total open PRs (descending)
    return b.openPRsCount - a.openPRsCount;
  });
}

/**
 * URL-encodes a username for use in GitHub URLs
 * Properly handles special characters in usernames
 */
export function encodeGitHubUsername(username: string): string {
  // GitHub usernames can contain hyphens, underscores, and potentially other characters
  // Always URL-encode for safety to handle edge cases
  return encodeURIComponent(username);
}

/**
 * Gets a safe GitHub avatar URL for a username
 */
export function getGitHubAvatarUrl(username: string): string {
  const encodedUsername = encodeGitHubUsername(username);
  return `https://github.com/${encodedUsername}.png`;
}

/**
 * Generates a GitHub URL for viewing PRs awaiting review from a specific reviewer
 */
export function getGitHubReviewUrl(
  reviewer: ReviewerStatus,
  repositories?: Array<{ owner: string; name: string }>
): string | null {
  // No URL for "Needs Reviewer"
  if (reviewer.username === 'Needs Reviewer' || reviewer.username === NEEDS_REVIEWER_KEY) {
    return null;
  }

  const encodedUsername = encodeGitHubUsername(reviewer.username);

  // Single repository search
  if (repositories && repositories.length === 1) {
    const repo = repositories[0];
    return `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name
    )}/pulls?q=is%3Apr+is%3Aopen+review-requested%3A${encodedUsername}`;
  }

  // Multiple repositories or no repository info - search all PRs
  return `https://github.com/pulls?q=is%3Apr+is%3Aopen+review-requested%3A${encodedUsername}`;
}

/**
 * Filters reviewer statuses based on bot exclusion preference
 */
export function filterReviewerStatuses(
  statuses: ReviewerStatus[],
  excludeBots: boolean
): ReviewerStatus[] {
  if (!excludeBots) {
    return statuses;
  }
  return statuses.filter((status) => !status.isBot || status.username === 'Needs Reviewer');
}

/**
 * Calculates totals from reviewer statuses
 */
export interface ReviewTotals {
  totalBlocked: number;
  totalRequested: number;
  totalPending: number;
  totalApproved: number;
  totalChangesRequested: number;
  totalCommented: number;
}

export function calculateReviewTotals(statuses: ReviewerStatus[]): ReviewTotals {
  return statuses.reduce(
    (acc, reviewer) => ({
      totalBlocked: acc.totalBlocked + reviewer.blockedPRs,
      totalRequested: acc.totalRequested + reviewer.requestedReviews,
      totalPending: acc.totalPending + reviewer.pendingReviews,
      totalApproved: acc.totalApproved + reviewer.approvedReviews,
      totalChangesRequested: acc.totalChangesRequested + reviewer.changesRequestedReviews,
      totalCommented: acc.totalCommented + reviewer.commentedReviews,
    }),
    {
      totalBlocked: 0,
      totalRequested: 0,
      totalPending: 0,
      totalApproved: 0,
      totalChangesRequested: 0,
      totalCommented: 0,
    }
  );
}

/**
 * Processes pull requests and calculates reviewer status distribution
 * This consolidates the logic for processing PRs and their reviewers
 */
export function calculateReviewerStatusDistribution(
  pullRequests: Array<{
    state?: string;
    reviewers?: Array<Partial<PRReviewer>>;
  }>,
  isBotChecker: (username: string) => boolean
): ReviewerStatus[] {
  const statusMap = new Map<string, ReviewerStatus>();

  // Track PRs that need review (open PRs including drafts)
  const openPRs = pullRequests.filter((pr) => pr.state === 'open' || pr.state === 'draft');

  // Process each open PR to understand review status
  openPRs.forEach((pr) => {
    // Ensure reviewers is always an array
    const reviewersForThisPR = pr.reviewers ?? [];

    // Check if PR is blocked (no approved reviews)
    const isBlocked = isPRBlocked(reviewersForThisPR as PRReviewer[]);

    // Process each reviewer
    reviewersForThisPR.forEach((reviewer) => {
      // Validate reviewer data using type guard
      if (!isValidReviewer(reviewer)) {
        return; // Validation warning is handled in isValidReviewer
      }

      const isBotUser = isBotChecker(reviewer.username);

      // Get existing or create new reviewer status
      let reviewerStatus = statusMap.get(reviewer.username);
      if (!reviewerStatus) {
        reviewerStatus = createEmptyReviewerStatus(
          reviewer.username,
          reviewer.avatar_url,
          isBotUser
        );
        statusMap.set(reviewer.username, reviewerStatus);
      }

      // Update reviewer status based on their review state
      updateReviewerStatus(reviewerStatus, reviewer, isBlocked);
    });

    // Track PRs without any reviewers (need initial review)
    if (reviewersForThisPR.length === 0) {
      let needsReviewerStatus = statusMap.get(NEEDS_REVIEWER_KEY);
      if (!needsReviewerStatus) {
        needsReviewerStatus = createNeedsReviewerStatus();
        statusMap.set(NEEDS_REVIEWER_KEY, needsReviewerStatus);
      }
      needsReviewerStatus.openPRsCount++;
      needsReviewerStatus.requestedReviews++;
      needsReviewerStatus.blockedPRs++;
    }
  });

  // Convert to array
  return Array.from(statusMap.values());
}
