import { useState, useEffect, useCallback } from 'react';
import { workspaceEventsService, type EventMetrics } from '@/services/workspace-events.service';

interface UseWorkspaceEventsProps {
  workspaceId?: string;
  timeRange?: string;
  enabled?: boolean;
}

interface UseWorkspaceEventsResult {
  metrics: EventMetrics | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch event-based metrics for a workspace
 * Provides rich temporal data from GitHub events cache
 */
export function useWorkspaceEvents({
  workspaceId,
  timeRange = '30d',
  enabled = true
}: UseWorkspaceEventsProps): UseWorkspaceEventsResult {
  const [metrics, setMetrics] = useState<EventMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!workspaceId || !enabled) {
      setMetrics(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await workspaceEventsService.getWorkspaceEventMetrics(
        workspaceId,
        timeRange
      );

      setMetrics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch workspace events');
      setError(errorMessage);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, timeRange, enabled]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics
  };
}

/**
 * Hook for workspace activity feed
 */
export function useWorkspaceActivityFeed(
  workspaceId?: string,
  limit: number = 50
) {
  const [activities, setActivities] = useState<Array<{
    id: string;
    event_id: string;
    event_type: string;
    actor_login: string;
    repository_owner: string;
    repository_name: string;
    created_at: string;
    payload: Record<string, unknown>;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivityFeed = useCallback(async () => {
    if (!workspaceId) {
      setActivities([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await workspaceEventsService.getWorkspaceActivityFeed(
        workspaceId,
        limit
      );

      setActivities(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch activity feed');
      setError(errorMessage);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, limit]);

  useEffect(() => {
    fetchActivityFeed();
  }, [fetchActivityFeed]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivityFeed
  };
}