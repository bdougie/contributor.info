import { useContext, useCallback } from 'react';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import type { PullRequest, TimeRange } from '@/lib/types';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataWithFallback } from '@/lib/supabase-pr-data';
import { calculateLotteryFactor } from '@/lib/utils';

/**
 * Hook for accessing and managing repository statistics
 * Can be used as a replacement for the context when appropriate
 */
export function useRepoStats() {
  // Get stats from context
  const context = useContext(RepoStatsContext);

  if (!context) {
    throw new Error('useRepoStats must be used within a RepoStatsProvider');
  }

  /**
   * Filters pull requests to exclude bots if needed
   * @param includeBots - Whether to include bot accounts
   * @returns Filtered array of pull requests
   */
  const getFilteredPullRequests = useCallback(
    (includeBots: boolean = false): PullRequest[] => {
      if (includeBots) {
        return context.stats.pullRequests;
      }

      return context.stats.pullRequests.filter((pr) => {
        // Check if user is not a bot
        return pr.user.type !== 'Bot' && !pr.user.login.includes('[bot]');
      });
    },
    [context.stats.pullRequests]
  );

  /**
   * Get statistics about contributors
   * @param includeBots - Whether to include bot accounts
   * @returns Object with contributor statistics
   */
  const getContributorStats = useCallback(
    (includeBots: boolean = false) => {
      const pullRequests = getFilteredPullRequests(includeBots);

      // ⚡ Bolt Optimization: Replace O(N*U) nested find with single O(N) pass
      // N = number of PRs, U = number of unique contributors
      // We use a Map to track unique contributors and their counts/avatars simultaneously
      // reducing both iterations and array allocations.
      const contributorCounts: Record<string, number> = {};
      const topContributorsMap = new Map<
        string,
        { login: string; count: number; avatarUrl: string }
      >();

      for (let i = 0; i < pullRequests.length; i++) {
        const pr = pullRequests[i];
        const login = pr.user.login;

        const count = (contributorCounts[login] || 0) + 1;
        contributorCounts[login] = count;

        const existing = topContributorsMap.get(login);
        if (existing) {
          existing.count = count;
        } else {
          topContributorsMap.set(login, {
            login,
            count: 1,
            avatarUrl: pr.user.avatar_url || '',
          });
        }
      }

      // Sort contributors by PR count
      const sortedContributors = Array.from(topContributorsMap.values()).sort(
        (a, b) => b.count - a.count
      );

      return {
        totalContributors: topContributorsMap.size,
        totalPullRequests: pullRequests.length,
        topContributors: sortedContributors.slice(0, 5),
        contributorCounts,
      };
    },
    [getFilteredPullRequests]
  );

  /**
   * Manually fetch repository data for a specific repo
   * Useful when the component is not within a RepoStatsProvider
   */
  const fetchRepoData = async (
    owner: string,
    repo: string,
    timeRange: TimeRange,
    includeBots: boolean = false
  ) => {
    const [prDataResult, directCommits] = await Promise.all([
      fetchPRDataWithFallback(owner, repo, timeRange),
      fetchDirectCommitsWithDatabaseFallback(owner, repo, timeRange),
    ]);

    const prs = prDataResult.data;
    const lotteryFactor = calculateLotteryFactor(prs, timeRange, includeBots);

    return {
      pullRequests: prs,
      lotteryFactor,
      directCommitsData: {
        hasYoloCoders: directCommits.hasYoloCoders,
        yoloCoderStats: directCommits.yoloCoderStats,
      },
    };
  };

  return {
    ...context,
    getFilteredPullRequests,
    getContributorStats,
    fetchRepoData,
  };
}
