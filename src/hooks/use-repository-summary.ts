import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface UseRepositorySummaryReturn {
  summary: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
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

    setLoading(true);
    setError(null);

    try {
      // First, get the repository data from the database
      const { data: repositoryData, error: repoError } = await supabase
        .from('repositories')
        .select('id, full_name, description, language, stargazers_count, forks_count, ai_summary, summary_generated_at, recent_activity_hash')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (repoError) {
        throw new Error(`Failed to fetch repository data: ${repoError.message}`);
      }

      if (!repositoryData) {
        throw new Error('Repository not found');
      }

      // If we already have a cached summary, use it
      if (repositoryData.ai_summary) {
        setSummary(repositoryData.ai_summary);
        setLoading(false);
        return;
      }

      // Call the repository-summary edge function
      const { data, error: functionError } = await supabase.functions.invoke(
        'repository-summary',
        {
          body: {
            repository: repositoryData,
            pullRequests: pullRequests || [],
            forceRegeneration: false
          }
        }
      );

      if (functionError) {
        throw new Error(`Failed to generate summary: ${functionError.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching repository summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    try {
      // First, get the repository data from the database
      const { data: repositoryData, error: repoError } = await supabase
        .from('repositories')
        .select('id, full_name, description, language, stargazers_count, forks_count, ai_summary, summary_generated_at, recent_activity_hash')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (repoError) {
        throw new Error(`Failed to fetch repository data: ${repoError.message}`);
      }

      if (!repositoryData) {
        throw new Error('Repository not found');
      }

      // Call the repository-summary edge function with forceRegeneration
      const { data, error: functionError } = await supabase.functions.invoke(
        'repository-summary',
        {
          body: {
            repository: repositoryData,
            pullRequests: pullRequests || [],
            forceRegeneration: true // Force regeneration on manual refresh
          }
        }
      );

      if (functionError) {
        throw new Error(`Failed to generate summary: ${functionError.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error refetching repository summary:', err);
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