import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspaceEventsService } from '../workspace-events.service';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('WorkspaceEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getWorkspaceEventMetrics', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockTimeRange = '30d';

    it('should return event metrics successfully', async () => {
      // Mock velocity data
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            total_events: 100,
            daily_average: 5.5,
            star_velocity: 2.5,
            fork_velocity: 1.5,
            growth_trend: 'up',
          },
        ],
        error: null,
      });

      // Mock metrics data
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            total_star_events: 25,
            total_fork_events: 15,
            unique_actors: 12,
            most_active_repo_owner: 'test-owner',
            most_active_repo_name: 'test-repo',
            most_active_repo_events: 40,
            daily_timeline: [
              { date: '2025-01-01', stars: 5, forks: 3, total: 8 },
              { date: '2025-01-02', stars: 3, forks: 2, total: 5 },
            ],
          },
        ],
        error: null,
      });

      const result = await workspaceEventsService.getWorkspaceEventMetrics(
        mockWorkspaceId,
        mockTimeRange
      );

      expect(result).toBeDefined();
      expect(result?.stars.total).toBe(25);
      expect(result?.forks.total).toBe(15);
      expect(result?.activity.totalEvents).toBe(100);
      expect(result?.activity.uniqueActors).toBe(12);
      expect(result?.activity.mostActiveRepo).toEqual({
        owner: 'test-owner',
        name: 'test-repo',
        eventCount: 40,
      });
      expect(result?.timeline).toHaveLength(2);
    });

    it('should return null for invalid workspace ID', async () => {
      const result = await workspaceEventsService.getWorkspaceEventMetrics('', mockTimeRange);
      expect(result).toBeNull();
    });

    it('should return null for invalid time range', async () => {
      const result = await workspaceEventsService.getWorkspaceEventMetrics(mockWorkspaceId, '');
      expect(result).toBeNull();
    });

    it('should return null for database errors', async () => {
      // Mock database error
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed', code: 'DB_ERROR' },
      });

      const result = await workspaceEventsService.getWorkspaceEventMetrics(
        mockWorkspaceId,
        mockTimeRange
      );
      expect(result).toBeNull();
    });

    it('should return null when no data is found', async () => {
      // Mock empty velocity data
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock empty metrics data
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await workspaceEventsService.getWorkspaceEventMetrics(
        mockWorkspaceId,
        mockTimeRange
      );

      expect(result).toBeNull();
    });
  });

  describe('getWorkspaceRepositoryEventSummaries', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockTimeRange = '30d';

    it('should return repository summaries with default pagination', async () => {
      const mockSummaries = [
        {
          repository_owner: 'owner1',
          repository_name: 'repo1',
          star_events: 10,
          fork_events: 5,
          total_events: 15,
          last_activity: '2025-01-01T10:00:00Z',
          unique_actors: 8,
        },
        {
          repository_owner: 'owner2',
          repository_name: 'repo2',
          star_events: 8,
          fork_events: 3,
          total_events: 11,
          last_activity: '2025-01-02T15:00:00Z',
          unique_actors: 6,
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockSummaries,
        error: null,
      });

      const result = await workspaceEventsService.getWorkspaceRepositoryEventSummaries(
        mockWorkspaceId,
        mockTimeRange
      );

      expect(result).toEqual(mockSummaries);
      expect(supabase.rpc).toHaveBeenCalledWith('get_workspace_repository_event_summaries', {
        p_workspace_id: mockWorkspaceId,
        p_start_date: expect.any(String),
        p_end_date: expect.any(String),
        p_limit: 100,
        p_offset: 0,
      });
    });

    it('should handle custom pagination options', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await workspaceEventsService.getWorkspaceRepositoryEventSummaries(
        mockWorkspaceId,
        mockTimeRange,
        { limit: 50, offset: 25 }
      );

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_workspace_repository_event_summaries',
        expect.objectContaining({
          p_limit: 50,
          p_offset: 25,
        })
      );
    });

    it('should validate pagination limits', async () => {
      await expect(
        workspaceEventsService.getWorkspaceRepositoryEventSummaries(
          mockWorkspaceId,
          mockTimeRange,
          { limit: 2000 } // Over maximum
        )
      ).rejects.toThrow('Invalid limit: must be a positive number between 1 and 1000');
    });

    it('should validate pagination offset', async () => {
      await expect(
        workspaceEventsService.getWorkspaceRepositoryEventSummaries(
          mockWorkspaceId,
          mockTimeRange,
          { offset: -1 } // Negative offset
        )
      ).rejects.toThrow('Invalid offset: must be a non-negative number');
    });
  });

  describe('getWorkspaceActivityFeed', () => {
    const mockWorkspaceId = 'workspace-123';

    it('should return activity feed successfully', async () => {
      const mockRepos = [
        { repositories: { owner: 'owner1', name: 'repo1' } },
        { repositories: { owner: 'owner2', name: 'repo2' } },
      ];

      // Mock workspace repositories query
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockRepos,
            error: null,
          }),
        }),
      } as unknown);

      const result = await workspaceEventsService.getWorkspaceActivityFeed(mockWorkspaceId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for invalid workspace ID', async () => {
      const result = await workspaceEventsService.getWorkspaceActivityFeed('');
      expect(result).toEqual([]);
    });

    it('should return empty array for invalid activity feed limit', async () => {
      const result1 = await workspaceEventsService.getWorkspaceActivityFeed(mockWorkspaceId, 2000);
      expect(result1).toEqual([]);

      const result2 = await workspaceEventsService.getWorkspaceActivityFeed(mockWorkspaceId, 0);
      expect(result2).toEqual([]);
    });

    it('should return empty array when no repositories found', async () => {
      // Mock empty workspace repositories
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      } as unknown);

      const result = await workspaceEventsService.getWorkspaceActivityFeed(mockWorkspaceId);
      expect(result).toEqual([]);
    });

    it('should return empty array for repository query errors', async () => {
      // Mock workspace repositories query error
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Access denied', code: 'PGRST_ERROR' },
          }),
        }),
      } as unknown);

      const result = await workspaceEventsService.getWorkspaceActivityFeed(mockWorkspaceId);
      expect(result).toEqual([]);
    });
  });

  describe('private helper methods', () => {
    it('should calculate correct date ranges for different time periods', () => {
      // Test is accessing private method indirectly by testing the service behavior
      const mockWorkspaceId = 'workspace-123';

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      });

      // Test 7-day range
      workspaceEventsService.getWorkspaceEventMetrics(mockWorkspaceId, '7d');
      workspaceEventsService.getWorkspaceEventMetrics(mockWorkspaceId, '90d');
      workspaceEventsService.getWorkspaceEventMetrics(mockWorkspaceId, '1y');

      // Verify the RPC calls were made with correct parameters
      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_workspace_activity_velocity',
        expect.objectContaining({
          p_days: 7,
        })
      );

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_workspace_activity_velocity',
        expect.objectContaining({
          p_days: 90,
        })
      );

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_workspace_activity_velocity',
        expect.objectContaining({
          p_days: 365,
        })
      );
    });

    it('should default to 30 days for unknown time ranges', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      });

      await workspaceEventsService.getWorkspaceEventMetrics('workspace-123', 'unknown');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_workspace_activity_velocity',
        expect.objectContaining({
          p_days: 30,
        })
      );
    });
  });

  describe('error handling and edge cases', () => {
    it('should return null for non-string workspace ID types', async () => {
      const result1 = await workspaceEventsService.getWorkspaceEventMetrics(null as unknown, '30d');
      expect(result1).toBeNull();

      const result2 = await workspaceEventsService.getWorkspaceEventMetrics(123 as unknown, '30d');
      expect(result2).toBeNull();
    });

    it('should return null for non-string time range types', async () => {
      const result1 = await workspaceEventsService.getWorkspaceEventMetrics(
        'workspace-123',
        null as unknown
      );
      expect(result1).toBeNull();

      const result2 = await workspaceEventsService.getWorkspaceEventMetrics(
        'workspace-123',
        123 as unknown
      );
      expect(result2).toBeNull();
    });

    it('should handle partial data gracefully', async () => {
      // Mock partial velocity data
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            total_events: null,
            daily_average: undefined,
            star_velocity: 0,
            fork_velocity: null,
            growth_trend: 'stable',
          },
        ],
        error: null,
      });

      // Mock partial metrics data
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            total_star_events: null,
            total_fork_events: undefined,
            unique_actors: 0,
            most_active_repo_owner: null,
            most_active_repo_name: null,
            most_active_repo_events: null,
            daily_timeline: null,
          },
        ],
        error: null,
      });

      const result = await workspaceEventsService.getWorkspaceEventMetrics('workspace-123', '30d');

      expect(result).toBeDefined();
      expect(result?.stars.total).toBe(0);
      expect(result?.forks.total).toBe(0);
      expect(result?.activity.totalEvents).toBe(0);
      expect(result?.activity.mostActiveRepo).toBeNull();
      expect(result?.timeline).toEqual([]);
    });
  });
});
