import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AssigneeDistributionData {
  login: string;
  avatar_url: string;
  issue_count: number;
  repository_count: number;
}

interface UseAssigneeDistributionOptions {
  repositoryIds: string[];
  excludeBots?: boolean;
  limit?: number;
  enabled?: boolean;
}

interface UseAssigneeDistributionResult {
  data: AssigneeDistributionData[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to efficiently fetch assignee distribution using database-side aggregation
 * This optimizes performance by moving computation from client to database
 */
export function useAssigneeDistribution({
  repositoryIds,
  excludeBots = true,
  limit = 100,
  enabled = true,
}: UseAssigneeDistributionOptions): UseAssigneeDistributionResult {
  const [data, setData] = useState<AssigneeDistributionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDistribution = useCallback(async () => {
    // Skip if disabled or no repositories
    if (!enabled || repositoryIds.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase.rpc(
        'calculate_assignee_distribution',
        {
          p_repository_ids: repositoryIds,
          p_exclude_bots: excludeBots,
          p_limit: limit,
        }
      );

      if (rpcError) {
        throw new Error(`Failed to fetch assignee distribution: ${rpcError.message}`);
      }

      setData(result || []);
    } catch (err) {
      console.error('Error fetching assignee distribution:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assignee distribution');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [repositoryIds, excludeBots, limit, enabled]);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  return {
    data,
    loading,
    error,
    refresh: fetchDistribution,
  };
}
