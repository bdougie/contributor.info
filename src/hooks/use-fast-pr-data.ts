import { useState, useEffect, useRef } from 'react';
import { fetchPRDataWithFallback } from '@/lib/supabase-pr-data';
import type { PullRequest, TimeRange } from '@/lib/types';

// Fast cache for PR data only (separate from full repo cache)
interface FastPRCache {
  [key: string]: {
    pullRequests: PullRequest[];
    timestamp: number;
  };
}

// Shorter cache duration for faster updates (2 minutes)
const FAST_CACHE_DURATION = 2 * 60 * 1000;

// Global cache for PR data
const fastPRCache: FastPRCache = {};

/**
 * Fast hook for fetching just PR data with aggressive caching
 * This allows PR activity to load immediately while other components
 * can still use the comprehensive cached repo data
 */
export function useFastPRData(
  owner: string | undefined,
  repo: string | undefined,
  timeRange: TimeRange
) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchingRef = useRef(false);

  useEffect(() => {
    async function loadPRs() {
      if (!owner || !repo || fetchingRef.current) return;

      const cacheKey = `${owner}/${repo}/${timeRange}`;
      const now = Date.now();
      const cachedData = fastPRCache[cacheKey];

      // Check for cached data first
      if (cachedData && now - cachedData.timestamp < FAST_CACHE_DURATION) {
        setPullRequests(cachedData.pullRequests);
        setLoading(false);
        setError(null);
        return;
      }

      // If we have stale data, show it immediately while fetching fresh data
      if (cachedData && cachedData.pullRequests.length > 0) {
        setPullRequests(cachedData.pullRequests);
        setLoading(false);
        setError(null);
        // Continue to fetch fresh data in background
      } else {
        setLoading(true);
      }

      try {
        fetchingRef.current = true;

        const dataResult = await fetchPRDataWithFallback(owner, repo, timeRange);
        const prs = dataResult.data;

        // Cache the results
        fastPRCache[cacheKey] = {
          pullRequests: prs,
          timestamp: now,
        };

        // Clean up old cache entries (keep only last 5)
        const cacheKeys = Object.keys(fastPRCache);
        if (cacheKeys.length > 5) {
          const sortedKeys = cacheKeys.sort(
            (a, b) => fastPRCache[b].timestamp - fastPRCache[a].timestamp
          );
          sortedKeys.slice(5).forEach((key) => {
            delete fastPRCache[key];
          });
        }

        setPullRequests(prs);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pull requests');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    }

    loadPRs();
  }, [owner, repo, timeRange]);

  return { pullRequests, loading, error };
}
