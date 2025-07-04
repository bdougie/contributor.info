import { useState, useEffect, useRef } from 'react';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataWithFallback } from '@/lib/supabase-pr-data';
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

// Cache cleanup thresholds
const MAX_CACHE_SIZE = 20;
const CLEANUP_THRESHOLD = 25;
const STALE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for complete cleanup

// Global cache to persist across component re-mounts
const repoDataCache: RepoDataCache = {};

/**
 * Enhanced cache cleanup with age-based expiration
 */
function cleanupCache() {
  const now = Date.now();
  const cacheKeys = Object.keys(repoDataCache);
  
  // First pass: Remove stale entries older than 30 minutes
  cacheKeys.forEach(key => {
    const entry = repoDataCache[key];
    if (now - entry.timestamp > STALE_CACHE_DURATION) {
      delete repoDataCache[key];
    }
  });
  
  // Second pass: If still over threshold, remove oldest entries
  const remainingKeys = Object.keys(repoDataCache);
  if (remainingKeys.length > MAX_CACHE_SIZE) {
    const sortedKeys = remainingKeys.sort((a, b) => 
      repoDataCache[a].timestamp - repoDataCache[b].timestamp
    );
    
    // Remove oldest entries to get back to MAX_CACHE_SIZE
    const keysToRemove = sortedKeys.slice(0, remainingKeys.length - MAX_CACHE_SIZE);
    keysToRemove.forEach(key => {
      delete repoDataCache[key];
    });
  }
}

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
          fetchPRDataWithFallback(owner, repo, timeRange),
          fetchDirectCommitsWithDatabaseFallback(owner, repo, timeRange),
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

        // Perform enhanced cache cleanup when threshold is reached
        if (Object.keys(repoDataCache).length > CLEANUP_THRESHOLD) {
          cleanupCache();
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