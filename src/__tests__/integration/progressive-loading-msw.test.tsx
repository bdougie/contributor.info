import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { render } from '../../test-utils';
import { RepoView } from '../../components/RepoView/RepoView';

// Mock data factories
const createMockRepo = (overrides = {}) => ({
  id: 1,
  owner: 'facebook',
  repo: 'react',
  name: 'react',
  full_name: 'facebook/react',
  pr_count: 150,
  stargazers_count: 218000,
  forks_count: 42000,
  open_issues_count: 890,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-08-07T15:45:30Z',
  description: 'The library for web and native user interfaces',
  topics: ['javascript', 'react', 'frontend'],
  homepage: 'https://react.dev',
  license: { name: 'MIT' },
  ...overrides,
});

const createMockContributor = (overrides = {}) => ({
  id: Math.floor(Math.random() * 1000000),
  login: 'contributor',
  contributions: 25,
  type: 'human',
  ...overrides,
});

// MSW server setup
const server = setupServer(
  // Default success handlers
  rest.post('https://*/rest/v1/rpc/repos', (req, res, ctx) => {
    return res(ctx.json([createMockRepo()]));
  }),
  rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
    const url = new URL(req.url);
    if (url.searchParams.get('select') === 'id,pr_count') {
      // Stage 1: Critical data
      return res(ctx.json([{ id: 1, pr_count: 150 }]));
    } else {
      // Stage 2: Full data
      return res(ctx.json([createMockRepo()]));
    }
  }),
  rest.get('https://*/rest/v1/contributors*', (req, res, ctx) => {
    const url = new URL(req.url);
    const preferHeader = req.headers.get('Prefer');
    
    if (preferHeader?.includes('count=exact')) {
      // Contributor count query
      return res(
        ctx.set('Content-Range', '0-44/45'),
        ctx.json([])
      );
    } else if (url.searchParams.get('limit') === '10') {
      // Top contributors
      return res(ctx.json([
        createMockContributor({ id: 1, login: 'gaearon', contributions: 1250 }),
        createMockContributor({ id: 2, login: 'sebmarkbage', contributions: 892 }),
        createMockContributor({ id: 3, login: 'acdlite', contributions: 743 }),
      ]));
    } else if (url.searchParams.get('type') === 'human') {
      // Enhancement data: human contributions
      return res(ctx.json([
        { contributions: 1250 },
        { contributions: 892 },
        { contributions: 743 },
      ]));
    } else if (url.searchParams.get('type') === 'bot') {
      // Enhancement data: bot contributions
      return res(ctx.json([
        { contributions: 25 },
        { contributions: 15 },
      ]));
    }
    
    return res(ctx.json([]));
  })
);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

describe('Progressive Data Loading with MSW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path with Realistic API Responses', () => {
    it('loads data progressively with realistic Supabase responses', async () => {
      render(<RepoView owner="facebook" repo="react" />);

      // Stage 1: Critical data should appear quickly
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('150');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('45');
      }, { timeout: 1000 });

      // Stage 2: Full data with lottery factor
      await waitFor(() => {
        expect(screen.getByTestId('lottery-factor')).toHaveTextContent('3.33');
      });

      // Stage 3: Enhancement data (need to trigger idle callback)
      // Note: In real tests, we'd mock requestIdleCallback to be synchronous
      vi.waitFor(async () => {
        expect(screen.getByTestId('direct-commits')).toHaveTextContent('2885');
        expect(screen.getByTestId('bot-contributions')).toHaveTextContent('40');
      });
    });

    it('handles repository not found scenario', async () => {
      // Override handlers for this test
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          return res(ctx.json([])); // Empty array means no repo found
        })
      );

      render(<RepoView owner="nonexistent" repo="repo" />);

      await waitFor(() => {
        expect(screen.getByText(/repository nonexistent\/repo not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Scenarios with Realistic HTTP Responses', () => {
    it('handles 500 server errors gracefully', async () => {
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Internal server error' }));
        })
      );

      render(<RepoView owner="test" repo="repo" />);

      // Should show repository not found rather than crash
      await waitFor(() => {
        expect(screen.getByText(/repository test\/repo not found/i)).toBeInTheDocument();
      });
    });

    it('handles network timeout scenarios', async () => {
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          // Simulate network timeout
          return res(ctx.delay(30000), ctx.status(408));
        })
      );

      render(<RepoView owner="test" repo="repo" />);

      // Should show loading initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // After timeout, should gracefully handle
      await waitFor(() => {
        expect(screen.getByText(/repository test\/repo not found/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('handles partial data loading failures', async () => {
      // Critical data succeeds, full data fails
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          const url = new URL(req.url);
          if (url.searchParams.get('select') === 'id,pr_count') {
            // Critical data succeeds
            return res(ctx.json([{ id: 1, pr_count: 100 }]));
          } else {
            // Full data fails
            return res(ctx.status(503), ctx.json({ message: 'Service temporarily unavailable' }));
          }
        }),
        rest.get('https://*/rest/v1/contributors*', (req, res, ctx) => {
          const preferHeader = req.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return res(
              ctx.set('Content-Range', '0-29/30'),
              ctx.json([])
            );
          }
          return res(ctx.status(503));
        })
      );

      render(<RepoView owner="test" repo="repo" />);

      // Critical data should still display
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('100');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('30');
      });

      // Full data should not appear due to error
      await waitFor(() => {
        expect(screen.queryByTestId('lottery-factor')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Performance Testing with Network Delays', () => {
    it('meets performance targets despite network latency', async () => {
      // Add realistic latency to API calls
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          const url = new URL(req.url);
          if (url.searchParams.get('select') === 'id,pr_count') {
            // Critical data with minimal delay
            return res(ctx.delay(100), ctx.json([{ id: 1, pr_count: 200 }]));
          } else {
            // Full data with more delay
            return res(ctx.delay(300), ctx.json([createMockRepo({ pr_count: 200 })]));
          }
        }),
        rest.get('https://*/rest/v1/contributors*', (req, res, ctx) => {
          const preferHeader = req.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return res(
              ctx.delay(50),
              ctx.set('Content-Range', '0-79/80'),
              ctx.json([])
            );
          }
          return res(ctx.delay(200), ctx.json([]));
        })
      );

      const startTime = performance.now();
      render(<RepoView owner="facebook" repo="react" />);

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('200');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('80');
      }, { timeout: 600 });

      const criticalLoadTime = performance.now() - startTime;
      expect(criticalLoadTime).toBeLessThan(600); // Allow for network delay in tests
    });

    it('validates no duplicate API calls', async () => {
      let apiCallCount = 0;
      
      server.use(
        rest.get('https://*/rest/v1/*', (req, res, ctx) => {
          apiCallCount++;
          return res(ctx.json([]));
        })
      );

      render(<RepoView owner="test" repo="repo" />);

      await waitFor(() => {
        expect(screen.getByText('test/repo')).toBeInTheDocument();
      });

      // Should not make excessive API calls
      expect(apiCallCount).toBeLessThanOrEqual(6); // Maximum expected for 3-stage loading
    });
  });

  describe('Edge Cases with Real-world Data Patterns', () => {
    it('handles repos with zero contributors', async () => {
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          return res(ctx.json([createMockRepo({ pr_count: 50 })]));
        }),
        rest.get('https://*/rest/v1/contributors*', (req, res, ctx) => {
          const preferHeader = req.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return res(
              ctx.set('Content-Range', '*/0'),
              ctx.json([])
            );
          }
          return res(ctx.json([]));
        })
      );

      render(<RepoView owner="test" repo="empty" />);

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('50');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('0');
      });

      // Lottery factor should not appear (division by zero case)
      await waitFor(() => {
        expect(screen.queryByTestId('lottery-factor')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('handles extremely large contributor counts', async () => {
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          return res(ctx.json([createMockRepo({ pr_count: 100000 })]));
        }),
        rest.get('https://*/rest/v1/contributors*', (req, res, ctx) => {
          const preferHeader = req.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return res(
              ctx.set('Content-Range', '0-9999/10000'),
              ctx.json([])
            );
          } else if (req.url.searchParams.get('limit') === '10') {
            // Return top contributors
            return res(ctx.json([
              createMockContributor({ id: 1, login: 'top1', contributions: 5000 }),
              createMockContributor({ id: 2, login: 'top2', contributions: 4000 }),
            ]));
          }
          return res(ctx.json([]));
        })
      );

      render(<RepoView owner="big" repo="project" />);

      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('100000');
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('10000');
      });

      await waitFor(() => {
        expect(screen.getByTestId('lottery-factor')).toHaveTextContent('10');
      });
    });

    it('handles repos with only bot contributions', async () => {
      server.use(
        rest.get('https://*/rest/v1/contributors*', (req, res, ctx) => {
          const url = new URL(req.url);
          const preferHeader = req.headers.get('Prefer');
          
          if (preferHeader?.includes('count=exact')) {
            return res(
              ctx.set('Content-Range', '0-4/5'),
              ctx.json([])
            );
          } else if (url.searchParams.get('type') === 'human') {
            // No human contributors
            return res(ctx.json([]));
          } else if (url.searchParams.get('type') === 'bot') {
            // Only bot contributions
            return res(ctx.json([
              { contributions: 100 },
              { contributions: 75 },
              { contributions: 50 },
            ]));
          }
          
          return res(ctx.json([
            createMockContributor({ id: 1, login: 'dependabot[bot]', type: 'bot', contributions: 100 }),
            createMockContributor({ id: 2, login: 'github-actions[bot]', type: 'bot', contributions: 75 }),
          ]));
        })
      );

      render(<RepoView owner="test" repo="bot-heavy" />);

      await waitFor(() => {
        expect(screen.getByTestId('contributor-count')).toHaveTextContent('5');
      });

      // Should eventually show enhancement data with bot contributions
      vi.waitFor(async () => {
        expect(screen.getByTestId('direct-commits')).toHaveTextContent('0');
        expect(screen.getByTestId('bot-contributions')).toHaveTextContent('225');
        expect(screen.getByTestId('avg-contributions')).toHaveTextContent('45');
      });
    });
  });

  describe('Data Consistency Validation', () => {
    it('ensures data consistency across loading stages', async () => {
      // Simulate scenario where data changes between stages
      let stage = 1;
      
      server.use(
        rest.get('https://*/rest/v1/repos*', (req, res, ctx) => {
          const url = new URL(req.url);
          if (url.searchParams.get('select') === 'id,pr_count') {
            return res(ctx.json([{ id: 1, pr_count: stage === 1 ? 100 : 101 }]));
          } else {
            stage = 2;
            return res(ctx.json([createMockRepo({ id: 1, pr_count: 101 })]));
          }
        })
      );

      render(<RepoView owner="test" repo="changing-data" />);

      // Critical data shows initial value
      await waitFor(() => {
        expect(screen.getByTestId('pr-count')).toHaveTextContent('100');
      });

      // Full data should maintain consistency (this is a real-world edge case)
      await waitFor(() => {
        expect(screen.getByTestId('lottery-factor')).toBeInTheDocument();
      });

      // PR count should still be consistent with what lottery factor was calculated from
      expect(screen.getByTestId('pr-count')).toHaveTextContent('100');
    });
  });
});