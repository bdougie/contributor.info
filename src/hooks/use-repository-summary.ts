import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { trackDatabaseOperation, trackCacheOperation, trackRateLimit, setApplicationContext } from '@/lib/simple-logging';

interface UseRepositorySummaryReturn {
  summary: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Helper function to create activity hash (same as edge function)
function createActivityHash(pullRequests: any[]): string {
  const activityData = pullRequests
    .slice(0, 10)
    .map(pr => `${pr.number}-${pr.merged_at || pr.created_at}`)
    .join('|');
  return btoa(activityData);
}

// Check if summary needs regeneration (14 days old or activity changed)
function needsRegeneration(repo: any, activityHash: string): boolean {
  if (!repo.summary_generated_at || !repo.recent_activity_hash) {
    return true;
  }
  
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const generatedAt = new Date(repo.summary_generated_at);
  
  return generatedAt < fourteenDaysAgo || repo.recent_activity_hash !== activityHash;
}

export function useRepositorySummary(
  owner: string | undefined,
  repo: string | undefined,
  pullRequests?: any[]
): UseRepositorySummaryReturn {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    if (!owner || !repo) return;

    // Set application context for Sentry
    setApplicationContext({
      route: 'repository-summary',
      repository: `${owner}/${repo}`,
      dataSource: 'database'
    });

    setLoading(true);
    setError(null);

    try {
      // Database-first pattern with Sentry tracking
      const repositoryData = await trackDatabaseOperation(
        'fetchRepositorySummary',
        async () => {
          const { data, error } = await supabase
            .from('repositories')
            .select('id, full_name, description, language, stargazers_count, forks_count, ai_summary, summary_generated_at, recent_activity_hash')
            .eq('owner', owner)
            .eq('name', repo)
            .single();

          if (error) throw error;
          return data;
        },
        {
          operation: 'fetch',
          table: 'repositories',
          repository: `${owner}/${repo}`
        }
      );

      if (!repositoryData) {
        throw new Error('Repository not found');
      }

      // Calculate activity hash
      const activityHash = createActivityHash(pullRequests || []);
      const shouldRegenerate = needsRegeneration(repositoryData, activityHash);

      // Use cached summary if available and fresh
      if (repositoryData.ai_summary && !shouldRegenerate) {
        await trackCacheOperation(
          'useCachedSummary',
          async () => {
            setSummary(repositoryData.ai_summary);
            return repositoryData.ai_summary;
          },
          {
            operation: 'get',
            cacheType: 'database',
            hit: true,
            key: `summary:${owner}/${repo}`
          }
        );
        setLoading(false);
        return;
      }

      // Fallback to edge function for generation
      await trackCacheOperation(
        'generateNewSummary',
        async () => {
          setApplicationContext({
            route: 'repository-summary',
            repository: `${owner}/${repo}`,
            dataSource: 'api'
          });

          const { data, error: functionError } = await supabase.functions.invoke(
            'repository-summary',
            {
              body: {
                repository: repositoryData,
                pullRequests: pullRequests || [],
                forceRegeneration: shouldRegenerate
              }
            }
          );

          if (functionError) {
            // Track rate limiting if detected
            if (functionError.message.includes('rate limit') || functionError.message.includes('429')) {
              trackRateLimit('supabase', 'repository-summary');
            }
            throw new Error(`Failed to generate summary: ${functionError.message}`);
          }

          if (data.error) {
            throw new Error(data.error);
          }

          setSummary(data.summary);
          return data.summary;
        },
        {
          operation: 'set',
          cacheType: 'api',
          hit: false,
          key: `summary:${owner}/${repo}`
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      
      // Simple error logging without analytics
      console.error('AI summary error:', errorMessage, { owner, repo });
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    try {
      const repositoryData = await trackDatabaseOperation(
        'refetchRepositorySummary',
        async () => {
          const { data, error } = await supabase
            .from('repositories')
            .select('id, full_name, description, language, stargazers_count, forks_count, ai_summary, summary_generated_at, recent_activity_hash')
            .eq('owner', owner)
            .eq('name', repo)
            .single();

          if (error) throw error;
          return data;
        },
        {
          operation: 'fetch',
          table: 'repositories',
          repository: `${owner}/${repo}`,
          fallbackUsed: false
        }
      );

      if (!repositoryData) {
        throw new Error('Repository not found');
      }

      // Force regeneration on manual refresh
      const result = await trackCacheOperation(
        'forceRegenerateSummary',
        async () => {
          const { data, error: functionError } = await supabase.functions.invoke(
            'repository-summary',
            {
              body: {
                repository: repositoryData,
                pullRequests: pullRequests || [],
                forceRegeneration: true
              }
            }
          );

          if (functionError) {
            if (functionError.message.includes('rate limit') || functionError.message.includes('429')) {
              trackRateLimit('supabase', 'repository-summary');
            }
            throw new Error(`Failed to generate summary: ${functionError.message}`);
          }

          if (data.error) {
            throw new Error(data.error);
          }

          return data.summary;
        },
        {
          operation: 'set',
          cacheType: 'api',
          hit: false,
          key: `summary:${owner}/${repo}`,
          ttl: 14 * 24 * 60 * 60 * 1000 // 14 days in ms
        }
      );

      setSummary(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      
      // Simple error logging without analytics
      console.error('AI summary refresh error:', errorMessage, { owner, repo });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [owner, repo]); // Remove pullRequests from dependencies to avoid infinite loops

  return {
    summary,
    loading,
    error,
    refetch
  };
}