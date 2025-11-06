import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isBot } from '@/lib/utils/bot-detection';

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
 * Fallback client-side calculation for assignee distribution
 * Used when RPC function is unavailable
 * Fetches open issues and calculates distribution in the browser
 */
async function fetchDistributionClientSide(
  repositoryIds: string[],
  excludeBots: boolean,
  limit: number
): Promise<AssigneeDistributionData[]> {
  // Fetch open issues for the repositories
  const { data: issues, error } = await supabase
    .from('issues')
    .select('id, assignees, repository_id')
    .in('repository_id', repositoryIds)
    .eq('state', 'open')
    .limit(1000); // Limit to prevent fetching too much data

  if (error) {
    throw new Error(`Failed to fetch issues for fallback: ${error.message}`);
  }

  if (!issues || issues.length === 0) {
    return [];
  }

  // Calculate assignee distribution client-side
  const assigneeMap = new Map<string, { login: string; avatar_url: string; repos: Set<string> }>();

  issues.forEach((issue) => {
    if (!issue.assignees || !Array.isArray(issue.assignees)) {
      return;
    }

    issue.assignees.forEach((assignee: { login?: string; avatar_url?: string }) => {
      if (!assignee.login) return;

      // Filter bots if requested
      if (excludeBots && isBot({ username: assignee.login })) {
        return;
      }

      const existing = assigneeMap.get(assignee.login);
      if (existing) {
        existing.repos.add(issue.repository_id);
      } else {
        assigneeMap.set(assignee.login, {
          login: assignee.login,
          avatar_url: assignee.avatar_url || '',
          repos: new Set([issue.repository_id]),
        });
      }
    });
  });

  // Convert to array and calculate counts
  const result: AssigneeDistributionData[] = Array.from(assigneeMap.entries()).map(
    ([login, data]) => ({
      login,
      avatar_url: data.avatar_url,
      issue_count: issues.filter(
        (issue) =>
          issue.assignees &&
          Array.isArray(issue.assignees) &&
          issue.assignees.some((a: { login?: string }) => a.login === login)
      ).length,
      repository_count: data.repos.size,
    })
  );

  // Sort by issue count descending and limit
  result.sort((a, b) => b.issue_count - a.issue_count);
  return result.slice(0, limit);
}

/**
 * Hook to fetch assignee distribution for issues
 * Uses database-first approach with RPC for optimal performance
 * Falls back to client-side calculation if RPC is unavailable
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

      // Try database-first approach with RPC function
      const { data: result, error: rpcError } = await supabase.rpc(
        'calculate_assignee_distribution',
        {
          p_repository_ids: repositoryIds,
          p_exclude_bots: excludeBots,
          p_limit: limit,
        }
      );

      // If RPC function doesn't exist, fallback to client-side calculation
      if (rpcError && rpcError.message.includes('Could not find the function')) {
        console.warn(
          'RPC function not found, falling back to client-side calculation:',
          rpcError.message
        );
        const fallbackData = await fetchDistributionClientSide(repositoryIds, excludeBots, limit);
        setData(fallbackData);
        return;
      }

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
