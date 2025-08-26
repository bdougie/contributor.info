import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';
import { setApplicationContext, startSpan } from '@/lib/simple-logging';
import { requestDeduplicator, RequestDeduplicator } from '@/lib/utils/request-deduplicator';

// Loading stages for progressive data loading
export type LoadingStage = 'initial' | 'critical' | 'full' | 'enhancement' | 'complete';

export interface ProgressiveDataState {
  // Critical data (loaded first)
  basicInfo: {
    prCount: number;
    contributorCount: number;
    topContributors: Array<{ login: string; avatar_url: string; contributions: number }>;
  } | null;

  // Full data (loaded second)
  stats: RepoStats;
  lotteryFactor: LotteryFactor | null;

  // Enhancement data (loaded last)
  directCommitsData: DirectCommitsData | null;
  historicalTrends: unknown | null;

  // Loading state
  currentStage: LoadingStage;
  stageProgress: Record<LoadingStage, boolean>;
  dataStatus: {
    status: 'success' | 'pending' | 'no_data' | 'partial_data' | 'large_repository_protected';
    message?: string;
    metadata?: Record<string, unknown>;
  };
}

// Cache for progressive data (kept for backward compatibility with existing patterns)
interface ProgressiveCache {
  [key: string]: {
    data: ProgressiveDataState;
    timestamp: number;
  };
}

const progressiveCache: ProgressiveCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Enhanced hook for progressive loading with request deduplication
 * Prevents duplicate API calls when multiple components mount concurrently
 */
export function useProgressiveRepoDataWithDeduplication(
  owner: string | undefined,
  repo: string | undefined,
  timeRange: TimeRange,
  includeBots: boolean,
) {
  const [data, setData] = useState<ProgressiveDataState>({
    basicInfo: null,
    stats: {
      pullRequests: [],
      loading: true,
      error: null,
    },
    lotteryFactor: null,
    directCommitsData: null,
    historicalTrends: null,
    currentStage: 'initial',
    stageProgress: {
      initial: false,
      critical: false,
      full: false,
      enhancement: false,
      complete: false,
    },
    dataStatus: { status: 'pending' },
  });

  const fetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update stage progress
  const updateStage = useCallback((stage: LoadingStage, updates: Partial<ProgressiveDataState>) => {
    setData((prev) => ({
      ...prev,
      ...updates,
      currentStage: stage,
      stageProgress: {
        ...prev.stageProgress,
        [stage]: true,
      },
    }));
  }, []);

  // Stage 1: Load critical data with deduplication
  const loadCriticalData = useCallback(
    async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-critical-deduped' }, async (span) => {
        try {
          // Generate deduplication key for this specific request
          const dedupeKey = RequestDeduplicator.generateKey.progressiveStage(
            'critical',
            owner,
            repo,
            timeRange,
            includeBots,
          );

          // Use request deduplicator to prevent concurrent calls
          const result = await requestDeduplicator.dedupe(
            dedupeKey,
            async () => {
              // Check cache first (existing pattern)
              const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
              const cached = progressiveCache[cacheKey];

              if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                return { cached: true, data: cached.data, pullRequests: null };
              }

              // Fetch minimal data for above-the-fold content
              const fetchResult = await fetchPRDataSmart(owner, repo, {
                timeRange,
              });

              if (!fetchResult._data) {
                throw new Error(fetchResult.message || 'Failed to fetch _data');
              }

              return { cached: false, data: null, pullRequests: fetchResult.data };
            },
            { ttl: 5000, abortable: true },
          );

          // Handle cached vs fresh data
          if (result.cached && result._data) {
            updateStage('critical', result._data);
            return result.data.basicInfo;
          }

          // Process fresh data
          const pullRequests = result.pullRequests;
          if (!pullRequests) {
            throw new Error('No pull request _data available');
          }

          const contributors = new Map<
            string,
            { login: string; avatar_url: string; contributions: number }
          >();

          pullRequests.forEach((pr: unknown) => {
            const author = pr.user?.login;
            if (author) {
              const existing = contributors.get(author) || {
                login: author,
                avatar_url: pr.user.avatar_url || '',
                contributions: 0,
              };
              existing.contributions++;
              contributors.set(author, existing);
            }
          });

          const topContributors = Array.from(contributors.values())
            .sort((a, b) => b.contributions - a.contributions)
            .slice(0, 5);

          const basicInfo = {
            prCount: pullRequests.length,
            contributorCount: contributors.size,
            topContributors,
          };

          updateStage('critical', { basicInfo });

          return basicInfo;
        } catch (error) {
          span?.setStatus('error');
          console.error("Error:", error);
          return null;
        }
      });
    },
    [timeRange, includeBots, updateStage],
  );

  // Stage 2: Load full PR data with deduplication
  const loadFullData = useCallback(
    async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-full-deduped' }, async (span) => {
        try {
          const dedupeKey = RequestDeduplicator.generateKey.progressiveStage(
            'full',
            owner,
            repo,
            timeRange,
            includeBots,
          );

          const result = await requestDeduplicator.dedupe(
            dedupeKey,
            async () => {
              // Fetch complete PR data
              const fetchResult = await fetchPRDataSmart(owner, repo, {
                timeRange,
              });

              if (!fetchResult._data) {
                throw new Error(fetchResult.message || 'Failed to fetch _data');
              }

              return fetchResult;
            },
            { ttl: 5000, abortable: true },
          );

          const pullRequests = result.data;
          const { status, message } = result;

          const stats: RepoStats = {
            pullRequests: pullRequests || [],
            loading: false,
            error: null,
          };

          // Calculate lottery factor if we have data
          const lotteryFactor =
            pullRequests && pullRequests.length > 0 ? calculateLotteryFactor(pullRequests) : null;

          updateStage('full', {
            stats,
            lotteryFactor,
            dataStatus: {
              status: (status === 'error' ? 'no__data' : status) || 'success',
              message,
              metadata: { prCount: pullRequests?.length || 0 },
            },
          });

          // Don't cache here - caching happens elsewhere in the flow

          return { stats, lotteryFactor };
        } catch (error) {
          span?.setStatus('error');
          console.error("Error:", error);
          return null;
        }
      });
    },
    [timeRange, includeBots, updateStage],
  );

  // Stage 3: Load enhancement data with deduplication
  const loadEnhancementData = useCallback(
    async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-enhancement-deduped' }, async (span) => {
        try {
          const dedupeKey = RequestDeduplicator.generateKey.progressiveStage(
            'enhancement',
            owner,
            repo,
            timeRange,
            includeBots,
          );

          const result = await requestDeduplicator.dedupe(
            dedupeKey,
            async () => {
              // Load direct commits data
              const directCommitsData = await fetchDirectCommitsWithDatabaseFallback(
                owner,
                repo,
                timeRange,
              );

              // In the future, load historical trends here
              const historicalTrends = null;

              return { directCommitsData, historicalTrends };
            },
            { ttl: 10000, abortable: true }, // Longer TTL for enhancement data
          );

          updateStage('enhancement', {
            directCommitsData: result.directCommitsData,
            historicalTrends: result.historicalTrends,
          });

          // Mark as complete
          updateStage('complete', {});

          return result;
        } catch (error) {
          span?.setStatus('error');
          console.error("Error:", error);
          return null;
        }
      });
    },
    [timeRange, includeBots, updateStage],
  );

  // Main effect to orchestrate progressive loading
  useEffect(() => {
    if (!owner || !repo || fetchingRef.current) return;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    fetchingRef.current = true;

    const loadProgressively = async () => {
      try {
        // Set application context
        setApplicationContext({
          route: `/${owner}/${repo}`,
          repository: `${owner}/${repo}`,
          timeRange: timeRange,
          dataSource: 'progressive-deduped',
        });

        // Stage 1: Critical data (immediate)
        await loadCriticalData(owner, repo);

        if (abortController.signal.aborted) return;

        // Stage 2: Full data (after critical)
        await loadFullData(owner, repo);

        if (abortController.signal.aborted) return;

        // Stage 3: Enhancement data (in background with idle callback)
        if ('requestIdleCallback' in window) {
          requestIdleCallback(
            () => {
              if (!abortController.signal.aborted) {
                loadEnhancementData(owner, repo);
              }
            },
            { timeout: 5000 },
          );
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => {
            if (!abortController.signal.aborted) {
              loadEnhancementData(owner, repo);
            }
          }, 2000);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        fetchingRef.current = false;
      }
    };

    loadProgressively();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Cancel any pending deduplicated requests for this component
      if (owner && repo) {
        const stages = ['critical', 'full', 'enhancement'];
        stages.forEach((stage) => {
          const key = RequestDeduplicator.generateKey.progressiveStage(
            stage,
            owner,
            repo,
            timeRange,
            includeBots,
          );
          requestDeduplicator.cancel(key);
        });
      }
    };
  }, [owner, repo, timeRange, includeBots, loadCriticalData, loadFullData, loadEnhancementData]);

  return data;
}

/**
 * Hook to track when specific data stages are ready
 */
export function useDataStageReady(_data: ProgressiveDataState, stage: LoadingStage): boolean {
  return data.stageProgress[stage] || false;
}

/**
 * Hook to get request deduplication stats for monitoring
 */
export function useRequestDeduplicationStats() {
  return requestDeduplicator.getStats();
}
