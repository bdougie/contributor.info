import { PullRequest, ContributorStats } from '@/lib/types';
import { fetchUserOrganizations } from '@/lib/github';
import { getSupabase } from '@/lib/supabase-lazy';

// Cache for user pull requests lookup
const userPullRequestsCache = new WeakMap<
  PullRequest[],
  Map<string, Set<PullRequest>>
>();

/**
 * Indexes pull requests by user login and ID for O(1) lookup
 */
function getIndexedPullRequests(pullRequests: PullRequest[]): Map<string, Set<PullRequest>> {
  if (userPullRequestsCache.has(pullRequests)) {
    return userPullRequestsCache.get(pullRequests)!;
  }

  const index = new Map<string, Set<PullRequest>>();

  const addToIndex = (key: string, pr: PullRequest) => {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(pr);
  };

  pullRequests.forEach((pr) => {
    const userLogin = pr.user?.login?.toLowerCase();
    if (userLogin) {
      addToIndex(`login:${userLogin}`, pr);
    }

    if (pr.user?.id !== undefined && pr.user?.id !== null) {
      const idStr = String(pr.user.id).toLowerCase();
      if (idStr) addToIndex(`id:${idStr}`, pr);
    }

    const authorLogin = pr.author?.login?.toLowerCase();
    if (authorLogin) {
      // Add to login namespace as lookup checks both fields against username
      addToIndex(`login:${authorLogin}`, pr);
    }
  });

  userPullRequestsCache.set(pullRequests, index);
  return index;
}

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

  const index = getIndexedPullRequests(allPullRequests);
  const results = new Set<PullRequest>();

  const normalizedUsername = username.toLowerCase();
  const loginKey = `login:${normalizedUsername}`;

  if (index.has(loginKey)) {
    index.get(loginKey)!.forEach((pr) => results.add(pr));
  }

  if (userId) {
    const normalizedUserId = userId.toLowerCase();
    const idKey = `id:${normalizedUserId}`;
    if (index.has(idKey)) {
      index.get(idKey)!.forEach((pr) => results.add(pr));
    }
  }

  return Array.from(results);
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
  const percentage =
    allPullRequests.length > 0 ? Math.round((userPRs.length / allPullRequests.length) * 100) : 0;

  // Get organizations from the first PR if available
  const organizations =
    userPRs.length > 0 && userPRs[0].organizations ? userPRs[0].organizations : [];

  // Return the contributor stats object
  return {
    login: username,
    avatar_url: avatarUrl,
    pullRequests: userPRs.length,
    percentage,
    recentPRs: userPRs.slice(0, 5),
    organizations,
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
        Accept: 'application/vnd.github.v3+json',
      };

      // Try to get user's GitHub token from Supabase session
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userToken = session?.provider_token;
      const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;

      if (token) {
        headers.Authorization = `token ${token}`;
      }

      const orgs = await fetchUserOrganizations(username, headers);
      stats.organizations = orgs;
    } catch {
      // Keep empty organizations array on error
    }
  }

  return stats;
}

// Cache for contributor activity counts to avoid expensive recalculations
const activityCountsCache = new WeakMap<
  PullRequest[],
  Record<string, { reviews: number; comments: number }>
>();

/**
 * Efficiently calculates review and comment counts for all contributors
 * Uses caching to prevent recalculation when pullRequests array reference hasn't changed
 */
export function getContributorActivityCounts(
  pullRequests: PullRequest[]
): Record<string, { reviews: number; comments: number }> {
  if (activityCountsCache.has(pullRequests)) {
    return activityCountsCache.get(pullRequests)!;
  }

  const counts: Record<string, { reviews: number; comments: number }> = {};

  pullRequests.forEach((pr) => {
    pr.reviews?.forEach((review) => {
      const login = review.user.login;
      if (!counts[login]) {
        counts[login] = { reviews: 0, comments: 0 };
      }
      counts[login].reviews++;
    });

    pr.comments?.forEach((comment) => {
      const login = comment.user.login;
      if (!counts[login]) {
        counts[login] = { reviews: 0, comments: 0 };
      }
      counts[login].comments++;
    });
  });

  activityCountsCache.set(pullRequests, counts);
  return counts;
}
