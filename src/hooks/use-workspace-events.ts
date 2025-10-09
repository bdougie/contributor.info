import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
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
 * Uses React Query for caching and automatic background refetching
 */
export function useWorkspaceEvents({
  workspaceId,
  timeRange = '30d',
  enabled = true,
}: UseWorkspaceEventsProps): UseWorkspaceEventsResult {
  const {
    data: metrics,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['workspace-events', workspaceId, timeRange],
    queryFn: () => workspaceEventsService.getWorkspaceEventMetrics(workspaceId!, timeRange),
    enabled: !!workspaceId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for this long
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch when tab is focused
    refetchOnMount: false, // Use cached data on mount, don't always refetch
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleRefetch = async () => {
    await refetch();
  };

  return {
    metrics: metrics ?? null,
    loading,
    error: error as Error | null,
    refetch: handleRefetch,
  };
}

interface UseWorkspaceActivityFeedOptions {
  enabled?: boolean;
  pageSize?: number;
}

/**
 * Hook for workspace activity feed with React Query caching
 */
export function useWorkspaceActivityFeed(
  workspaceId?: string,
  options: UseWorkspaceActivityFeedOptions = {}
) {
  const { enabled = true, pageSize = 50 } = options;

  const {
    data: activities,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['workspace-activity-feed', workspaceId, pageSize],
    queryFn: () => workspaceEventsService.getWorkspaceActivityFeed(workspaceId!, pageSize),
    enabled: !!workspaceId && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - activity feed refreshes more often
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  const handleRefetch = async () => {
    await refetch();
  };

  return {
    activities: activities ?? [],
    loading,
    error: error as Error | null,
    refetch: handleRefetch,
  };
}

/**
 * Hook for paginated workspace activity feed
 * Supports infinite scroll and load more patterns
 */
export function useWorkspaceActivityFeedPaginated(
  workspaceId?: string,
  options: {
    pageSize?: number;
    eventTypes?: string[];
    enabled?: boolean;
  } = {}
) {
  const { pageSize = 50, eventTypes, enabled = true } = options;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useInfiniteQuery({
      queryKey: ['workspace-activity-feed-paginated', workspaceId, pageSize, eventTypes],
      queryFn: ({ pageParam = 0 }) =>
        workspaceEventsService.getWorkspaceActivityFeed(workspaceId!, pageSize, {
          offset: pageParam,
          eventTypes,
        }),
      enabled: !!workspaceId && enabled,
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) => {
        // If we got a full page, there might be more
        if (lastPage.length === pageSize) {
          return allPages.length * pageSize;
        }
        return undefined; // No more pages
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false,
      refetchOnMount: 'always',
    });

  // Flatten all pages into a single array
  const activities = data?.pages.flat() ?? [];

  const loadMore = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  };

  const handleRefetch = async () => {
    await refetch();
  };

  return {
    activities,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    error: error as Error | null,
    loadMore,
    refetch: handleRefetch,
  };
}
