import { useState, useEffect } from 'react';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataWithFallback } from '@/lib/supabase-pr-data';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';

/**
 * Hook for fetching and managing repository data
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param timeRange - Time range for data fetching
 * @param includeBots - Whether to include bot accounts in analysis
 */
export function useRepoData(
  owner: string | undefined,
  repo: string | undefined,
  timeRange: TimeRange,
  includeBots: boolean,
) {
  const [stats, setStats] = useState<RepoStats>({
    pullRequests: [],
    loading: true,
    error: null,
  });
  const [lotteryFactor, setLotteryFactor] = useState<LotteryFactor | null>(null);
  const [directCommitsData, setDirectCommitsData] = useState<DirectCommitsData | null>(null);

  useEffect(() => {
    async function loadPRData() {
      if (!owner || !repo) return;

      try {
        setStats((prev) => ({ ...prev, loading: true, _error: null }));

        // Fetch pull requests and direct commits in parallel
        const [prDataResult, directCommits] = await Promise.all([
          fetchPRDataWithFallback(owner, repo, timeRange),
          fetchDirectCommitsWithDatabaseFallback(owner, repo, timeRange),
        ]);

        const prs = prDataResult.data;
        setStats({ pullRequests: prs, loading: false, _error: null });
        setLotteryFactor(calculateLotteryFactor(prs, timeRange, includeBots));
        setDirectCommitsData({
          hasYoloCoders: directCommits.hasYoloCoders,
          yoloCoderStats: directCommits.yoloCoderStats,
        });
      } catch () {
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data',
        }));
      }
    }

    loadPRData();
  }, [owner, repo, timeRange, includeBots]);

  return { stats, lotteryFactor, directCommitsData };
}
