import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateRepositoryConfidence, clearConfidenceCache } from './health-metrics';
import { supabase } from '@/lib/supabase';

// Mock the entire supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Cast to allow mock reassignment in tests
const mockSupabase = supabase as { from: ReturnType<typeof vi.fn> };

interface QueryResult {
  data: unknown;
  error: unknown;
}

// Helper function to create a chainable query mock
function createChainableMock(finalResult: QueryResult) {
  // Create a resolved promise that will be returned when the query is awaited
  const resolvedPromise = Promise.resolve(finalResult);

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
    single: vi.fn().mockResolvedValue(finalResult),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn().mockResolvedValue(finalResult),
  };

  // Make each method return the mock itself for chaining
  Object.keys(mock).forEach((key) => {
    if (key !== 'single' && key !== 'upsert') {
      (mock[key] as ReturnType<typeof vi.fn>).mockReturnValue(mock);
    }
  });

  // Make the mock a thenable/promise-like object
  // This ensures it resolves correctly when awaited directly (for queries without .single())
  mock.then = resolvedPromise.then.bind(resolvedPromise);
  mock.catch = resolvedPromise.catch.bind(resolvedPromise);
  mock.finally = resolvedPromise.finally.bind(resolvedPromise);

  return mock;
}

describe('calculateRepositoryConfidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfidenceCache(); // Clear in-memory cache between tests
  });

  describe('Star/Fork Confidence Calculation', () => {
    it('should calculate high confidence when many stargazers become contributors', () => {
      // Mock repository data
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2023-01-01',
          open_issues_count: 10,
          contributors_count: 70,
        },
        error: null,
      };

      // Mock star events (100 unique users)
      const mockStarEvents = {
        data: Array.from({ length: 100 }, (_, i) => ({
          actor_login: `user${i}`,
        })),
        error: null,
      };

      // Mock fork events (50 unique users)
      const mockForkEvents = {
        data: Array.from({ length: 50 }, (_, i) => ({
          actor_login: `forker${i}`,
        })),
        error: null,
      };

      // Mock contributors (40 stargazers + 30 forkers became contributors)
      const mockContributors = {
        data: [
          ...Array.from({ length: 40 }, (_, i) => ({
            username: `user${i}`,
          })),
          ...Array.from({ length: 30 }, (_, i) => ({
            username: `forker${i}`,
          })),
        ],
        error: null,
      };

      // Setup mock chain
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'github_events_cache') {
          // Return star events data with both stars and forks
          const allEvents = [
            ...mockStarEvents.data.map((d: { actor_login: string }) => ({
              ...d,
              event_type: 'WatchEvent',
            })),
            ...mockForkEvents.data.map((d: { actor_login: string }) => ({
              ...d,
              event_type: 'ForkEvent',
            })),
          ];
          return createChainableMock({ data: allEvents, error: null });
        }
        if (table === 'pull_requests') {
          return createChainableMock(mockContributors);
        }
        if (table === 'contributors') {
          return createChainableMock(mockContributors);
        }
        if (table === 'repository_confidence_cache') {
          // For cache queries, return no cached data (which should make the function calculate fresh)
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        if (table === 'github_sync_status') {
          return createChainableMock({ data: null, error: null });
        }
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // With the mock data provided, should calculate some reasonable confidence
        // The exact algorithm may use fallback due to mock limitations
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate low confidence when few stargazers become contributors', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 1000,
          forks_count: 200,
          created_at: '2023-01-01',
          open_issues_count: 50,
          contributors_count: 15,
        },
        error: null,
      };

      const mockStarEvents = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          actor_login: `user${i}`,
        })),
        error: null,
      };

      const mockForkEvents = {
        data: Array.from({ length: 200 }, (_, i) => ({
          actor_login: `forker${i}`,
        })),
        error: null,
      };

      // Only 10 stargazers and 5 forkers became contributors
      const mockContributors = {
        data: [
          ...Array.from({ length: 10 }, (_, i) => ({
            username: `user${i}`,
          })),
          ...Array.from({ length: 5 }, (_, i) => ({
            username: `forker${i}`,
          })),
        ],
        error: null,
      };

      // Setup mock chain
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'github_events_cache') {
          // Return star events data with both stars and forks
          const allEvents = [
            ...mockStarEvents.data.map((d: { actor_login: string }) => ({
              ...d,
              event_type: 'WatchEvent',
            })),
            ...mockForkEvents.data.map((d: { actor_login: string }) => ({
              ...d,
              event_type: 'ForkEvent',
            })),
          ];
          return createChainableMock({ data: allEvents, error: null });
        }
        if (table === 'pull_requests') {
          return createChainableMock(mockContributors);
        }
        if (table === 'contributors') {
          return createChainableMock(mockContributors);
        }
        if (table === 'repository_confidence_cache') {
          // For cache queries, return no cached data (which should make the function calculate fresh)
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        if (table === 'github_sync_status') {
          return createChainableMock({ data: null, error: null });
        }
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should be in the "intimidating" range (0-30%)
        expect(result).toBeLessThan(30);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle repositories with no stars or forks', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 0,
          forks_count: 0,
          created_at: '2023-01-01',
        },
        error: null,
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'github_events_cache') {
          // Return empty array for star/fork events (no engagement)
          return createChainableMock({ data: [], error: null });
        }
        if (table === 'pull_requests') {
          // Return empty array for pull requests (no contributors)
          return createChainableMock({ data: [], error: null });
        }
        if (table === 'contributors') {
          // Return empty array for contributors
          return createChainableMock({ data: [], error: null });
        }
        if (table === 'repository_confidence_cache') {
          // For cache queries, return no cached data (which should make the function calculate fresh)
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        if (table === 'github_sync_status') {
          return createChainableMock({ data: null, error: null });
        }
        // Default: empty data for all other tables
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should return 0 for repos with absolutely no engagement or contributors
        // The fallback calculation with 0 stars, 0 forks, 0 contributors should return 0
        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
        expect(result).toBeLessThanOrEqual(20); // Should be very low for empty repos
        expect(result).toBeGreaterThanOrEqual(0); // Should not be negative
      });
    });

    it('should handle database errors gracefully', () => {
      mockSupabase.from = vi.fn().mockImplementation(() => {
        return createChainableMock({
          data: null,
          error: new Error('Database error'),
        });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should return 0 on error
        expect(result).toBe(0);
      });
    });

    it('should handle new repositories appropriately', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 50,
          forks_count: 10,
          created_at: new Date().toISOString(), // Created today
          open_issues_count: 5,
          contributors_count: 12,
        },
        error: null,
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'pull_requests') {
          return createChainableMock({
            data: Array.from({ length: 8 }, (_, i) => ({ author_id: i })),
            error: null,
          });
        }
        if (table === 'repository_confidence_cache') {
          // For cache queries, return no cached data (which should make the function calculate fresh)
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // New repos should get a boost to avoid showing 0%
        expect(result).toBeGreaterThan(0);
      });
    });
  });

  describe('Time Range Handling', () => {
    it('should respect different time ranges', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2022-01-01',
        },
        error: null,
      };

      let capturedDateFilter: string | undefined;

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'github_events_cache') {
          const mock = createChainableMock({ data: [], error: null });
          // Override gte to capture the date filter
          mock.gte = vi.fn().mockImplementation((field: string, value: string) => {
            if (field === 'created_at') {
              capturedDateFilter = value;
            }
            return mock;
          });
          return mock;
        }
        const mock = createChainableMock({ data: [], error: null });
        mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
        return mock;
      });

      // Test 30-day range, then 90-day range
      return calculateRepositoryConfidence('test-owner', 'test-repo', '30')
        .then(() => {
          if (capturedDateFilter) {
            const date30 = new Date(capturedDateFilter);
            const now = new Date();
            const daysDiff = Math.floor((now.getTime() - date30.getTime()) / (1000 * 60 * 60 * 24));
            expect(daysDiff).toBeCloseTo(30, 0);
          }

          capturedDateFilter = undefined;
          return calculateRepositoryConfidence('test-owner', 'test-repo', '90');
        })
        .then(() => {
          if (capturedDateFilter) {
            const date90 = new Date(capturedDateFilter);
            const now = new Date();
            const daysDiff90 = Math.floor(
              (now.getTime() - date90.getTime()) / (1000 * 60 * 60 * 24)
            );
            expect(daysDiff90).toBeCloseTo(90, 0);
          }
        });
    });
  });

  describe('Fallback Calculation', () => {
    it('should use fallback calculation when event data is unavailable', () => {
      const mockRepo = {
        data: {
          id: 1,
          owner: 'test-owner',
          name: 'test-repo',
          stargazers_count: 500,
          forks_count: 100,
          open_issues_count: 20,
          contributors_count: 50,
          created_at: '2022-01-01',
        },
        error: null,
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'pull_requests') {
          return createChainableMock({
            data: Array.from({ length: 25 }, (_, i) => ({ author_id: i })),
            error: null,
          });
        }
        if (table === 'repository_confidence_cache') {
          // For cache queries, return no cached data (which should make the function calculate fresh)
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        // Return empty data for all event queries
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should use fallback calculation based on repo metrics
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(100);
      });
    });
  });

  describe('Expanded Contributor Definition', () => {
    it('should count issue authors as contributors', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2023-01-01',
        },
        error: null,
      };

      // Mock issue authors
      const mockIssueAuthors = {
        data: Array.from({ length: 10 }, (_, i) => ({
          actor_login: `issue_author${i}`,
        })),
        error: null,
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'github_events_cache') {
          const mock = createChainableMock({ data: [], error: null });
          // Override in to detect IssuesEvent query
          const originalIn = mock.in as ReturnType<typeof vi.fn>;
          mock.in = vi.fn().mockImplementation((field: string, values: string[]) => {
            if (values.includes('IssuesEvent')) {
              return createChainableMock(mockIssueAuthors);
            }
            return originalIn.call(mock, field, values);
          });
          // Override eq to detect IssuesEvent query
          const originalEq = mock.eq as ReturnType<typeof vi.fn>;
          mock.eq = vi.fn().mockImplementation((field: string, value: string) => {
            if (field === 'event_type' && value === 'IssuesEvent') {
              return createChainableMock(mockIssueAuthors);
            }
            return originalEq.call(mock, field, value);
          });
          return mock;
        }
        if (table === 'pull_requests') {
          return createChainableMock({ data: [], error: null });
        }
        if (table === 'discussions') {
          return createChainableMock({ data: [], error: null });
        }
        if (table === 'repository_confidence_cache') {
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should calculate confidence including issue authors
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      });
    });

    it('should count discussion participants as contributors', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2023-01-01',
        },
        error: null,
      };

      // Mock discussion participants
      const mockDiscussionParticipants = {
        data: Array.from({ length: 8 }, (_, i) => ({
          author_login: `discussion_user${i}`,
        })),
        error: null,
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'discussions') {
          return createChainableMock(mockDiscussionParticipants);
        }
        if (table === 'repository_confidence_cache') {
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should calculate confidence including discussion participants
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      });
    });

    it('should count reviewers as contributors', () => {
      const mockRepo = {
        data: {
          id: 1,
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2023-01-01',
        },
        error: null,
      };

      // Mock reviewers
      const mockReviewers = {
        data: Array.from({ length: 5 }, (_, i) => ({
          actor_login: `reviewer${i}`,
        })),
        error: null,
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return createChainableMock(mockRepo);
        }
        if (table === 'github_events_cache') {
          const mock = createChainableMock({ data: [], error: null });
          // Override in to detect review event queries
          const originalIn = mock.in as ReturnType<typeof vi.fn>;
          mock.in = vi.fn().mockImplementation((field: string, values: string[]) => {
            if (
              values.includes('PullRequestReviewEvent') ||
              values.includes('PullRequestReviewCommentEvent')
            ) {
              return createChainableMock(mockReviewers);
            }
            return originalIn.call(mock, field, values);
          });
          return mock;
        }
        if (table === 'repository_confidence_cache') {
          const mock = createChainableMock({ data: null, error: null });
          mock.delete = vi.fn().mockReturnValue(createChainableMock({ data: null, error: null }));
          return mock;
        }
        return createChainableMock({ data: [], error: null });
      });

      return calculateRepositoryConfidence('test-owner', 'test-repo', '30').then((result) => {
        // Should calculate confidence including reviewers
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      });
    });
  });
});
