import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Set up environment variables before importing handler
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock Supabase before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));
import { createClient } from '@supabase/supabase-js';
import handler from '../api-suggest-reviewers';

describe('Suggest Reviewers API Tests', () => {
  let mockSupabase: any;
  let mockFrom: any;

  beforeEach(() => {
    // Setup default Supabase mock
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock environment variables
    process.env.GITHUB_TOKEN = 'test-github-token';

    // Setup fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'OPTIONS',
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Method validation', () => {
    it('should reject non-POST requests', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Request body validation', () => {
    beforeEach(() => {
      // Mock for all tables
      mockFrom.mockImplementation((table: string) => {
        // For rate_limits table
        if (table === 'rate_limits') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
          return {
            select: mockSelect,
            upsert: mockUpsert
          };
        }

        // For tracked_repositories table
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 1, is_active: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // Default for unknown tables
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        };
      });
    });

    it('should reject requests without files array', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prAuthor: 'author1' }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please provide an array of files changed in the PR');
    });

    it('should reject requests with empty files array', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [], prAuthor: 'author1' }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please provide an array of files changed in the PR');
    });

    it('should reject requests with invalid files format', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: 'not-an-array', prAuthor: 'author1' }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please provide an array of files changed in the PR');
    });
  });

  describe('Reviewer suggestions', () => {
    beforeEach(() => {
      let queryCount = 0;

      // Override the from mock to handle all tables
      mockFrom.mockImplementation((table: string) => {
        // For rate_limits table (for rate limiter)
        if (table === 'rate_limits') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For tracked_repositories table
        if (table === 'tracked_repositories') {
          queryCount++;
          // First call is for validation
          if (queryCount === 1) {
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: { id: 1, is_active: true },
              error: null,
            });
            const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            return { select: mockSelect };
          } else {
            // Second call is for getting repository ID
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: { id: 'repo-123' },
              error: null,
            });
            const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            return { select: mockSelect };
          }
        }

        // For reviews table
        if (table === 'reviews') {
          const mockLimit = vi.fn().mockResolvedValue({
            data: [
              {
                id: 'review-1',
                state: 'APPROVED',
                submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                pull_request_id: 'pr-1',
                reviewer: {
                  username: 'developer1',
                  avatar_url: 'https://github.com/developer1.png',
                },
                pull_request: {
                  id: 'pr-1',
                  title: 'Fix auth component',
                  files_changed: 5,
                  additions: 100,
                  deletions: 50,
                  merged_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                }
              },
              {
                id: 'review-2',
                state: 'APPROVED',
                submitted_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                pull_request_id: 'pr-2',
                reviewer: {
                  username: 'developer2',
                  avatar_url: 'https://github.com/developer2.png',
                },
                pull_request: {
                  id: 'pr-2',
                  title: 'Add auth tests',
                  files_changed: 3,
                  additions: 200,
                  deletions: 30,
                  merged_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                }
              },
            ],
            error: null,
          });

          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For codeowners table (mock empty result by default)
        if (table === 'codeowners') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        throw new Error(`Unexpected table: ${table}`);
      });
    });

    it('should suggest reviewers based on file overlap', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: ['src/components/auth.tsx', 'src/lib/new-feature.ts'],
          prAuthor: 'author1',
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.repository).toBe('owner/repo');
      expect(data.filesAnalyzed).toBe(2);
      expect(data.suggestions).toBeDefined();
      expect(Array.isArray(data.suggestions)).toBe(true);

      // Should include developers who worked on similar files
      const allSuggestions = data.suggestions;

      expect(allSuggestions.some((s: any) => s.handle === 'developer1')).toBe(true);
      expect(allSuggestions.some((s: any) => s.handle === 'developer2')).toBe(true);
    });

    it('should exclude PR author from suggestions', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: ['src/components/auth.tsx'],
          prAuthor: 'developer1', // This developer should be excluded
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);

      const allSuggestions = data.suggestions;

      // Should not include the PR author
      expect(allSuggestions.some((s: any) => s.handle === 'developer1')).toBe(false);
      expect(allSuggestions.some((s: any) => s.handle === 'developer2')).toBe(true);
    });

    it('should include CODEOWNERS in suggestions when available', async () => {
      // Override the from mock to include CODEOWNERS data
      mockFrom.mockImplementation((table: string) => {
        // For rate_limits table
        if (table === 'rate_limits') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For tracked_repositories table
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', is_active: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For codeowners table - return CODEOWNERS content
        if (table === 'codeowners') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: {
              content: 'src/components/ @codeowner1 @codeowner2',
              file_path: '.github/CODEOWNERS',
            },
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For reviews table
        if (table === 'reviews') {
          const mockLimit = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: ['src/components/auth.tsx'],
          prAuthor: 'author1',
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.codeOwners).toEqual(['codeowner1', 'codeowner2']);

      // CODEOWNERS should be in suggestions
      expect(data.suggestions.length).toBeGreaterThan(0);
      const suggestionHandles = data.suggestions.map((s: any) => s.handle);
      expect(suggestionHandles).toContain('codeowner1');
      expect(suggestionHandles).toContain('codeowner2');
    });

    it('should handle missing GitHub token gracefully', async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.VITE_GITHUB_TOKEN;

      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: ['src/components/auth.tsx'],
          prAuthor: 'author1',
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.codeOwners).toEqual([]);
      // Should still provide suggestions based on contribution data
      expect(data.suggestions).toBeDefined();
    });

    it('should return a specific error when GitHub file fetch fails', async () => {
      // Mock fetch to simulate GitHub API failure
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"message": "Not Found"}',
      });

      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prUrl: 'https://github.com/owner/repo/pull/123',
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        'Failed to fetch files from the provided PR URL. The URL may be invalid, the repository may be private, or the GitHub API may be inaccessible.'
      );
    });

    it('should handle contribution data fetch errors', async () => {
      // Mock database error for contributions
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockImplementation((table: string) => {
        // For tracked_repositories table (validation)
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 1, is_active: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For repositories table
        if (table === 'repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123' },
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq2 = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelectLocal = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelectLocal };
        }

        // For reviews table - return error
        if (table === 'reviews') {
          return { select: mockSelect };
        }

        // For codeowners table
        if (table === 'codeowners') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockLimitLocal = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrderLocal = vi.fn().mockReturnValue({ limit: mockLimitLocal });
          const mockEqLocal = vi.fn().mockReturnValue({ order: mockOrderLocal });
          const mockSelectLocal = vi.fn().mockReturnValue({ eq: mockEqLocal });
          return { select: mockSelectLocal };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: ['src/components/auth.tsx'],
          prAuthor: 'author1',
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to fetch contribution data');
    });
  });

  describe('File analysis', () => {
    beforeEach(() => {
      // Mock all required tables for file analysis tests
      mockFrom.mockImplementation((table: string) => {
        // For tracked_repositories table (validation)
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 1, is_active: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For repositories table
        if (table === 'repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123' },
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq2 = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For reviews table - empty data for file analysis tests
        if (table === 'reviews') {
          const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For codeowners table
        if (table === 'codeowners') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        throw new Error(`Unexpected table: ${table}`);
      });
    });

    it('should analyze directories and file types correctly', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            'src/components/auth/login.tsx',
            'src/components/auth/register.tsx',
            'src/lib/utils.ts',
            'tests/auth.test.ts',
          ],
          prAuthor: 'author1',
        }),
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filesAnalyzed).toBe(4);
      expect(data.directoriesAffected).toBeGreaterThan(0); // Should detect multiple directories
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });
});
