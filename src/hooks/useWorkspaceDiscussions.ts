import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Discussion } from '@/components/features/workspace/WorkspaceDiscussionsTable';

interface RepositoryRef {
  id: string;
  name: string;
  owner: string;
  full_name: string;
}

interface UseWorkspaceDiscussionsOptions {
  repositories: RepositoryRef[];
  selectedRepositories: string[];
  workspaceId: string;
  refreshInterval?: number; // In minutes, 0 to disable
  maxStaleMinutes?: number; // Consider data stale after this many minutes
  autoSyncOnMount?: boolean; // Auto-sync on component mount, defaults to true
}

interface UseWorkspaceDiscussionsResult {
  discussions: Discussion[];
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  isStale: boolean;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing workspace discussion data with smart caching
 * Similar pattern to useWorkspaceIssues and useWorkspacePRs
 */
export function useWorkspaceDiscussions({
  repositories,
  selectedRepositories,
  workspaceId,
  refreshInterval = 60,
  maxStaleMinutes = 60,
  autoSyncOnMount = true,
}: UseWorkspaceDiscussionsOptions): UseWorkspaceDiscussionsResult {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Check if data needs refresh
  const checkStaleness = useCallback(
    async (repoIds: string[]) => {
      if (repoIds.length === 0) return { needsSync: false, oldestSync: null };

      const { data } = await supabase
        .from('discussions')
        .select('synced_at, repository_id')
        .in('repository_id', repoIds)
        .order('synced_at', { ascending: true });

      const reposWithData = new Set(data?.map((discussion) => discussion.repository_id) || []);
      const missingRepos = repoIds.filter((id) => !reposWithData.has(id));

      if (missingRepos.length > 0 || !data || data.length === 0) {
        return { needsSync: true, oldestSync: null };
      }

      const oldestSync = new Date(data[0].synced_at);
      const minutesSinceSync = (Date.now() - oldestSync.getTime()) / (1000 * 60);

      return {
        needsSync: minutesSinceSync > maxStaleMinutes,
        oldestSync,
      };
    },
    [maxStaleMinutes]
  );

  // Fetch discussions from database
  const fetchFromDatabase = useCallback(async (repoIds: string[]) => {
    const { data, error } = await supabase
      .from('discussions')
      .select(
        `
          *,
          repositories (
            name,
            owner,
            full_name
          )
        `
      )
      .in('repository_id', repoIds)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to fetch discussions: ${error.message}`);
    }

    // Fetch avatar URLs for all unique authors
    const uniqueAuthors = [...new Set((data || []).map((d) => d.author_login).filter(Boolean))];

    if (uniqueAuthors.length > 0) {
      const { data: contributorsData } = await supabase
        .from('contributors')
        .select('username, avatar_url')
        .in('username', uniqueAuthors);

      // Create a map of username -> avatar_url
      const avatarMap = new Map((contributorsData || []).map((c) => [c.username, c.avatar_url]));

      // Enrich discussions with avatar URLs
      const enrichedData = (data || []).map((discussion) => ({
        ...discussion,
        author_avatar_url: discussion.author_login ? avatarMap.get(discussion.author_login) : null,
      }));

      return enrichedData as Discussion[];
    }

    return (data || []) as Discussion[];
  }, []);

  // Trigger workspace sync via Edge Function
  const triggerWorkspaceSync = useCallback(async (repoIds: string[], wsId: string) => {
    try {
      // Call workspace-sync Edge Function to trigger discussion sync
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const syncUrl = supabaseUrl
        ? `${supabaseUrl}/functions/v1/workspace-sync`
        : '/api/workspace-sync';

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify({
          workspaceId: wsId,
          repositoryIds: repoIds,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        console.error('[Discussion Sync] Sync failed:', result);
        return false;
      }

      console.log('[Discussion Sync] Workspace sync triggered successfully');
      return true;
    } catch (err) {
      console.error('[Discussion Sync] Failed to trigger sync:', err);
      return false;
    }
  }, []);

  // Main fetch function
  const fetchDiscussions = useCallback(
    async (forceRefresh = false, skipSync = false) => {
      if (repositories.length === 0) {
        setDiscussions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const filteredRepos =
          selectedRepositories.length > 0
            ? repositories.filter((r) => selectedRepositories.includes(r.id))
            : repositories;

        const repoIds = filteredRepos.map((r) => r.id);

        const { needsSync, oldestSync } = await checkStaleness(repoIds);
        setLastSynced(oldestSync);
        setIsStale(needsSync);

        const shouldSync = !skipSync && (forceRefresh || (needsSync && autoSyncOnMount));

        if (shouldSync) {
          console.log('[Discussion Sync] Triggering workspace sync for discussions');
          const syncSuccess = await triggerWorkspaceSync(repoIds, workspaceId);

          if (syncSuccess) {
            setLastSynced(new Date());
            setIsStale(false);
          }
        }

        // Fetch from database (now with updated data if synced)
        const dbDiscussions = await fetchFromDatabase(repoIds);
        setDiscussions(dbDiscussions);
      } catch (err) {
        console.error('Error fetching discussions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch discussions');
        setDiscussions([]);
      } finally {
        setLoading(false);
      }
    },
    [
      repositories,
      selectedRepositories,
      workspaceId,
      checkStaleness,
      fetchFromDatabase,
      triggerWorkspaceSync,
      autoSyncOnMount,
    ]
  );

  // Initial fetch
  useEffect(() => {
    if (repositories.length > 0) {
      fetchDiscussions();
    }
  }, [repositories.length, selectedRepositories.length, workspaceId, fetchDiscussions]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(
        () => {
          fetchDiscussions(true);
        },
        refreshInterval * 60 * 1000
      );

      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchDiscussions]);

  const refresh = useCallback(() => fetchDiscussions(true), [fetchDiscussions]);

  return {
    discussions,
    loading,
    error,
    lastSynced,
    isStale,
    refresh,
  };
}
