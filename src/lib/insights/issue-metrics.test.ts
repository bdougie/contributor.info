import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateIssueHealthMetrics,
  calculateIssueActivityPatterns,
  calculateIssueMetrics,
  calculateIssueTrendMetrics,
} from './issue-metrics';
import { supabase } from '../supabase';

// Mock the supabase client
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          gte: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn(() => ({})),
              lt: vi.fn(() => ({})),
            })),
          })),
          lt: vi.fn(() => ({})),
          not: vi.fn(() => ({
            gte: vi.fn(() => ({})),
          })),
        })),
        gte: vi.fn(() => ({
          eq: vi.fn(() => ({})),
        })),
      })),
    })),
  },
}));

// Mock the simple logging module
vi.mock('../simple-logging', () => ({
  trackDatabaseOperation: vi.fn((name, fn) => fn()),
}));

describe('Issue Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateIssueHealthMetrics', () => {
    it('should return default values when repository is not found', async () => {
      const mockSupabaseFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      }));

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockSupabaseFrom);

      const result = await calculateIssueHealthMetrics('owner', 'repo', '30');

      expect(result).toEqual({
        staleVsActiveRatio: { stale: 0, active: 0, percentage: 0 },
        issueHalfLife: 0,
        legitimateBugPercentage: 0,
      });
    });

    it('should calculate stale vs active ratio correctly', async () => {
      const repoData = { id: 'repo-123' };
      const recentIssues = [{ id: '1' }, { id: '2' }]; // 2 active issues
      const staleIssues = [{ id: '3' }]; // 1 stale issue
      const closedIssues = [
        {
          created_at: '2023-01-01T00:00:00Z',
          closed_at: '2023-01-08T00:00:00Z', // 7 days to close
        },
        {
          created_at: '2023-01-10T00:00:00Z',
          closed_at: '2023-01-25T00:00:00Z', // 15 days to close
        },
      ];
      const bugIssues = [
        { id: '1', labels: ['bug', 'critical'] },
        { id: '2', labels: ['feature', 'enhancement'] },
      ];

      const mockChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: repoData }),
            gte: vi.fn(() => ({ data: recentIssues })),
            lt: vi.fn(() => ({ data: staleIssues })),
            not: vi.fn(() => ({
              gte: vi.fn(() => ({ data: closedIssues })),
            })),
          })),
          gte: vi.fn(() => ({
            eq: vi.fn(() => ({ data: bugIssues })),
          })),
        })),
      };

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockChain);

      const result = await calculateIssueHealthMetrics('owner', 'repo', '30');

      expect(result.staleVsActiveRatio.active).toBe(2);
      expect(result.staleVsActiveRatio.stale).toBe(1);
      expect(result.staleVsActiveRatio.percentage).toBe(33); // 1/3 * 100 rounded
      expect(result.issueHalfLife).toBe(11); // Median of [7, 15]
      expect(result.legitimateBugPercentage).toBe(50); // 1/2 * 100
    });
  });

  describe('calculateIssueActivityPatterns', () => {
    it('should return empty patterns when repository is not found', async () => {
      const mockSupabaseFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      }));

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockSupabaseFrom);

      const result = await calculateIssueActivityPatterns('owner', 'repo', '30');

      expect(result).toEqual({
        mostActiveTriager: null,
        firstResponders: [],
        repeatReporters: [],
      });
    });

    it('should calculate activity patterns correctly', async () => {
      const repoData = { id: 'repo-123' };
      const issues = [
        {
          id: 'issue-1',
          author_id: 'user-1',
          created_at: '2023-01-01T00:00:00Z',
          contributors: { username: 'reporter1', avatar_url: 'avatar1.jpg' },
        },
        {
          id: 'issue-2',
          author_id: 'user-1',
          created_at: '2023-01-02T00:00:00Z',
          contributors: { username: 'reporter1', avatar_url: 'avatar1.jpg' },
        },
      ];
      const issueComments = [
        {
          id: 'comment-1',
          commenter_id: 'user-2',
          created_at: '2023-01-01T12:00:00Z',
          contributors: { username: 'triager1', avatar_url: 'avatar2.jpg' },
          pull_requests: { repository_id: 'repo-123' },
        },
        {
          id: 'comment-2',
          commenter_id: 'user-2',
          created_at: '2023-01-02T12:00:00Z',
          contributors: { username: 'triager1', avatar_url: 'avatar2.jpg' },
          pull_requests: { repository_id: 'repo-123' },
        },
      ];

      const mockChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: repoData }),
            gte: vi.fn(() => ({ data: issues })),
          })),
          gte: vi.fn(() => ({ data: issueComments })),
        })),
      };

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockChain);

      const result = await calculateIssueActivityPatterns('owner', 'repo', '30');

      expect(result.mostActiveTriager).toEqual({
        username: 'triager1',
        avatar_url: 'avatar2.jpg',
        triages: 2,
      });

      expect(result.repeatReporters).toHaveLength(1);
      expect(result.repeatReporters[0]).toEqual({
        username: 'reporter1',
        avatar_url: 'avatar1.jpg',
        issues: 2,
      });
    });
  });

  describe('calculateIssueMetrics', () => {
    it('should return success status with valid data', async () => {
      // Mock successful responses
      const mockHealthMetrics = {
        staleVsActiveRatio: { stale: 5, active: 10, percentage: 33 },
        issueHalfLife: 7,
        legitimateBugPercentage: 25,
      };
      const mockActivityPatterns = {
        mostActiveTriager: { username: 'triager1', avatar_url: 'avatar.jpg', triages: 5 },
        firstResponders: [],
        repeatReporters: [],
      };

      vi.doMock('./issue-metrics', async () => {
        const actual = await vi.importActual('./issue-metrics');
        return {
          ...actual,
          calculateIssueHealthMetrics: vi.fn().mockResolvedValue(mockHealthMetrics),
          calculateIssueActivityPatterns: vi.fn().mockResolvedValue(mockActivityPatterns),
        };
      });

      const result = await calculateIssueMetrics('owner', 'repo', '30');

      expect(result.status).toBe('success');
      expect(result.healthMetrics).toEqual(mockHealthMetrics);
      expect(result.activityPatterns).toEqual(mockActivityPatterns);
    });

    it('should handle errors gracefully', async () => {
      // Force an error by mocking a rejected promise
      vi.doMock('./issue-metrics', async () => {
        const actual = await vi.importActual('./issue-metrics');
        return {
          ...actual,
          calculateIssueHealthMetrics: vi.fn().mockRejectedValue(new Error('Database error')),
          calculateIssueActivityPatterns: vi.fn().mockRejectedValue(new Error('Database error')),
        };
      });

      const result = await calculateIssueMetrics('owner', 'repo', '30');

      expect(result.status).toBe('error');
      expect(result.message).toBe('Failed to load issue metrics');
    });
  });

  describe('calculateIssueTrendMetrics', () => {
    it('should return empty array when repository is not found', async () => {
      const mockSupabaseFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      }));

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockSupabaseFrom);

      const result = await calculateIssueTrendMetrics('owner', 'repo', '30');

      expect(result).toEqual([]);
    });

    it('should calculate trend changes correctly', async () => {
      const mockCurrentMetrics = {
        staleVsActiveRatio: { stale: 10, active: 20, percentage: 33 },
        issueHalfLife: 14,
        legitimateBugPercentage: 30,
      };
      const mockPreviousMetrics = {
        staleVsActiveRatio: { stale: 5, active: 15, percentage: 25 },
        issueHalfLife: 21,
        legitimateBugPercentage: 40,
      };

      vi.doMock('./issue-metrics', async () => {
        const actual = await vi.importActual('./issue-metrics');
        return {
          ...actual,
          calculateIssueHealthMetrics: vi
            .fn()
            .mockResolvedValueOnce(mockCurrentMetrics)
            .mockResolvedValueOnce(mockPreviousMetrics),
        };
      });

      const result = await calculateIssueTrendMetrics('owner', 'repo', '30');

      expect(result).toHaveLength(4);

      // Check Issue Half-life trend (lower is better, so -33% change is good)
      const halfLifeTrend = result.find((t) => t.metric === 'Issue Half-life');
      expect(halfLifeTrend?.current).toBe(14);
      expect(halfLifeTrend?.previous).toBe(21);
      expect(halfLifeTrend?.change).toBe(-33); // (14-21)/21 * 100 = -33%
      expect(halfLifeTrend?.trend).toBe('down');
      expect(halfLifeTrend?.insight).toBe('Issues resolving faster');

      // Check Stale Issues trend
      const staleTrend = result.find((t) => t.metric === 'Stale Issues');
      expect(staleTrend?.current).toBe(33);
      expect(staleTrend?.previous).toBe(25);
      expect(staleTrend?.change).toBe(32); // (33-25)/25 * 100 = 32%
      expect(staleTrend?.trend).toBe('up');

      // Check Bug Reports trend
      const bugTrend = result.find((t) => t.metric === 'Bug Reports');
      expect(bugTrend?.current).toBe(30);
      expect(bugTrend?.previous).toBe(40);
      expect(bugTrend?.change).toBe(-25); // (30-40)/40 * 100 = -25%
      expect(bugTrend?.trend).toBe('down');
    });
  });
});
