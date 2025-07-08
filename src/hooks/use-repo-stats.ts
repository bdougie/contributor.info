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
  const getFilteredPullRequests = useCallback((includeBots: boolean = false): PullRequest[] => {
    if (includeBots) {
      return context.stats.pullRequests;
    }
    
    return context.stats.pullRequests.filter(pr => {
      // Check if user is not a bot
      return pr.user.type !== 'Bot' && !pr.user.login.includes('[bot]');
    });
  }, [context.stats.pullRequests]);
  
  /**
   * Get statistics about contributors
   * @param includeBots - Whether to include bot accounts
   * @returns Object with contributor statistics
   */
  const getContributorStats = useCallback((includeBots: boolean = false) => {
    const pullRequests = getFilteredPullRequests(includeBots);
    
    // Get unique contributors
    const contributorSet = new Set(pullRequests.map(pr => pr.user.login));
    const uniqueContributors = Array.from(contributorSet);
    
    // Calculate PRs per contributor
    const contributorCounts = pullRequests.reduce((acc, pr) => {
      const login = pr.user.login;
      acc[login] = (acc[login] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Sort contributors by PR count
    const sortedContributors = uniqueContributors
      .map(login => ({ 
        login, 
        count: contributorCounts[login],
        avatarUrl: pullRequests.find(pr => pr.user.login === login)?.user.avatar_url || ''
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalContributors: uniqueContributors.length,
      totalPullRequests: pullRequests.length,
      topContributors: sortedContributors.slice(0, 5),
      contributorCounts
    };
  }, [getFilteredPullRequests]);
  
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
    const [prs, directCommits] = await Promise.all([
      fetchPRDataWithFallback(owner, repo, timeRange),
      fetchDirectCommitsWithDatabaseFallback(owner, repo, timeRange),
    ]);
    
    const lotteryFactor = calculateLotteryFactor(prs, timeRange, includeBots);
    
    return {
      pullRequests: prs,
      lotteryFactor,
      directCommitsData: {
        hasYoloCoders: directCommits.hasYoloCoders,
        yoloCoderStats: directCommits.yoloCoderStats,
      }
    };
  };
  
  return {
    ...context,
    getFilteredPullRequests,
    getContributorStats,
    fetchRepoData
  };
}