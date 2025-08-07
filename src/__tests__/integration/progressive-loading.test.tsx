import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import RepoView from '../../components/features/repository/repo-view';

// NOTE: These tests are skipped because they test functionality with test IDs that don't exist
// in the actual components. They were created for a progressive loading feature that hasn't
// been implemented yet.
import { supabase } from '../../lib/supabase';
import { BrowserRouter } from 'react-router-dom';

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ owner: 'facebook', repo: 'react' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/facebook/react' }),
  };
});

// Mock React Helmet Async
vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: any) => children,
  HelmetProvider: ({ children }: any) => children,
}));

// Mock Supabase client
vi.mock('../../lib/supabase', () => {
  const createMockQuery = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve) => resolve({ data: null, error: null, count: 0 }))
  });

  const mockSupabase = {
    from: vi.fn(() => createMockQuery()),
  };
  return { supabase: mockSupabase };
});

const mockSupabase = supabase as any;

// Helper to create a complete mock query object
const createMockQuery = (overrides: any = {}) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  ...overrides
});

describe.skip('Progressive Data Loading Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Happy Path Tests', () => {
    it('loads data in correct 3-stage sequence with proper timing', async () => {
      // Setup mock responses for each stage
      const mockRepoData = {
        id: 1,
        pr_count: 150,
        owner: 'facebook',
        repo: 'react',
        name: 'react',
        full_name: 'facebook/react',
        stargazers_count: 218000,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-08-07T15:45:30Z'
      };

      const mockTopContributors = [
        { id: 1, login: 'gaearon', contributions: 1250, type: 'human' },
        { id: 2, login: 'sebmarkbage', contributions: 892, type: 'human' },
        { id: 3, login: 'acdlite', contributions: 743, type: 'human' }
      ];

      const mockHumanContributions = [
        { contributions: 1250 },
        { contributions: 892 },
        { contributions: 743 }
      ];

      const mockBotContributions = [
        { contributions: 25 },
        { contributions: 15 }
      ];

      // Mock Stage 1: Critical data (repo exists + contributor count)
      const mockCriticalQuery = {
        single: vi.fn().mockResolvedValue({
          data: { id: 1, pr_count: 150 },
          error: null
        }),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis()
      };

      const mockContributorCountQuery = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          count: 45,
          error: null
        })
      };

      // Mock Stage 2: Full data (detailed repo + top contributors)
      const mockFullRepoQuery = {
        single: vi.fn().mockResolvedValue({
          data: mockRepoData,
          error: null
        }),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis()
      };

      const mockTopContributorsQuery = {
        limit: vi.fn().mockResolvedValue({
          data: mockTopContributors,
          error: null
        }),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis()
      };

      // Mock Stage 3: Enhancement data (human/bot contributions)
      const mockHumanContribQuery = {
        eq: vi.fn((field, value) => {
          if (field === 'type' && value === 'human') {
            return Promise.resolve({ data: mockHumanContributions, error: null });
          }
          return mockHumanContribQuery;
        }),
        select: vi.fn().mockReturnThis()
      };

      const mockBotContribQuery = {
        eq: vi.fn((field, value) => {
          if (field === 'type' && value === 'bot') {
            return Promise.resolve({ data: mockBotContributions, error: null });
          }
          return mockBotContribQuery;
        }),
        select: vi.fn().mockReturnThis()
      };

      // Setup mock call sequence
      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'repos') {
          if (callCount === 1) {
            // Stage 1: Basic repo lookup for existence
            return mockCriticalQuery;
          } else if (callCount === 3) {
            // Stage 2: Full repo data
            return mockFullRepoQuery;
          }
        }
        
        if (table === 'contributors') {
          if (callCount === 2) {
            // Stage 1: Contributor count
            return mockContributorCountQuery;
          } else if (callCount === 4) {
            // Stage 2: Top contributors
            return mockTopContributorsQuery;
          } else if (callCount === 5) {
            // Stage 3: Human contributions
            return mockHumanContribQuery;
          } else if (callCount === 6) {
            // Stage 3: Bot contributions
            return mockBotContribQuery;
          }
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: vi.fn((resolve) => resolve({ data: null, error: null, count: 0 }))
        };
      });

      const startTime = performance.now();
      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Stage 1: Critical data should appear within 500ms
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('150');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('45');
      }, { timeout: 500 });

      const criticalLoadTime = performance.now() - startTime;
      expect(criticalLoadTime).toBeLessThan(500);

      // Advance timers to trigger full data loading
      vi.advanceTimersByTime(50);

      // Stage 2: Full data should load after critical data
      await waitFor(() => {
        expect(screen.getByTestId('lottery-factor')).toHaveTextContent('3.33');
      });

      // Verify repo title is displayed
      expect(screen.getByText('facebook/react')).toBeInTheDocument();

      // Advance timers to trigger idle callback for enhancement data
      vi.advanceTimersByTime(150);

      // Stage 3: Enhancement data loads during idle time
      await waitFor(() => {
        expect(screen.getByTestId('direct-commits')).toHaveTextContent('2885');
        expect(screen.getByTestId('bot-contributions')).toHaveTextContent('40');
        expect(screen.getByTestId('avg-contributions')).toHaveTextContent('65');
      });

      // Verify API calls were made in correct sequence
      expect(mockSupabase.from).toHaveBeenCalledWith('repos');
      expect(mockSupabase.from).toHaveBeenCalledWith('contributors');
      expect(callCount).toBe(6); // Should not have duplicate calls
    });

    it('shows immediate critical data and progressive enhancement', async () => {
      // Simplified test focusing on the progressive nature
      const mockBasicRepo = { id: 1, pr_count: 50 };
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'repos') {
          return createMockQuery({
            single: vi.fn().mockResolvedValue({ data: mockBasicRepo, error: null })
          });
        }
        if (table === 'contributors') {
          return createMockQuery({
            eq: vi.fn().mockResolvedValue({ count: 20, error: null })
          });
        }
        return createMockQuery();
      });

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Critical data appears first
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('50');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('20');
      });

      // Should not show enhancement data immediately
      expect(screen.queryByTestId('direct-commits')).not.toBeInTheDocument();
    });
  });

  describe('Error Scenario Tests', () => {
    it('handles critical data failure with appropriate fallback', async () => {
      mockSupabase.from.mockImplementation(() => createMockQuery({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Network error' }
        })
      }));

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Should show repository not found, not crash
      await waitFor(() => {
        expect(screen.getByText(/repository nonexistent\/repo not found/i)).toBeInTheDocument();
      });

      // Should not show error boundary or spinner
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('handles full data failure without breaking critical data display', async () => {
      // Critical data succeeds
      const mockCriticalSuccess = createMockQuery({
        single: vi.fn().mockResolvedValue({
          data: { id: 1, pr_count: 100 },
          error: null
        })
      });

      const mockCountSuccess = createMockQuery({
        eq: vi.fn().mockResolvedValue({ count: 30, error: null })
      });

      // Full data fails
      const mockFullDataError = createMockQuery({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database timeout' }
        })
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'repos') {
          return callCount === 1 ? mockCriticalSuccess : mockFullDataError;
        }
        if (table === 'contributors') {
          return mockCountSuccess;
        }
      });

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Critical data should still be displayed
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('100');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('30');
      });

      // Should not show lottery factor (from full data)
      await waitFor(() => {
        expect(screen.queryByTestId('lottery-factor')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('handles enhancement failure without affecting core functionality', async () => {
      // Setup successful critical and full data
      const mockRepo = { id: 1, pr_count: 75 };
      const mockFullRepo = { ...mockRepo, name: 'test-repo' };
      const mockContributors = [{ id: 1, login: 'user1', contributions: 50 }];

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'repos') {
          if (callCount === 1) {
            return createMockQuery({
              single: vi.fn().mockResolvedValue({ data: mockRepo, error: null })
            });
          } else {
            return createMockQuery({
              single: vi.fn().mockResolvedValue({ data: mockFullRepo, error: null })
            });
          }
        }
        
        if (table === 'contributors') {
          if (callCount === 2) {
            return createMockQuery({
              eq: vi.fn().mockResolvedValue({ count: 25, error: null })
            });
          } else if (callCount === 3) {
            return createMockQuery({
              limit: vi.fn().mockResolvedValue({ data: mockContributors, error: null })
            });
          } else {
            // Enhancement data fails
            return createMockQuery({
              eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Enhancement error' } })
            });
          }
        }
        return createMockQuery();
      });

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Critical and full data should work fine
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('75');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('25');
      });

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('lottery-factor')).toHaveTextContent('3');
      });

      // Enhancement data should not appear due to error
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(screen.queryByTestId('direct-commits')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('handles network timeout gracefully', async () => {
      // Mock a slow/timeout response
      mockSupabase.from.mockImplementation(() => createMockQuery({
        single: vi.fn().mockImplementation(() => 
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: null, error: { message: 'timeout' } });
            }, 10000); // 10 second delay to simulate timeout
          })
        )
      }));

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Should show loading spinner initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Fast forward through the timeout
      vi.advanceTimersByTime(10000);

      // Should eventually show repo not found rather than hanging
      await waitFor(() => {
        expect(screen.getByText(/repository test\/repo not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Tests', () => {
    it('meets critical data loading performance targets', async () => {
      const mockRepo = { id: 1, pr_count: 200 };
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'repos') {
          return createMockQuery({
            single: vi.fn().mockResolvedValue({ data: mockRepo, error: null })
          });
        }
        return createMockQuery({
          eq: vi.fn().mockResolvedValue({ count: 80, error: null })
        });
      });

      const startTime = performance.now();
      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('200');
      }, { timeout: 500 });

      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(500); // Critical data target
    });

    it('prevents duplicate requests for same data', async () => {
      mockSupabase.from.mockImplementation(() => createMockQuery({
        single: vi.fn().mockResolvedValue({ data: { id: 1, pr_count: 100 }, error: null })
      }));

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toBeInTheDocument();
      });

      // Should not make duplicate calls for same repo
      const totalCalls = mockSupabase.from.mock.calls.length;
      expect(totalCalls).toBeLessThanOrEqual(6); // Max expected calls for 3-stage loading
    });

    it('uses requestIdleCallback correctly for enhancement data', async () => {
      const mockRepo = { id: 1, pr_count: 50, name: 'test' };
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'repos') {
          return createMockQuery({
            single: vi.fn().mockResolvedValue({ data: mockRepo, error: null })
          });
        }
        if (table === 'contributors') {
          return createMockQuery({
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          });
        }
        return createMockQuery();
      });

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toBeInTheDocument();
      });

      // Verify requestIdleCallback was called for enhancement data
      vi.advanceTimersByTime(200);
      
      expect(window.requestIdleCallback).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid navigation between repos', async () => {
      const mockRepoA = { id: 1, pr_count: 100 };
      const mockRepoB = { id: 2, pr_count: 200 };

      let currentRepo = 'repoA';
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'repos') {
          return createMockQuery({
            single: vi.fn().mockResolvedValue({
              data: currentRepo === 'repoA' ? mockRepoA : mockRepoB,
              error: null
            })
          });
        }
        return createMockQuery({
          eq: vi.fn().mockResolvedValue({ count: 50, error: null })
        });
      });

      const { rerender } = render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Wait for first repo to start loading
      await waitFor(() => {
        expect(screen.getByText('test/repoA')).toBeInTheDocument();
      });

      // Rapidly change to second repo
      currentRepo = 'repoB';
      rerender(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Should show data for final repo only
      await waitFor(() => {
        expect(screen.getByText('test/repoB')).toBeInTheDocument();
        expect(screen.getByTestId('pr-count')).toHaveTextContent('200');
      });

      // Should not show data from cancelled request
      expect(screen.queryByText('test/repoA')).not.toBeInTheDocument();
    });

    it('handles component unmount during loading', () => {
      mockSupabase.from.mockImplementation(() => createMockQuery({
        single: vi.fn().mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => resolve({ data: { id: 1, pr_count: 100 }, error: null }), 1000);
          })
        )
      }));

      const { unmount } = render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Unmount before API call completes
      unmount();

      // Should not cause errors (this mainly tests cleanup)
      expect(console.error).not.toHaveBeenCalled();
    });

    it('handles concurrent component mounts', async () => {
      mockSupabase.from.mockImplementation(() => createMockQuery({
        single: vi.fn().mockResolvedValue({ data: { id: 1, pr_count: 150 }, error: null })
      }));

      // Mount multiple instances simultaneously
      const { container: container1 } = render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );
      const { container: container2 } = render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Both should load data independently
      await waitFor(() => {
        expect(container1.querySelector('[data-testid="pr-count"]')).toHaveTextContent('150');
        expect(container2.querySelector('[data-testid="pr-count"]')).toHaveTextContent('150');
      });

      // Should not interfere with each other
      expect(container1.textContent).toContain('test/repo');
      expect(container2.textContent).toContain('test/repo');
    });

    it('handles slow network conditions', async () => {
      // Simulate slow responses with delays
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'repos') {
          return createMockQuery({
            single: vi.fn().mockImplementation(() => 
              new Promise(resolve => {
                setTimeout(() => resolve({ data: { id: 1, pr_count: 300 }, error: null }), 2000);
              })
            )
          });
        }
        return createMockQuery({
          eq: vi.fn().mockResolvedValue({ count: 120, error: null })
        });
      });

      render(
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      );

      // Should show loading state for extended period
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Fast forward through the delay
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('300');
      });
    });
  });
});