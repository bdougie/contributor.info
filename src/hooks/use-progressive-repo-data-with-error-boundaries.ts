import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';
import { setApplicationContext, startSpan } from '@/lib/simple-logging';
import {
  LoadingError,
  LoadingStage,
  createLoadingError,
  canRecoverInNextStage,
  getRetryDelay,
} from '@/lib/types/data-loading-errors';

// Extend the original progressive data state with error handling
export interface EnhancedProgressiveDataState {
  // Original data fields
  basicInfo: {
    prCount: number;
    contributorCount: number;
    topContributors: Array<{ login: string; avatar_url: string; contributions: number }>;
  } | null;
  stats: RepoStats;
  lotteryFactor: LotteryFactor | null;
  directCommitsData: DirectCommitsData | null;
  historicalTrends: any | null;

  // Enhanced loading state with error handling
  currentStage: LoadingStage;
  stageProgress: Record<LoadingStage, boolean>;
  stageErrors: Record<LoadingStage, LoadingError | null>;
  dataStatus: {
    status:
      | 'success'
      | 'pending'
      | 'no_data'
      | 'partial_data'
      | 'large_repository_protected'
      | 'error';
    message?: string;
    metadata?: Record<string, any>;
  };

  // Error recovery state
  retryAttempts: Record<LoadingStage, number>;
  lastRetryTime: Record<LoadingStage, number>;
  isRetrying: LoadingStage | null;

  // Graceful degradation
  hasPartialData: boolean;
  canContinueWithoutStage: Record<LoadingStage, boolean>;
}

// Removed unused cache variables
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Enhanced progressive loading hook with comprehensive error handling
 * Includes retry mechanisms, graceful degradation, and error recovery
 */
export function useProgressiveRepoDataWithErrorBoundaries(
  owner: string | undefined,
  repo: string | undefined,
  timeRange: TimeRange,
  includeBots: boolean,
  options: {
    enableRetry?: boolean;
    enableGracefulDegradation?: boolean;
    onError?: (error: LoadingError, stage: LoadingStage) => void;
    onRecovery?: (stage: LoadingStage) => void;
  } = {}
) {
  const { enableRetry = true, enableGracefulDegradation = true, onError, onRecovery } = options;

  const [data, setData] = useState<EnhancedProgressiveDataState>({
    basicInfo: null,
    stats: {
      pullRequests: [],
      loading: true,
      error: null,
    },
    lotteryFactor: null,
    directCommitsData: null,
    historicalTrends: null,
    currentStage: 'critical',
    stageProgress: {
      critical: false,
      full: false,
      enhancement: false,
    },
    stageErrors: {
      critical: null,
      full: null,
      enhancement: null,
    },
    dataStatus: { status: 'pending' },
    retryAttempts: {
      critical: 0,
      full: 0,
      enhancement: 0,
    },
    lastRetryTime: {
      critical: 0,
      full: 0,
      enhancement: 0,
    },
    isRetrying: null,
    hasPartialData: false,
    canContinueWithoutStage: {
      critical: false,
      full: true,
      enhancement: true,
    },
  });

  const fetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Handle errors with automatic retry logic
  const handleStageError = useCallback(
    async (error: unknown, stage: LoadingStage, context?: any) => {
      const loadingError =
        error instanceof Error && (error as LoadingError).stage
          ? (error as LoadingError)
          : createGenericLoadingError(error, stage, context);

      console.error('Stage %s error:', loadingError, stage);

      // Update error state
      setData((prev) => ({
        ...prev,
        stageErrors: {
          ...prev.stageErrors,
          [stage]: loadingError,
        },
        dataStatus:
          stage === 'critical'
            ? { status: 'error', message: loadingError.userMessage }
            : { ...prev.dataStatus, message: loadingError.userMessage },
        hasPartialData:
          stage !== 'critical' && (prev.basicInfo !== null || prev.stats.pullRequests.length > 0),
      }));

      // Call error callback
      onError?.(loadingError, stage);

      // Attempt retry if enabled and error is retryable
      if (enableRetry && loadingError.retryable) {
        setData((prev) => {
          const attemptCount = prev.retryAttempts[stage] + 1;

          if (attemptCount <= MAX_RETRY_ATTEMPTS) {
            const retryDelay = getRetryDelay(loadingError, attemptCount);

            // Schedule retry
            const timeoutId = setTimeout(() => {
              if (retryStageRef.current) {
                retryStageRef.current(stage);
              }
            }, retryDelay);

            retryTimeoutsRef.current[stage] = timeoutId;

            // Update retry state
            return {
              ...prev,
              retryAttempts: {
                ...prev.retryAttempts,
                [stage]: attemptCount,
              },
              lastRetryTime: {
                ...prev.lastRetryTime,
                [stage]: Date.now(),
              },
              isRetrying: stage,
            };
          }

          return prev; // No changes if max attempts reached
        });
      }

      // Check if we can continue to next stage
      if (enableGracefulDegradation && canRecoverInNextStage(loadingError)) {
        return true; // Continue to next stage
      }

      return false; // Stop progression
    },
    [enableRetry, enableGracefulDegradation, onError]
  );

  // Forward declaration - will be populated after data loading functions are defined
  const retryStageRef = useRef<((stage: LoadingStage) => Promise<void>) | null>(null);

  // Manual retry function for external use
  const manualRetry = useCallback(
    (stage?: LoadingStage) => {
      if (!retryStageRef.current) return;

      if (stage) {
        retryStageRef.current(stage);
      } else {
        // Retry failed stages
        Object.entries(data.stageErrors).forEach(([stageKey, error]) => {
          if (error && error.retryable && retryStageRef.current) {
            retryStageRef.current(stageKey as LoadingStage);
          }
        });
      }
    },
    [data.stageErrors]
  );

  // Update stage progress with error handling
  const updateStageWithErrorHandling = useCallback(
    (stage: LoadingStage, updates: Partial<EnhancedProgressiveDataState>) => {
      setData((prev) => ({
        ...prev,
        ...updates,
        currentStage: stage,
        stageProgress: {
          ...prev.stageProgress,
          [stage]: true,
        },
        stageErrors: {
          ...prev.stageErrors,
          [stage]: null, // Clear any previous errors
        },
        isRetrying: null,
        hasPartialData: prev.hasPartialData || stage !== 'critical',
      }));
    },
    []
  );

  // Enhanced stage loading functions with error handling
  const loadCriticalData = useCallback(
    async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-critical-enhanced' }, async (span) => {
        try {
          const result = await fetchPRDataSmart(owner, repo, { timeRange });

          if (!result.data) {
            throw createLoadingError('VALIDATION_ERROR', result.message || 'Failed to fetch data', {
              owner,
              repo,
              timeRange,
            });
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

          updateStageWithErrorHandling('critical', { basicInfo });
          return basicInfo;
        } catch (error) {
          span?.setStatus('error');
          const canContinue = await handleStageError(error, 'critical', { owner, repo, timeRange });
          if (!canContinue) {
            throw error;
          }
          return null;
        }
      });
    },
    [timeRange, updateStageWithErrorHandling, handleStageError]
  );

  const loadFullData = useCallback(
    async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-full-enhanced' }, async (span) => {
        try {
          const result = await fetchPRDataSmart(owner, repo, { timeRange });

          if (!result.data && !enableGracefulDegradation) {
            throw createLoadingError(
              'NETWORK_TIMEOUT',
              result.message || 'Failed to fetch full data',
              { owner, repo, timeRange }
            );
          }

          const pullRequests = result.data || [];
          const stats: RepoStats = {
            pullRequests,
            loading: false,
            error: null,
          };

          const lotteryFactor =
            pullRequests.length > 0 ? calculateLotteryFactor(pullRequests) : null;

          updateStageWithErrorHandling('full', {
            stats,
            lotteryFactor,
            dataStatus: {
              status: result.data ? 'success' : 'partial_data',
              message: result.message,
              metadata: { prCount: pullRequests.length },
            },
          });

          return { stats, lotteryFactor };
        } catch (error) {
          span?.setStatus('error');
          const canContinue = await handleStageError(error, 'full', { owner, repo, timeRange });
          if (canContinue) {
            // Continue with partial data
            return { stats: data.stats, lotteryFactor: null };
          }
          throw error;
        }
      });
    },
    [
      timeRange,
      data.stats,
      enableGracefulDegradation,
      updateStageWithErrorHandling,
      handleStageError,
    ]
  );

  const loadEnhancementData = useCallback(
    async (owner: string, repo: string) => {
      return startSpan({ name: 'progressive-load-enhancement-enhanced' }, async (span) => {
        try {
          const directCommitsData = await fetchDirectCommitsWithDatabaseFallback(
            owner,
            repo,
            timeRange
          );

          const historicalTrends = null; // Future enhancement

          updateStageWithErrorHandling('enhancement', {
            directCommitsData,
            historicalTrends,
          });

          return { directCommitsData, historicalTrends };
        } catch (error) {
          span?.setStatus('error');
          // Enhancement errors are always recoverable
          await handleStageError(error, 'enhancement', { owner, repo, timeRange });
          return null;
        }
      });
    },
    [timeRange, updateStageWithErrorHandling, handleStageError]
  );

  // Main loading effect
  useEffect(() => {
    if (!owner || !repo || fetchingRef.current) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear retry timeouts
    Object.values(retryTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
    retryTimeoutsRef.current = {};

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    fetchingRef.current = true;

    const loadProgressivelyWithErrorHandling = async () => {
      try {
        setApplicationContext({
          route: `/${owner}/${repo}`,
          repository: `${owner}/${repo}`,
          timeRange,
          dataSource: 'progressive-enhanced',
        });

        // Stage 1: Critical data
        try {
          await loadCriticalData(owner, repo);
        } catch (error) {
          if (!enableGracefulDegradation) {
            return; // Stop if critical stage fails and graceful degradation is disabled
          }
        }

        if (abortController.signal.aborted) return;

        // Stage 2: Full data
        try {
          await loadFullData(owner, repo);
        } catch (error) {
          console.error('Full stage failed, continuing with available data');
        }

        if (abortController.signal.aborted) return;

        // Stage 3: Enhancement data (always optional)
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
      } catch (error) {
        console.error('Progressive loading error:', error);
      } finally {
        fetchingRef.current = false;
      }
    };

    loadProgressivelyWithErrorHandling();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      Object.values(retryTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, [
    owner,
    repo,
    timeRange,
    includeBots,
    loadCriticalData,
    loadFullData,
    loadEnhancementData,
    enableGracefulDegradation,
  ]);

  // Define the actual retry stage function after all data loading functions are available
  const retryStage = useCallback(
    async (stage: LoadingStage) => {
      if (!owner || !repo) return;

      console.log('Retrying stage: %s', stage);

      setData((prev) => ({
        ...prev,
        isRetrying: stage,
        stageErrors: {
          ...prev.stageErrors,
          [stage]: null,
        },
      }));

      try {
        switch (stage) {
          case 'critical':
            await loadCriticalData(owner, repo);
            break;
          case 'full':
            await loadFullData(owner, repo);
            break;
          case 'enhancement':
            await loadEnhancementData(owner, repo);
            break;
        }

        // Mark recovery
        setData((prev) => ({ ...prev, isRetrying: null }));
        onRecovery?.(stage);
      } catch (error) {
        await handleStageError(error, stage);
      }
    },
    [owner, repo, onRecovery, loadCriticalData, loadFullData, loadEnhancementData, handleStageError]
  );

  // Set the ref to the actual function
  retryStageRef.current = retryStage;

  return {
    ...data,
    manualRetry,
    retryStage,
  };
}

// Helper function to create generic loading errors
function createGenericLoadingError(
  error: unknown,
  stage: LoadingStage,
  context?: any
): LoadingError {
  const message = error instanceof Error ? error.message : String(error);

  // Determine error type based on message patterns
  let configKey: keyof typeof import('@/lib/types/data-loading-errors').ERROR_CONFIGS =
    'NETWORK_TIMEOUT';

  if (message.includes('401') || message.includes('403') || message.includes('permission')) {
    configKey = 'PERMISSION_DENIED';
  } else if (message.includes('timeout') || message.includes('TIMEOUT')) {
    configKey = 'NETWORK_TIMEOUT';
  } else if (message.includes('rate limit') || message.includes('429')) {
    configKey = 'RATE_LIMIT_EXCEEDED';
  } else if (message.includes('validation') || message.includes('invalid')) {
    configKey = 'VALIDATION_ERROR';
  } else if (stage === 'enhancement') {
    configKey = 'ENHANCEMENT_FAILED';
  }

  return createLoadingError(configKey, message, context);
}
