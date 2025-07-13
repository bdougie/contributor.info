import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RepositorySize } from '@/lib/validation/database-schemas';

export interface RepositoryMetadata {
  size?: RepositorySize;
  lastDataUpdate?: string;
  dataFreshness: 'fresh' | 'stale' | 'old';
  priority?: 'high' | 'medium' | 'low';
  tracking_enabled?: boolean;
}

interface UseRepositoryMetadataReturn {
  metadata: RepositoryMetadata | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch repository metadata including size classification and data freshness
 */
export function useRepositoryMetadata(owner?: string, repo?: string): UseRepositoryMetadataReturn {
  const [metadata, setMetadata] = useState<RepositoryMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDataFreshness = (lastUpdate?: string): 'fresh' | 'stale' | 'old' => {
    if (!lastUpdate) return 'old';
    
    const now = new Date();
    const updateTime = new Date(lastUpdate);
    const hoursDiff = (now.getTime() - updateTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 24) return 'fresh';  // < 1 day
    if (hoursDiff < 168) return 'stale'; // < 7 days
    return 'old'; // > 7 days
  };

  const fetchMetadata = useCallback(async () => {
    if (!owner || !repo) {
      setMetadata(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, get the repository ID
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (repoError || !repoData) {
        // Repository not in database yet
        setMetadata({
          dataFreshness: 'old'
        });
        return;
      }

      // Get tracked repository data with size and metadata
      const { data: trackedData, error: trackedError } = await supabase
        .from('tracked_repositories')
        .select('size, priority, tracking_enabled, updated_at')
        .eq('repository_id', repoData.id)
        .single();

      if (trackedError && trackedError.code !== 'PGRST116') {
        // Error other than "no rows returned"
        throw trackedError;
      }

      // Get most recent data update from pull_requests
      const { data: prData } = await supabase
        .from('pull_requests')
        .select('created_at')
        .eq('repository_id', repoData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastDataUpdate = prData?.created_at || trackedData?.updated_at;
      const dataFreshness = calculateDataFreshness(lastDataUpdate);

      setMetadata({
        size: trackedData?.size || undefined,
        lastDataUpdate,
        dataFreshness,
        priority: trackedData?.priority || undefined,
        tracking_enabled: trackedData?.tracking_enabled || false
      });

    } catch (err) {
      console.error('Error fetching repository metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metadata');
      setMetadata({
        dataFreshness: 'old'
      });
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return {
    metadata,
    loading,
    error,
    refetch: fetchMetadata
  };
}