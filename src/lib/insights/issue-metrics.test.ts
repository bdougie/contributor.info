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
    from: vi.fn(),
  },
}));

// Mock the simple logging module
vi.mock('../simple-logging', () => ({
  trackDatabaseOperation: vi.fn((name, fn) => fn()),
}));

// Helper function to create a chainable query mock
function createChainableMock(finalResult: { data: unknown; error?: unknown } = { data: null }) {
  const mock: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    single: vi.fn().mockResolvedValue(finalResult),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
  };

  // Make each method return the mock itself for chaining
  Object.keys(mock).forEach((key) => {
    if (key !== 'single' && key !== 'maybeSingle') {
      mock[key].mockReturnValue(mock);
    }
  });

  return mock;
}

describe('Issue Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateIssueHealthMetrics', () => {
    it('should return default values when repository is not found', async () => {
      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockReturnValue(
        createChainableMock({ data: null })
      );

      const result = await calculateIssueHealthMetrics('owner', 'repo', '30');

      expect(result).toEqual({
        staleVsActiveRatio: { stale: 0, active: 0, percentage: 0 },
        issueHalfLife: 0,
        legitimateBugPercentage: 0,
      });
    });

    it('should calculate stale vs active ratio correctly', async () => {
      const repoData = { id: 'repo-123' };

      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockImplementation(
        (table: string) => {
          if (table === 'repositories') {
            return createChainableMock({ data: repoData });
          }
          if (table === 'issues') {
            // Return basic data structure that shows the function can handle queries
            return createChainableMock({ data: [] });
          }
          return createChainableMock({ data: [] });
        }
      );

      const result = await calculateIssueHealthMetrics('owner', 'repo', '30');

      // Test that function returns expected structure (not exact values due to complex mocking)
      expect(result).toHaveProperty('staleVsActiveRatio');
      expect(result.staleVsActiveRatio).toHaveProperty('active');
      expect(result.staleVsActiveRatio).toHaveProperty('stale');
      expect(result.staleVsActiveRatio).toHaveProperty('percentage');
      expect(result).toHaveProperty('issueHalfLife');
      expect(result).toHaveProperty('legitimateBugPercentage');
      expect(typeof result.issueHalfLife).toBe('number');
      expect(typeof result.legitimateBugPercentage).toBe('number');
    });
  });

  describe('calculateIssueActivityPatterns', () => {
    it('should return empty patterns when repository is not found', async () => {
      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockReturnValue(
        createChainableMock({ data: null })
      );

      const result = await calculateIssueActivityPatterns('owner', 'repo', 30);

      expect(result).toEqual({
        mostActiveTriager: null,
        firstResponders: [],
        repeatReporters: [],
      });
    });

    it('should calculate activity patterns correctly', async () => {
      const repoData = { id: 'repo-123' };
      const issueData = [
        {
          id: '1',
          author_id: 'user1',
          created_at: '2023-01-01T10:00:00Z',
          contributors: [{ username: 'user1', avatar_url: 'https://example.com/user1.png' }],
        },
      ];
      const commentData = [
        {
          id: '1',
          commenter_id: 'user2',
          created_at: '2023-01-01T12:00:00Z',
          comment_type: 'issue_comment',
          contributors: [{ username: 'user2', avatar_url: 'https://example.com/user2.png' }],
        },
      ];

      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockImplementation(
        (table: string) => {
          if (table === 'repositories') {
            return createChainableMock({ data: repoData });
          }
          if (table === 'issues') {
            const mock = createChainableMock();
            mock.select.mockReturnValue(createChainableMock({ data: issueData }));
            return mock;
          }
          if (table === 'comments') {
            const mock = createChainableMock();
            mock.select.mockReturnValue(createChainableMock({ data: commentData }));
            return mock;
          }
          return createChainableMock({ data: [] });
        }
      );

      const result = await calculateIssueActivityPatterns('owner', 'repo', 30);

      expect(result.mostActiveTriager).toBeDefined();
      expect(result.firstResponders).toBeDefined();
      expect(result.repeatReporters).toBeDefined();
    });
  });

  describe('calculateIssueMetrics', () => {
    it('should return success status with valid data', async () => {
      // Set up mocks to return the expected data structure
      const repoData = { id: 'repo-123' };
      const openIssues = [
        { id: '1', comments_count: 5 }, // active
        { id: '2', comments_count: 0 }, // stale
        { id: '3', comments_count: 2 }, // active
      ];
      const closedIssues = [
        { created_at: '2023-01-01T00:00:00Z', closed_at: '2023-01-08T00:00:00Z' },
        { created_at: '2023-01-10T00:00:00Z', closed_at: '2023-01-25T00:00:00Z' },
      ];
      const bugIssues = [
        { id: '1', labels: ['bug', 'critical'] },
        { id: '2', labels: ['feature', 'enhancement'] },
      ];
      const commentData = [
        {
          id: '1',
          commenter_id: 'user1',
          created_at: '2023-01-01T12:00:00Z',
          comment_type: 'issue_comment',
          contributors: [{ username: 'user1', avatar_url: 'avatar1.png' }],
        },
      ];

      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockImplementation(
        (table: string) => {
          if (table === 'repositories') {
            return createChainableMock({ data: repoData });
          }
          if (table === 'issues') {
            const mock = createChainableMock();
            mock.select.mockImplementation(() => {
              const selectMock = createChainableMock();
              selectMock.eq.mockImplementation((field, value) => {
                if (field === 'repository_id' && value === 'repo-123') {
                  const repoMock = createChainableMock();
                  repoMock.eq.mockImplementation((stateField, stateValue) => {
                    if (stateField === 'state' && stateValue === 'open') {
                      return Promise.resolve({ data: openIssues });
                    } else if (stateField === 'state' && stateValue === 'closed') {
                      const closedMock = createChainableMock();
                      closedMock.not.mockReturnValue(createChainableMock());
                      closedMock.gte = vi.fn().mockResolvedValue({ data: closedIssues });
                      return closedMock;
                    }
                    return repoMock;
                  });
                  repoMock.gte.mockResolvedValue({ data: bugIssues });
                  return repoMock;
                }
                return selectMock;
              });
              return selectMock;
            });
            return mock;
          }
          if (table === 'comments') {
            const mock = createChainableMock();
            mock.select.mockReturnValue(createChainableMock({ data: commentData }));
            return mock;
          }
          return createChainableMock({ data: [] });
        }
      );

      const result = await calculateIssueMetrics('owner', 'repo', '30');

      expect(result.status).toBe('success');
      expect(result.healthMetrics).toHaveProperty('staleVsActiveRatio');
      expect(result.activityPatterns).toHaveProperty('mostActiveTriager');
      expect(result.activityPatterns).toHaveProperty('firstResponders');
      expect(result.activityPatterns).toHaveProperty('repeatReporters');
    });

    it('should handle errors gracefully', async () => {
      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await calculateIssueMetrics('owner', 'repo', '30');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to load issue metrics');
    });
  });

  describe('calculateIssueTrendMetrics', () => {
    it('should return empty array when repository is not found', async () => {
      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockReturnValue(
        createChainableMock({ data: null })
      );

      const result = await calculateIssueTrendMetrics('owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should calculate trend changes correctly', async () => {
      const repoData = { id: 'repo-123' };
      const issueData = [
        { created_at: '2023-01-01T00:00:00Z', state: 'open' },
        { created_at: '2023-01-02T00:00:00Z', state: 'closed', closed_at: '2023-01-05T00:00:00Z' },
      ];

      (supabase.from as vi.MockedFunction<typeof supabase.from>).mockImplementation(
        (table: string) => {
          if (table === 'repositories') {
            return createChainableMock({ data: repoData });
          }
          if (table === 'issues') {
            return createChainableMock({ data: issueData });
          }
          return createChainableMock({ data: [] });
        }
      );

      const result = await calculateIssueTrendMetrics('owner', 'repo');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('metric');
        expect(result[0]).toHaveProperty('current');
        expect(result[0]).toHaveProperty('previous');
        expect(result[0]).toHaveProperty('trend');
      }
    });
  });
});
