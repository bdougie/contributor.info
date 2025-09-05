import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkspaceEvents, useWorkspaceActivityFeed } from '../use-workspace-events';
import { workspaceEventsService } from '@/services/workspace-events.service';
import type { EventMetrics } from '@/services/workspace-events.service';

// Mock the service
vi.mock('@/services/workspace-events.service', () => ({
  workspaceEventsService: {
    getWorkspaceEventMetrics: vi.fn(),
    getWorkspaceActivityFeed: vi.fn(),
  },
}));

describe('useWorkspaceEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWorkspaceEvents({ workspaceId: 'workspace-123' }));

    expect(result.current.metrics).toBeNull();
    expect(result.current.loading).toBe(true); // Should start loading
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should fetch metrics successfully', async () => {
    const mockMetrics: EventMetrics = {
      stars: {
        total: 25,
        thisWeek: 5,
        lastWeek: 3,
        thisMonth: 25,
        lastMonth: 20,
        velocity: 2.5,
        trend: 'up',
        percentChange: 25,
      },
      forks: {
        total: 15,
        thisWeek: 3,
        lastWeek: 2,
        thisMonth: 15,
        lastMonth: 12,
        velocity: 1.5,
        trend: 'up',
        percentChange: 25,
      },
      activity: {
        totalEvents: 100,
        uniqueActors: 12,
        mostActiveRepo: {
          owner: 'test-owner',
          name: 'test-repo',
          eventCount: 40,
        },
        activityScore: 85,
      },
      timeline: [
        { date: '2025-01-01', stars: 5, forks: 3, totalActivity: 8 },
        { date: '2025-01-02', stars: 3, forks: 2, totalActivity: 5 },
      ],
    };

    vi.mocked(workspaceEventsService.getWorkspaceEventMetrics).mockResolvedValueOnce(mockMetrics);

    const { result } = renderHook(() =>
      useWorkspaceEvents({
        workspaceId: 'workspace-123',
        timeRange: '30d',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toEqual(mockMetrics);
    expect(result.current.error).toBeNull();
    expect(workspaceEventsService.getWorkspaceEventMetrics).toHaveBeenCalledWith(
      'workspace-123',
      '30d'
    );
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Failed to fetch metrics');
    vi.mocked(workspaceEventsService.getWorkspaceEventMetrics).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useWorkspaceEvents({ workspaceId: 'workspace-123' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toEqual(mockError);
  });

  it('should not fetch when workspace ID is missing', async () => {
    const { result } = renderHook(() => useWorkspaceEvents({ workspaceId: undefined }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeNull();
    expect(workspaceEventsService.getWorkspaceEventMetrics).not.toHaveBeenCalled();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      useWorkspaceEvents({
        workspaceId: 'workspace-123',
        enabled: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeNull();
    expect(workspaceEventsService.getWorkspaceEventMetrics).not.toHaveBeenCalled();
  });

  it('should refetch when refetch is called', async () => {
    const mockMetrics: EventMetrics = {
      stars: {
        total: 25,
        thisWeek: 5,
        lastWeek: 3,
        thisMonth: 25,
        lastMonth: 20,
        velocity: 2.5,
        trend: 'up',
        percentChange: 25,
      },
      forks: {
        total: 15,
        thisWeek: 3,
        lastWeek: 2,
        thisMonth: 15,
        lastMonth: 12,
        velocity: 1.5,
        trend: 'up',
        percentChange: 25,
      },
      activity: { totalEvents: 100, uniqueActors: 12, mostActiveRepo: null, activityScore: 85 },
      timeline: [],
    };

    vi.mocked(workspaceEventsService.getWorkspaceEventMetrics).mockResolvedValue(mockMetrics);

    const { result } = renderHook(() => useWorkspaceEvents({ workspaceId: 'workspace-123' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear the mock calls from initial fetch
    vi.clearAllMocks();

    // Call refetch
    await result.current.refetch();

    expect(workspaceEventsService.getWorkspaceEventMetrics).toHaveBeenCalledTimes(1);
  });

  it('should handle non-Error objects in catch block', async () => {
    const mockError = 'String error';
    vi.mocked(workspaceEventsService.getWorkspaceEventMetrics).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useWorkspaceEvents({ workspaceId: 'workspace-123' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch workspace events');
  });
});

describe('useWorkspaceActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWorkspaceActivityFeed('workspace-123'));

    expect(result.current.activities).toEqual([]);
    expect(result.current.loading).toBe(true); // Should start loading
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should fetch activity feed successfully', async () => {
    const mockActivities = [
      {
        id: 'event-1',
        event_id: 'gh-event-1',
        event_type: 'WatchEvent',
        actor_login: 'user1',
        repository_owner: 'owner1',
        repository_name: 'repo1',
        created_at: '2025-01-01T10:00:00Z',
        payload: {},
      },
      {
        id: 'event-2',
        event_id: 'gh-event-2',
        event_type: 'ForkEvent',
        actor_login: 'user2',
        repository_owner: 'owner2',
        repository_name: 'repo2',
        created_at: '2025-01-02T15:00:00Z',
        payload: {},
      },
    ];

    vi.mocked(workspaceEventsService.getWorkspaceActivityFeed).mockResolvedValueOnce(
      mockActivities
    );

    const { result } = renderHook(() => useWorkspaceActivityFeed('workspace-123', 25));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activities).toEqual(mockActivities);
    expect(result.current.error).toBeNull();
    expect(workspaceEventsService.getWorkspaceActivityFeed).toHaveBeenCalledWith(
      'workspace-123',
      25
    );
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Failed to fetch activity feed');
    vi.mocked(workspaceEventsService.getWorkspaceActivityFeed).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useWorkspaceActivityFeed('workspace-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.error).toEqual(mockError);
  });

  it('should not fetch when workspace ID is missing', async () => {
    const { result } = renderHook(() => useWorkspaceActivityFeed(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(workspaceEventsService.getWorkspaceActivityFeed).not.toHaveBeenCalled();
  });

  it('should use default limit when not provided', async () => {
    vi.mocked(workspaceEventsService.getWorkspaceActivityFeed).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useWorkspaceActivityFeed('workspace-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(workspaceEventsService.getWorkspaceActivityFeed).toHaveBeenCalledWith(
      'workspace-123',
      50 // Default limit
    );
  });

  it('should refetch when refetch is called', async () => {
    const mockActivities = [
      {
        id: 'event-1',
        event_id: 'gh-event-1',
        event_type: 'WatchEvent',
        actor_login: 'user1',
        repository_owner: 'owner1',
        repository_name: 'repo1',
        created_at: '2025-01-01T10:00:00Z',
        payload: {},
      },
    ];

    vi.mocked(workspaceEventsService.getWorkspaceActivityFeed).mockResolvedValue(mockActivities);

    const { result } = renderHook(() => useWorkspaceActivityFeed('workspace-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear the mock calls from initial fetch
    vi.clearAllMocks();

    // Call refetch
    await result.current.refetch();

    expect(workspaceEventsService.getWorkspaceActivityFeed).toHaveBeenCalledTimes(1);
  });

  it('should handle non-Error objects in catch block', async () => {
    const mockError = 'String error';
    vi.mocked(workspaceEventsService.getWorkspaceActivityFeed).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useWorkspaceActivityFeed('workspace-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch activity feed');
  });
});
