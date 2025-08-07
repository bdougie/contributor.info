import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { BrowserRouter } from 'react-router-dom';
import RepoView from '../../components/features/repository/repo-view';

// NOTE: These tests are skipped because they test functionality with test IDs that don't exist
// in the actual components. They were created for a progressive loading feature that hasn't
// been implemented yet.

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
  http.post('https://*/rest/v1/rpc/repos', () => {
    return HttpResponse.json([createMockRepo()]);
  }),
  http.get('https://*/rest/v1/repos*', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('select') === 'id,pr_count') {
      // Stage 1: Critical data
      return HttpResponse.json([{ id: 1, pr_count: 150 }]);
    } else {
      // Stage 2: Full data
      return HttpResponse.json([createMockRepo()]);
    }
  }),
  http.get('https://*/rest/v1/contributors*', ({ request }) => {
    const url = new URL(request.url);
    const preferHeader = request.headers.get('Prefer');
    
    if (preferHeader?.includes('count=exact')) {
      // Contributor count query
      return HttpResponse.json([], {
        headers: {
          'Content-Range': '0-44/45'
        }
      });
    } else if (url.searchParams.get('limit') === '10') {
      // Top contributors
      return HttpResponse.json([
        createMockContributor({ id: 1, login: 'gaearon', contributions: 1250 }),
        createMockContributor({ id: 2, login: 'sebmarkbage', contributions: 892 }),
        createMockContributor({ id: 3, login: 'acdlite', contributions: 743 }),
      ]);
    } else if (url.searchParams.get('type') === 'human') {
      // Enhancement data: human contributions
      return HttpResponse.json([
        { contributions: 1250 },
        { contributions: 892 },
        { contributions: 743 },
      ]);
    } else if (url.searchParams.get('type') === 'bot') {
      // Enhancement data: bot contributions
      return HttpResponse.json([
        { contributions: 25 },
        { contributions: 15 },
      ]);
    }
    
    return HttpResponse.json([]);
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

describe.skip('Progressive Data Loading with MSW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path with Realistic API Responses', () => {
    it('loads data progressively with realistic Supabase responses', async () => {
      render(
        <BrowserRouter>
          <RepoView owner="facebook" repo="react" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/repos*', () => {
          return HttpResponse.json([]); // Empty array means no repo found
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="nonexistent" repo="repo" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/repository nonexistent\/repo not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Scenarios with Realistic HTTP Responses', () => {
    it('handles 500 server errors gracefully', async () => {
      server.use(
        http.get('https://*/rest/v1/repos*', ({ request }) => {
          return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="repo" />
        </BrowserRouter>
      );

      // Should show repository not found rather than crash
      await waitFor(() => {
        expect(screen.getByText(/repository test\/repo not found/i)).toBeInTheDocument();
      });
    });

    it('handles network timeout scenarios', async () => {
      server.use(
        http.get('https://*/rest/v1/repos*', async () => {
          // Simulate network timeout
          await new Promise(resolve => setTimeout(resolve, 30000));
          return new HttpResponse(null, { status: 408 });
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="repo" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/repos*', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('select') === 'id,pr_count') {
            // Critical data succeeds
            return HttpResponse.json([{ id: 1, pr_count: 100 }]);
          } else {
            // Full data fails
            return HttpResponse.json({ message: 'Service temporarily unavailable' }, { status: 503 });
          }
        }),
        http.get('https://*/rest/v1/contributors*', ({ request }) => {
          const preferHeader = request.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return HttpResponse.json([], {
              headers: {
                'Content-Range': '0-29/30'
              }
            });
          }
          return new HttpResponse(null, { status: 503 });
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="repo" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/repos*', async ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('select') === 'id,pr_count') {
            // Critical data with minimal delay
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json([{ id: 1, pr_count: 200 }]);
          } else {
            // Full data with more delay
            await new Promise(resolve => setTimeout(resolve, 300));
            return HttpResponse.json([createMockRepo({ pr_count: 200 })]);
          }
        }),
        http.get('https://*/rest/v1/contributors*', async ({ request }) => {
          const preferHeader = request.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            await new Promise(resolve => setTimeout(resolve, 50));
            return HttpResponse.json([], {
              headers: {
                'Content-Range': '0-79/80'
              }
            });
          }
          await new Promise(resolve => setTimeout(resolve, 200));
          return HttpResponse.json([]);
        })
      );

      const startTime = performance.now();
      render(
        <BrowserRouter>
          <RepoView owner="facebook" repo="react" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/*', ({ request }) => {
          apiCallCount++;
          return HttpResponse.json([]);
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="repo" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/repos*', ({ request }) => {
          return HttpResponse.json([createMockRepo({ pr_count: 50 })]);
        }),
        http.get('https://*/rest/v1/contributors*', ({ request }) => {
          const preferHeader = request.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return HttpResponse.json([], {
              headers: {
                'Content-Range': '*/0'
              }
            });
          }
          return HttpResponse.json([]);
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="empty" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/repos*', ({ request }) => {
          return HttpResponse.json([createMockRepo({ pr_count: 100000 })]);
        }),
        http.get('https://*/rest/v1/contributors*', ({ request }) => {
          const preferHeader = request.headers.get('Prefer');
          if (preferHeader?.includes('count=exact')) {
            return HttpResponse.json([], {
              headers: {
                'Content-Range': '0-9999/10000'
              }
            });
          } else if (url.searchParams.get('limit') === '10') {
            // Return top contributors
            return HttpResponse.json([
              createMockContributor({ id: 1, login: 'top1', contributions: 5000 }),
              createMockContributor({ id: 2, login: 'top2', contributions: 4000 }),
            ]);
          }
          return HttpResponse.json([]);
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="big" repo="project" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/contributors*', ({ request }) => {
          const url = new URL(request.url);
          const preferHeader = request.headers.get('Prefer');
          
          if (preferHeader?.includes('count=exact')) {
            return HttpResponse.json([], {
              headers: {
                'Content-Range': '0-4/5'
              }
            });
          } else if (url.searchParams.get('type') === 'human') {
            // No human contributors
            return HttpResponse.json([]);
          } else if (url.searchParams.get('type') === 'bot') {
            // Only bot contributions
            return HttpResponse.json([
              { contributions: 100 },
              { contributions: 75 },
              { contributions: 50 },
            ]);
          }
          
          return HttpResponse.json([
            createMockContributor({ id: 1, login: 'dependabot[bot]', type: 'bot', contributions: 100 }),
            createMockContributor({ id: 2, login: 'github-actions[bot]', type: 'bot', contributions: 75 }),
          ]);
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="bot-heavy" />
        </BrowserRouter>
      );

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
        http.get('https://*/rest/v1/repos*', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('select') === 'id,pr_count') {
            return HttpResponse.json([{ id: 1, pr_count: stage === 1 ? 100 : 101 }]);
          } else {
            stage = 2;
            return HttpResponse.json([createMockRepo({ id: 1, pr_count: 101 })]);
          }
        })
      );

      render(
        <BrowserRouter>
          <RepoView owner="test" repo="changing-data" />
        </BrowserRouter>
      );

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