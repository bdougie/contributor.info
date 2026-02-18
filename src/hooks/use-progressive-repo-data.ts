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
  historicalTrends: null; // Future enhancement placeholder

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
  includeBots: boolean
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
      setData((prev) => {
        // Correctly merge stageProgress if it exists in updates (e.g. from cache)
        const newStageProgress = updates.stageProgress
          ? { ...prev.stageProgress, ...updates.stageProgress, [stage]: true }
          : { ...prev.stageProgress, [stage]: true };

        return {
          ...prev,
          ...updates,
          currentStage: stage,
          stageProgress: newStageProgress,
        };
      });
    };

    // Stage 1: Load critical data (< 500ms target) - inline function
    const loadCriticalData = async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-critical' }, async (span) => {
        try {
          // Check cache first
          const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
          const cached = progressiveCache[cacheKey];

          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            // Restore the full state from cache, including currentStage
            updateStage(cached.data.currentStage, cached.data);
            // Return cached data info to allow skipping subsequent stages
            return {
              basicInfo: cached.data.basicInfo,
              fromCache: true,
              cachedStage: cached.data.currentStage,
            };
          }

          // Fetch minimal data for above-the-fold content with retry
          const result = await withRetry(
            () => fetchPRDataSmart(owner, repo, { timeRange, mode: 'basic' }),
            {
              maxRetries: 2,
              initialDelay: 500,
            },
            `critical-data-${owner}-${repo}`
          );

          if (!result.data) {
            throw new Error(result.message || 'Failed to fetch data');
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

          return { basicInfo, fromCache: false };
        } catch (error) {
          span?.setStatus('error');
          console.error('Failed to load critical data:', error);
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
            `full-data-${owner}-${repo}`
          );

          if (!result.data) {
            updateStage('full', {
              stats: {
                pullRequests: [],
                loading: false,
                error: result.message || 'Failed to fetch data',
              },
              dataStatus: { status: 'no_data', message: result.message },
            });
            span?.setStatus('error');
            return;
          }

          const pullRequests = result.data;
          const { status, message } = result;

          const stats: RepoStats = {
            pullRequests: pullRequests || [],
            loading: false,
            error: null,
          };

          // Update stage immediately with null lottery factor to avoid blocking
          updateStage('full', {
            stats,
            lotteryFactor: null,
            dataStatus: {
              status: (status === 'error' ? 'no_data' : status) || 'success',
              message,
              metadata: { prCount: pullRequests?.length || 0 },
            },
          });

          // Defer lottery factor calculation to idle time to reduce TBT
          if (pullRequests && pullRequests.length > 0) {
            const calculateAndUpdate = () => {
              if (abortController.signal.aborted) return;
              const lotteryFactor = calculateLotteryFactor(pullRequests);

              setData((prev) => {
                // Cache the results with lottery factor
                const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
                progressiveCache[cacheKey] = {
                  data: { ...prev, stats, lotteryFactor },
                  timestamp: Date.now(),
                };
                return { ...prev, lotteryFactor };
              });
            };

            if ('requestIdleCallback' in window) {
              requestIdleCallback(calculateAndUpdate, { timeout: 2000 });
            } else {
              setTimeout(calculateAndUpdate, 100);
            }
          } else {
            // Cache without lottery factor for empty data
            setData((currentData) => {
              const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
              progressiveCache[cacheKey] = {
                data: { ...currentData, stats, lotteryFactor: null },
                timestamp: Date.now(),
              };
              return currentData;
            });
          }

          return { stats, lotteryFactor: null };
        } catch (error) {
          span?.setStatus('error');
          console.error('Failed to load full data:', error);
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
            `enhancement-data-${owner}-${repo}`
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
        } catch (error) {
          span?.setStatus('error');
          console.error('Failed to load enhancement data:', error);
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
        const criticalResult = await loadCriticalData(owner, repo);

        if (abortController.signal.aborted) return;

        // Optimization: If we loaded complete data from cache, we can skip the rest
        if (criticalResult?.fromCache) {
          // If cached data was at least 'full' (or better), we have stats and lottery factor
          // So we can skip loadFullData
          if (
            criticalResult.cachedStage === 'full' ||
            criticalResult.cachedStage === 'enhancement' ||
            criticalResult.cachedStage === 'complete'
          ) {
            // If cached data was complete, we can skip everything
            if (criticalResult.cachedStage === 'complete') {
              return;
            }

            // If we are here, we might need enhancement data (direct commits)
            // But currently enhancement data is not fully cached in progressiveCache (only stats are)
            // So we should proceed to loadEnhancementData unless we are sure.

            // However, we CAN skip loadFullData which is the heavy lifting
            if (abortController.signal.aborted) return;

            // Skip Stage 2 and go to Stage 3
            if ('requestIdleCallback' in window) {
              requestIdleCallback(
                () => {
                  if (!abortController.signal.aborted) {
                    loadEnhancementData(owner, repo);
                  }
                },
                { timeout: 5000 }
              );
            } else {
              setTimeout(() => {
                if (!abortController.signal.aborted) {
                  loadEnhancementData(owner, repo);
                }
              }, 2000);
            }
            return;
          }
        }

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
            { timeout: 5000 }
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
        console.error('Progressive loading error:', error);
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
export function useDataStageReady(data: ProgressiveDataState, stage: LoadingStage): boolean {
  return data.stageProgress[stage] || false;
}
