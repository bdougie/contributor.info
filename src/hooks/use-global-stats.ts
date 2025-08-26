import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface GlobalStats {
  totalRepositories: number;
  totalContributors: number;
  totalPullRequests: number;
  isLoading: boolean;
  error: Error | null;
}

interface CachedGlobalStats extends GlobalStats {
  timestamp: number;
}

const CACHE_KEY = 'contributor_info_global_stats';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Hook to fetch global statistics with 24-hour caching
 * Data is stored in localStorage and refreshed once every 24 hours
 */
export function useGlobalStats(): GlobalStats {
  const [stats, setStats] = useState<GlobalStats>({
    totalRepositories: 0,
    totalContributors: 0,
    totalPullRequests: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchGlobalStats() {
      try {
        // Check for cached data
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const parsed: CachedGlobalStats = JSON.parse(cachedData);
          const now = Date.now();

          // If cache is still valid (less than 24 hours old), use it
          if (now - parsed.timestamp < CACHE_DURATION) {
            setStats({
              totalRepositories: parsed.totalRepositories,
              totalContributors: parsed.totalContributors,
              totalPullRequests: parsed.totalPullRequests,
              isLoading: false,
              error: null,
            });
            return;
          }
        }
        // Fetch total repositories count
        const { count: repoCount, error: repoError } = await supabase
          .from('repositories')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (repoError) throw repoError;

        // Fetch total contributors count (excluding bots)
        const { count: contributorCount, error: contributorError } = await supabase
          .from('contributors')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_bot', false);

        if (contributorError) throw contributorError;

        // Fetch total pull requests count
        const { count: prCount, error: prError } = await supabase
          .from('pull_requests')
          .select('*', { count: 'exact', head: true });

        if (prError) throw prError;

        const newStats = {
          totalRepositories: repoCount || 0,
          totalContributors: contributorCount || 0,
          totalPullRequests: prCount || 0,
          isLoading: false,
          error: null,
        };

        // Update state
        setStats(newStats);

        // Cache the data with timestamp
        const cacheData: CachedGlobalStats = {
          ...newStats,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } catch (error) {
        console.error(, error);
        setStats((prev) => ({
          ...prev,
          isLoading: false,
          error: error as Error,
        }));
      }
    }

    fetchGlobalStats();
  }, []);

  return stats;
}
