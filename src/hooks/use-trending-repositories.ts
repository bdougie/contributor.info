import { useState, useEffect, useCallback } from 'react';
import type { TrendingRepositoryData } from '@/components/features/trending';

export interface TrendingQuery {
  period?: '24h' | '7d' | '30d';
  limit?: number;
  language?: string;
  minStars?: number;
  sort?: 'trending_score' | 'star_change' | 'pr_change' | 'contributor_change';
}

export interface TrendingStats {
  total_trending_repos: number;
  avg_trending_score: number;
  top_language: string | null;
  total_star_growth: number;
  total_new_contributors: number;
}

export interface TrendingResponse {
  repositories: TrendingRepositoryData[];
  metadata: {
    period: string;
    limit: number;
    language?: string;
    minStars: number;
    sort: string;
    totalCount: number;
    statistics: TrendingStats | null;
  };
  generated_at: string;
}

export interface UseTrendingRepositoriesResult {
  repositories: TrendingRepositoryData[];
  statistics: TrendingStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  query: TrendingQuery;
  setQuery: (query: TrendingQuery) => void;
}

const DEFAULT_QUERY: TrendingQuery = {
  period: '7d',
  limit: 50,
  minStars: 0,
  sort: 'trending_score',
};

export function useTrendingRepositories(
  initialQuery: TrendingQuery = DEFAULT_QUERY
): UseTrendingRepositoriesResult {
  const [repositories, setRepositories] = useState<TrendingRepositoryData[]>([]);
  const [statistics, setStatistics] = useState<TrendingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<TrendingQuery>({ ...DEFAULT_QUERY, ...initialQuery });

  const fetchTrendingRepositories = useCallback(async (currentQuery: TrendingQuery) => {
    setLoading(true);
    setError(null);

    try {
      // Build query string
      const params = new URLSearchParams();
      if (currentQuery.period) params.set('period', currentQuery.period);
      if (currentQuery.limit) params.set('limit', currentQuery.limit.toString());
      if (currentQuery.language) params.set('language', currentQuery.language);
      if (currentQuery.minStars) params.set('minStars', currentQuery.minStars.toString());
      if (currentQuery.sort) params.set('sort', currentQuery.sort);

      const response = await fetch(`/.netlify/functions/api-trending-repositories?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData._error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TrendingResponse = await response.json();
      setRepositories(_data.repositories);
      setStatistics(data.meta_data.statistics);
    } catch (err) {
      console.error('Error fetching trending repositories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trending repositories');
      setRepositories([]);
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchTrendingRepositories(query);
  }, [fetchTrendingRepositories, query]);

  const updateQuery = useCallback((newQuery: TrendingQuery) => {
    const updatedQuery = { ...query, ...newQuery };
    setQuery(updatedQuery);
  }, [query]);

  // Fetch data when query changes
  useEffect(() => {
    fetchTrendingRepositories(query);
  }, [fetchTrendingRepositories, query]);

  return {
    repositories,
    statistics,
    loading,
    error,
    refetch,
    query,
    setQuery: updateQuery,
  };
}

// Hook for getting just the trending statistics
export function useTrendingStatistics(period: '24h' | '7d' | '30d' = '7d') {
  const [statistics, setStatistics] = useState<TrendingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ period, limit: '1' });
        const response = await fetch(`/.netlify/functions/api-trending-repositories?${params}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: TrendingResponse = await response.json();
        setStatistics(data.meta_data.statistics);
      } catch (err) {
        console.error('Error fetching trending statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch trending statistics');
        setStatistics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  return { statistics, loading, error };
}