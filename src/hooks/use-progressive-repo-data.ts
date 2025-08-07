import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart-deduped';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';
import { setApplicationContext, startSpan } from '@/lib/simple-logging';

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
  historicalTrends: any | null;
  
  // Loading state
  currentStage: LoadingStage;
  stageProgress: Record<LoadingStage, boolean>;
  dataStatus: {
    status: 'success' | 'pending' | 'no_data' | 'partial_data' | 'large_repository_protected';
    message?: string;
    metadata?: Record<string, any>;
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

  // Update stage progress
  const updateStage = useCallback((stage: LoadingStage, updates: Partial<ProgressiveDataState>) => {
    setData(prev => ({
      ...prev,
      ...updates,
      currentStage: stage,
      stageProgress: {
        ...prev.stageProgress,
        [stage]: true,
      },
    }));
  }, []);

  // Stage 1: Load critical data (< 500ms target)
  const loadCriticalData = useCallback(async (owner: string, repo: string) => {
    return startSpan(
      { name: 'progressive-load-critical' },
      async (span) => {
        try {
          // Check cache first
          const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
          const cached = progressiveCache[cacheKey];
          
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            updateStage('critical', cached.data);
            return cached.data.basicInfo;
          }

          // Fetch minimal data for above-the-fold content
          const result = await fetchPRDataSmart(
            owner,
            repo,
            {
              timeRange
            }
          );

          if (!result.data) {
            throw new Error(result.message || 'Failed to fetch data');
          }
          
          const pullRequests = result.data;

          const contributors = new Map<string, { login: string; avatar_url: string; contributions: number }>();
          
          pullRequests?.forEach(pr => {
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
        } catch (error) {
          span?.setStatus('error');
          console.error('Failed to load critical data:', error);
          return null;
        }
      }
    );
  }, [timeRange, includeBots, updateStage]);

  // Stage 2: Load full PR data (< 2s target)
  const loadFullData = useCallback(async (owner: string, repo: string) => {
    return startSpan(
      { name: 'progressive-load-full' },
      async (span) => {
        try {
          // Fetch complete PR data
          const result = await fetchPRDataSmart(
            owner,
            repo,
            {
              timeRange
            }
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

          // Calculate lottery factor if we have data
          const lotteryFactor = pullRequests && pullRequests.length > 0
            ? calculateLotteryFactor(pullRequests)
            : null;

          updateStage('full', {
            stats,
            lotteryFactor,
            dataStatus: { 
              status: (status === 'error' ? 'no_data' : status) || 'success', 
              message,
              metadata: { prCount: pullRequests?.length || 0 }
            },
          });
          
          // Cache the results
          const cacheKey = `${owner}/${repo}/${timeRange}/${includeBots}`;
          progressiveCache[cacheKey] = {
            data: { ...data, stats, lotteryFactor },
            timestamp: Date.now(),
          };
          
          return { stats, lotteryFactor };
        } catch (error) {
          span?.setStatus('error');
          console.error('Failed to load full data:', error);
          return null;
        }
      }
    );
  }, [timeRange, includeBots, data, updateStage]);

  // Stage 3: Load enhancement data (background)
  const loadEnhancementData = useCallback(async (owner: string, repo: string) => {
    return startSpan(
      { name: 'progressive-load-enhancement' },
      async (span) => {
        try {
          // Load direct commits data
          const directCommitsData = await fetchDirectCommitsWithDatabaseFallback(
            owner,
            repo,
            timeRange
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
          return null;
        }
      }
    );
  }, [timeRange, includeBots, updateStage]);

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
          requestIdleCallback(() => {
            if (!abortController.signal.aborted) {
              loadEnhancementData(owner, repo);
            }
          }, { timeout: 5000 });
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
  }, [owner, repo, timeRange, includeBots, loadCriticalData, loadFullData, loadEnhancementData]);

  return data;
}

/**
 * Hook to track when specific data stages are ready
 */
export function useDataStageReady(data: ProgressiveDataState, stage: LoadingStage): boolean {
  return data.stageProgress[stage] || false;
}