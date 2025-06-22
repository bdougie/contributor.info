import { PullRequest, ContributorStats } from "@/lib/types";
import { fetchUserOrganizations } from "@/lib/github";
import { supabase } from "@/lib/supabase";

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
    const prUserId = String(pr.user?.id || '').toLowerCase();
    const prAuthorLogin = pr.author?.login?.toLowerCase() || '';
    
    // Check if any of the identifiers match
    return prUserLogin === normalizedUsername || 
           (normalizedUserId && prUserId === normalizedUserId) ||
           prAuthorLogin === normalizedUsername;
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
    ? Math.round((userPRs.length / allPullRequests.length) * 100)
    : 0;
  
  // Get organizations from the first PR if available
  const organizations = userPRs.length > 0 && userPRs[0].organizations 
    ? userPRs[0].organizations 
    : [];
  
  // Return the contributor stats object
  return {
    login: username,
    avatar_url: avatarUrl,
    pullRequests: userPRs.length,
    percentage,
    recentPRs: userPRs.slice(0, 5),
    organizations
  };
}

/**
 * Create contributor stats for a user based on their pull requests with organizations data
 */
export async function createContributorStatsWithOrgs(
  allPullRequests: PullRequest[],
  username: string,
  avatarUrl: string,
  userId?: string
): Promise<ContributorStats> {
  // Get basic stats
  const stats = createContributorStats(allPullRequests, username, avatarUrl, userId);
  
  // Fetch organizations if not already available
  if (!stats.organizations || stats.organizations.length === 0) {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
      };
      
      // Try to get user's GitHub token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.provider_token;
      const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
      
      if (token) {
        headers.Authorization = `token ${token}`;
      }
      
      const orgs = await fetchUserOrganizations(username, headers);
      stats.organizations = orgs;
    } catch (error) {
      // Keep empty organizations array on error
    }
  }
  
  return stats;
}