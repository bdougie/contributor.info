import { useState, useEffect, useContext, useRef } from 'react';
import { ContributorStats } from '@/lib/types';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { fetchUserOrganizations } from '@/lib/github';

interface UseContributorDataProps {
  username: string;
  avatarUrl: string;
}

// Create a cache to store fetched contributor data
const contributorCache = new Map<string, ContributorStats>();

// Add a function to clear the cache when needed
export function clearContributorCache() {
  contributorCache.clear();
}

export function useContributorData({
  username,
  avatarUrl,
}: UseContributorDataProps): ContributorStats {
  const [contributorData, setContributorData] = useState<ContributorStats>({
    login: username,
    avatar_url: avatarUrl,
    pullRequests: 0,
    percentage: 0,
  });

  const { stats } = useContext(RepoStatsContext);
  const prevStatsRef = useRef(stats.pullRequests);

  useEffect(() => {
    // Clear cache when pullRequests data changes (new repo, time range, etc)
    if (prevStatsRef.current !== stats.pullRequests) {
      clearContributorCache();
      prevStatsRef.current = stats.pullRequests;
    }

    // Check if we already have this user in the cache
    const cacheKey = username.toLowerCase();
    if (contributorCache.has(cacheKey)) {
      setContributorData(contributorCache.get(cacheKey)!);
      return;
    }

    const fetchData = async () => {
      if (!username || !stats.pullRequests || stats.pullRequests.length === 0) return;

      // Performance optimized user lookup

      // Find PRs by this user - check both login and name fields
      const userPRs = stats.pullRequests.filter((pr) => {
        // Check various possible matches to handle different data formats
        const prUserLogin = pr.user?.login?.toLowerCase();
        const authorLogin = pr.author?.login?.toLowerCase();
        const usernameToCheck = username.toLowerCase();

        return (
          prUserLogin === usernameToCheck ||
          authorLogin === usernameToCheck ||
          // Sometimes PR data might store display name rather than username
          prUserLogin?.includes(usernameToCheck) ||
          usernameToCheck.includes(prUserLogin || '')
        );
      });

      // Found PRs for user calculation

      // Calculate percentage
      const percentage = (userPRs.length / stats.pullRequests.length) * 100;

      // Fetch organizations data
      let organizations: Array<{ login: string; avatar_url: string }> = [];
      try {
        // This assumes you have a function to fetch user organizations
        const headers = {
          Accept: 'application/vnd.github.v3+json',
        };
        organizations = await fetchUserOrganizations(username, headers);
      } catch (_error) {
        organizations = [];
      }

      const userData = {
        login: username,
        avatar_url: avatarUrl,
        pullRequests: userPRs.length,
        percentage,
        recentPRs: userPRs.slice(0, 5),
        organizations,
      };

      // Store in cache
      contributorCache.set(cacheKey, userData);

      setContributorData(userData);
    };

    fetchData();
  }, [username, avatarUrl, stats.pullRequests]);

  return contributorData;
}
