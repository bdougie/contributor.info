import { useState, useEffect, useRef } from 'react';
import { fetchPullRequests, fetchDirectCommits } from '@/lib/github';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';

// Cache interface
interface RepoDataCache {
  [key: string]: {
    stats: RepoStats;
    lotteryFactor: LotteryFactor | null;
    directCommitsData: DirectCommitsData | null;
    timestamp: number;
  };
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Global cache to persist across component re-mounts
const repoDataCache: RepoDataCache = {};

/**
 * Cached hook for fetching and managing repository data
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param timeRange - Time range for data fetching
 * @param includeBots - Whether to include bot accounts in analysis
 */
export function useCachedRepoData(
  owner: string | undefined, 
  repo: string | undefined, 
  timeRange: TimeRange, 
  includeBots: boolean
) {
  const [stats, setStats] = useState<RepoStats>({
    pullRequests: [],
    loading: true,
    error: null,
  });
  const [lotteryFactor, setLotteryFactor] = useState<LotteryFactor | null>(null);
  const [directCommitsData, setDirectCommitsData] = useState<DirectCommitsData | null>(null);

  // Track if we're currently fetching to prevent duplicate requests
  const fetchingRef = useRef(false);

  useEffect(() => {
    async function loadPRData() {
      if (!owner || !repo || fetchingRef.current) return;

      // Create cache key
      const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
      const now = Date.now();
      const cachedData = repoDataCache[cacheKey];

      // Check if we have valid cached data
      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        setStats(cachedData.stats);
        setLotteryFactor(cachedData.lotteryFactor);
        setDirectCommitsData(cachedData.directCommitsData);
        return;
      }

      try {
        fetchingRef.current = true;
        setStats((prev) => ({ ...prev, loading: true, error: null }));

        // Fetch pull requests and direct commits in parallel
        const [prs, directCommits] = await Promise.all([
          fetchPullRequests(owner, repo, timeRange),
          fetchDirectCommits(owner, repo, timeRange),
        ]);

        const newStats = { pullRequests: prs, loading: false, error: null };
        const newLotteryFactor = calculateLotteryFactor(prs, timeRange, includeBots);
        const newDirectCommitsData = {
          hasYoloCoders: directCommits.hasYoloCoders,
          yoloCoderStats: directCommits.yoloCoderStats,
        };

        // Cache the results
        repoDataCache[cacheKey] = {
          stats: newStats,
          lotteryFactor: newLotteryFactor,
          directCommitsData: newDirectCommitsData,
          timestamp: now,
        };

        // Clean up old cache entries (keep only last 20)
        const cacheKeys = Object.keys(repoDataCache);
        if (cacheKeys.length > 20) {
          const sortedKeys = cacheKeys.sort((a, b) => 
            repoDataCache[b].timestamp - repoDataCache[a].timestamp
          );
          sortedKeys.slice(20).forEach(key => {
            delete repoDataCache[key];
          });
        }

        setStats(newStats);
        setLotteryFactor(newLotteryFactor);
        setDirectCommitsData(newDirectCommitsData);
      } catch (error) {
        const errorStats = {
          pullRequests: [],
          loading: false,
          error: error instanceof Error ? error.message : "Failed to fetch data",
        };
        setStats(errorStats);
      } finally {
        fetchingRef.current = false;
      }
    }

    loadPRData();
  }, [owner, repo, timeRange, includeBots]);

  return { stats, lotteryFactor, directCommitsData };
}