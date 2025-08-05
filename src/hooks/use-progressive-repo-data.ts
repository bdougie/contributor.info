import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateLotteryFactor } from '@/lib/utils';
import type { RepoStats, LotteryFactor, DirectCommitsData, TimeRange } from '@/lib/types';
import { startSpan } from '@/lib/simple-logging';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';

interface HistoricalTrendsData {
  // TODO: Define historical trends structure when implemented
  placeholder?: boolean;
}

export interface ProgressiveRepoData {
  // Stage 1: Critical data (loaded immediately)
  critical: {
    basicInfo: {
      prCount: number;
      contributorCount: number;
      topContributors: Array<{
        id: number;
        username: string;
        avatar_url: string;
        contributions: number;
      }>;
    } | null;
    loading: boolean;
    error: string | null;
  };
  
  // Stage 2: Full data (loaded after critical)
  full: {
    stats: RepoStats | null;
    lotteryFactor: LotteryFactor | null;
    loading: boolean;
    error: string | null;
  };
  
  // Stage 3: Enhancement data (loaded in background)
  enhancement: {
    directCommits: DirectCommitsData | null;
    historicalTrends: HistoricalTrendsData | null;
    loading: boolean;
    error: string | null;
  };
}

/**
 * Progressive data loading hook that loads repository data in stages
 * to optimize perceived performance and time to interactive
 */
export function useProgressiveRepoData(
  owner: string | undefined,
  repo: string | undefined,
  timeRange: TimeRange,
  _includeBots: boolean
): ProgressiveRepoData {
  // Stage 1: Critical data
  const [critical, setCritical] = useState<ProgressiveRepoData['critical']>({
    basicInfo: null,
    loading: true,
    error: null,
  });
  
  // Stage 2: Full data
  const [full, setFull] = useState<ProgressiveRepoData['full']>({
    stats: null,
    lotteryFactor: null,
    loading: false,
    error: null,
  });
  
  // Stage 3: Enhancement data
  const [enhancement, setEnhancement] = useState<ProgressiveRepoData['enhancement']>({
    directCommits: null,
    historicalTrends: null,
    loading: false,
    error: null,
  });
  
  const loadingRef = useRef({
    critical: false,
    full: false,
    enhancement: false,
  });

  // Stage 1: Load critical data immediately
  useEffect(() => {
    // Validate inputs
    if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') return;
    if (loadingRef.current.critical) return;

    async function loadCriticalData() {
      loadingRef.current.critical = true;
      setCritical(prev => ({ ...prev, loading: true, error: null }));

      try {
        const result = await startSpan(
          {
            name: 'fetch-critical-repo-data',
            op: 'data.fetch.critical',
            attributes: {
              'repository.owner': owner || '',
              'repository.name': repo || '',
            }
          },
          async () => {
            // Get basic repository stats with minimal data
            const { data: repoData, error: repoError } = await supabase
              .from('repositories')
              .select('id')
              .eq('owner', owner)
              .eq('name', repo)
              .single();

            if (repoError || !repoData) {
              throw new Error('Unable to load repository information. Please check the repository name and try again.');
            }

            // Get PR count and top contributors in parallel
            const [prCountResult, topContributorsResult] = await Promise.all([
              // Get PR count
              supabase
                .from('pull_requests')
                .select('id', { count: 'exact', head: false })
                .eq('repository_id', repoData.id)
                .gte('created_at', new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()),
              
              // Get top 5 contributors
              supabase
                .from('pull_requests')
                .select(`
                  author_id,
                  contributors!author_id (
                    id,
                    username,
                    avatar_url
                  )
                `)
                .eq('repository_id', repoData.id)
                .gte('created_at', new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString())
                .not('author_id', 'is', null)
            ]);

            // Process top contributors
            const contributorCounts = new Map<string, { contributor: any; count: number }>();
            
            if (topContributorsResult.data) {
              topContributorsResult.data.forEach(pr => {
                if (pr.contributors) {
                  const key = (pr.contributors as any).username;
                  if (!contributorCounts.has(key)) {
                    contributorCounts.set(key, { contributor: pr.contributors, count: 0 });
                  }
                  contributorCounts.get(key)!.count++;
                }
              });
            }

            const topContributors = Array.from(contributorCounts.values())
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
              .map(({ contributor, count }) => ({
                ...contributor,
                contributions: count
              }));

            return {
              prCount: prCountResult.count || 0,
              contributorCount: contributorCounts.size,
              topContributors
            };
          }
        );

        setCritical({
          basicInfo: result,
          loading: false,
          error: null,
        });
      } catch (error) {
        setCritical({
          basicInfo: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load repository metrics. Please try again later.',
        });
      } finally {
        loadingRef.current.critical = false;
      }
    }

    loadCriticalData();
  }, [owner, repo, timeRange]);

  // Stage 2: Load full data after critical data is loaded
  useEffect(() => {
    if (!owner || !repo || !critical.basicInfo || loadingRef.current.full) return;

    async function loadFullData() {
      loadingRef.current.full = true;
      setFull(prev => ({ ...prev, loading: true, error: null }));

      try {
        const result = await startSpan(
          {
            name: 'fetch-full-repo-data',
            op: 'data.fetch.full',
            attributes: {
              'repository.owner': owner || '',
              'repository.name': repo || '',
              'data.time_range': timeRange,
            }
          },
          async () => {
            // Import the existing fetch function to reuse logic
            const { fetchPRDataSmart } = await import('@/lib/supabase-pr-data-smart');
            
            const prDataResult = await fetchPRDataSmart(owner!, repo!, { 
              timeRange, 
              showNotifications: false 
            });
            
            const stats: RepoStats = {
              pullRequests: prDataResult.data || [],
              loading: false,
              error: prDataResult.status === 'success' ? null : prDataResult.message || null,
            };
            
            const lotteryFactor = stats.pullRequests.length > 0 
              ? calculateLotteryFactor(stats.pullRequests)
              : null;
            
            return { stats, lotteryFactor };
          }
        );

        setFull({
          stats: result.stats,
          lotteryFactor: result.lotteryFactor,
          loading: false,
          error: null,
        });
      } catch (error) {
        setFull({
          stats: null,
          lotteryFactor: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load detailed repository data. Basic information is still available.',
        });
      } finally {
        loadingRef.current.full = false;
      }
    }

    loadFullData();
  }, [owner, repo, timeRange, critical.basicInfo]);

  // Stage 3: Load enhancement data in background
  useEffect(() => {
    if (!owner || !repo || !full.stats || loadingRef.current.enhancement) return;

    async function loadEnhancementData() {
      loadingRef.current.enhancement = true;
      setEnhancement(prev => ({ ...prev, loading: true, error: null }));

      // Use requestIdleCallback for background loading
      let idleCallbackId: number | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (window.requestIdleCallback) {
        idleCallbackId = window.requestIdleCallback(async () => {
          try {
            const directCommits = await fetchDirectCommitsWithDatabaseFallback(
              owner!, 
              repo!, 
              timeRange
            );
            
            setEnhancement({
              directCommits,
              historicalTrends: null, // TODO: Implement historical trends
              loading: false,
              error: null,
            });
          } catch (error) {
            setEnhancement(prev => ({
              ...prev,
              loading: false,
              error: error instanceof Error ? error.message : 'Unable to load additional analytics. Core features remain available.',
            }));
          } finally {
            loadingRef.current.enhancement = false;
          }
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        timeoutId = setTimeout(async () => {
          try {
            const directCommits = await fetchDirectCommitsWithDatabaseFallback(
              owner!, 
              repo!, 
              timeRange
            );
            
            setEnhancement({
              directCommits,
              historicalTrends: null,
              loading: false,
              error: null,
            });
          } catch (error) {
            setEnhancement(prev => ({
              ...prev,
              loading: false,
              error: error instanceof Error ? error.message : 'Unable to load additional analytics. Core features remain available.',
            }));
          } finally {
            loadingRef.current.enhancement = false;
          }
        }, 100);
      }

      return () => {
        if (idleCallbackId !== undefined && window.cancelIdleCallback) {
          window.cancelIdleCallback(idleCallbackId);
        }
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      };
    }

    loadEnhancementData();
  }, [owner, repo, timeRange, full.stats]);

  return { critical, full, enhancement };
}