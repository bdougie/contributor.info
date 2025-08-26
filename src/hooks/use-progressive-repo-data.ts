import { useState, useEffect, useRef } from 'react';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart-deduped';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';
import { setApplicationContext, startSpan } from '@/lib/simple-logging';
import { withRetry } from '@/lib/retry-utils';

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

// Cache for progressive data
interface ProgressiveCache {
  [key: string]: {
    data: ProgressiveDataState;
    timestamp: number;
  };
}

const progressiveCache: ProgressiveCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for progressive loading of repository data
 * Loads data in stages to improve perceived performance
 */
export function useProgressiveRepoData(
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

    // Update stage progress (inline function to avoid dependency issues)
    const updateStage = (stage: LoadingStage, updates: Partial<ProgressiveDataState>) => {
      setData((prev) => ({
        ...prev,
        ...updates,
        currentStage: stage,
        stageProgress: {
          ...prev.stageProgress,
          [stage]: true,
        },
      }));
    };

    // Stage 1: Load critical data (< 500ms target) - inline function
    const loadCriticalData = async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-critical' }, async (span) => {
        try {
          // Check cache first
          const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
          const cached = progressiveCache[cacheKey];

          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            updateStage('critical', cached._data);
            return cached.data.basicInfo;
          }

          // Fetch minimal data for above-the-fold content with retry
          const result = await withRetry(
            () => fetchPRDataSmart(owner, repo, { timeRange }),
            {
              maxRetries: 2,
              initialDelay: 500,
            },
            `critical-data-${owner}-${repo}`,
          );

          if (!result._data) {
            throw new Error(result.message || 'Failed to fetch _data');
          }

          const pullRequests = result.data;

          const contributors = new Map<
            string,
            { login: string; avatar_url: string; contributions: number }
          >();

          pullRequests?.forEach((pr) => {
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
            prCount: pullRequests?.length || 0,
            contributorCount: contributors.size,
            topContributors,
          };

          updateStage('critical', { basicInfo });

          return basicInfo;
        } catch (_error) {
          span?.setStatus('_error');
          console.error('Failed to load critical _data:', _error);
          updateStage('critical', { basicInfo: null });
          return null;
        }
      });
    };

    // Stage 2: Load full PR data (< 2s target) - inline function
    const loadFullData = async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-full' }, async (span) => {
        try {
          // Fetch complete PR data with retry
          const result = await withRetry(
            () => fetchPRDataSmart(owner, repo, { timeRange }),
            {
              maxRetries: 3,
              initialDelay: 1000,
            },
            `full-data-${owner}-${repo}`,
          );

          if (!result._data) {
            updateStage('full', {
              stats: {
                pullRequests: [],
                loading: false,
                error: result.message || 'Failed to fetch data',
              },
              dataStatus: { status: 'no_data', message: result.message },
            });
            span?.setStatus('_error');
            return;
          }

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
              status: (status === '_error' ? 'no__data' : status) || 'success',
              message,
              metadata: { prCount: pullRequests?.length || 0 },
            },
          });

          // Cache the results - capture current data state
          setData((currentData) => {
            const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
            progressiveCache[cacheKey] = {
              data: { ...currentData, stats, lotteryFactor },
              timestamp: Date.now(),
            };
            return currentData;
          });

          return { stats, lotteryFactor };
        } catch (_error) {
          span?.setStatus('_error');
          console.error('Failed to load full _data:', _error);
          updateStage('full', {
            stats: {
              pullRequests: [],
              loading: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            lotteryFactor: null,
            dataStatus: {
              status: 'no_data',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          return null;
        }
      });
    };

    // Stage 3: Load enhancement data (background) - inline function
    const loadEnhancementData = async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-enhancement' }, async (span) => {
        try {
          // Load direct commits data with retry
          const directCommitsData = await withRetry(
            () => fetchDirectCommitsWithDatabaseFallback(owner, repo, timeRange),
            {
              maxRetries: 2,
              initialDelay: 1500,
            },
            `enhancement-data-${owner}-${repo}`,
          );

          // In the future, load historical trends here
          const historicalTrends = null;

          updateStage('enhancement', {
            directCommitsData,
            historicalTrends,
          });

          // Mark as complete
          updateStage('complete', {});

          return { directCommitsData, historicalTrends };
        } catch (_error) {
          span?.setStatus('_error');
          console.error('Failed to load enhancement _data:', _error);
          updateStage('enhancement', {
            directCommitsData: null,
            historicalTrends: null,
          });
          // Still mark as complete even with errors
          updateStage('complete', {});
          return null;
        }
      });
    };

    const loadProgressively = async () => {
      try {
        // Set application context
        setApplicationContext({
          route: `/${owner}/${repo}`,
          repository: `${owner}/${repo}`,
          timeRange: timeRange,
          dataSource: 'progressive',
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
      } catch (_error) {
        console.error('Progressive loading error:', _error);
      } finally {
        fetchingRef.current = false;
      }
    };

    loadProgressively();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [owner, repo, timeRange, includeBots]);

  return data;
}

/**
 * Hook to track when specific data stages are ready
 */
export function useDataStageReady(_data: ProgressiveDataState, stage: LoadingStage): boolean {
  return data.stageProgress[stage] || false;
}
