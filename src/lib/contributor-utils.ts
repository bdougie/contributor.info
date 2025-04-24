import { PullRequest, ContributorStats } from "@/lib/types";

/**
 * Find pull requests associated with a specific user, considering different
 * ways the user might be identified in the data
 */
export function findUserPullRequests(
  allPullRequests: PullRequest[],
  username: string, 
  userId?: string
): PullRequest[] {
  if (!username) return [];
  
  const normalizedUsername = username.toLowerCase();
  const normalizedUserId = userId?.toLowerCase() || '';
  
  // Find PRs by this user using multiple potential matching criteria
  return allPullRequests.filter(pr => {
    // Normalize all potential user identifiers for comparison
    const prUserLogin = pr.user?.login?.toLowerCase() || '';
    const prUserName = pr.author?.login?.toLowerCase() || '';
    
    // Check if any of the identifiers match
    return prUserLogin === normalizedUsername || 
           prUserLogin === normalizedUserId ||
           prUserName === normalizedUsername ||
           prUserName === normalizedUserId;
  });
}

/**
 * Create contributor stats for a user based on their pull requests
 */
export function createContributorStats(
  allPullRequests: PullRequest[],
  username: string,
  avatarUrl: string,
  userId?: string
): ContributorStats {
  // Find all PRs associated with this user
  const userPRs = findUserPullRequests(allPullRequests, username, userId);
  
  // Calculate percentage contribution
  const percentage = allPullRequests.length > 0 
    ? (userPRs.length / allPullRequests.length) * 100
    : 0;
  
  // Return the contributor stats object
  return {
    login: username,
    avatar_url: avatarUrl,
    pullRequests: userPRs.length,
    percentage,
    recentPRs: userPRs.slice(0, 5)
  };
}