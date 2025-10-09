import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Set up environment variables before importing handler
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Mock Supabase before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

// Mock the rate limiter
vi.mock('../lib/rate-limiter.mts', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    checkLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetTime: Date.now() + 60000,
    }),
    reset: vi.fn(),
  })),
  getRateLimitKey: vi.fn().mockReturnValue('test-key'),
  applyRateLimitHeaders: vi.fn().mockImplementation((response) => response),
}));

import { createClient } from '@supabase/supabase-js';
import handler from '../api-suggest-reviewers';
import type { Context } from '@netlify/functions';

// Mock Context type for tests
const mockContext: Context = {
  awsRequestId: 'test-request-id',
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:test',
  memoryLimitInMB: '512',
  logGroupName: 'test-log-group',
  logStreamName: 'test-log-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
  clientContext: undefined,
  identity: undefined,
};

interface MockSupabaseClient {
  from: vi.MockedFunction<(table: string) => unknown>;
}

describe('Suggest Reviewers API Tests', () => {
  let mockSupabase: MockSupabaseClient;
  let mockFrom: vi.MockedFunction<(table: string) => unknown>;

  beforeEach(() => {
    // Setup default Supabase mock
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    (createClient as vi.MockedFunction<typeof createClient>).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>
    );

    // Mock environment variables - ensure all are set
    process.env.GITHUB_TOKEN = 'test-github-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    // Setup fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'OPTIONS',
      });

      const response = await handler(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Method validation', () => {
    it('should reject non-POST requests', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'GET',
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Request body validation', () => {
    beforeEach(() => {
      // Mock for all tables - simpler approach with consistent behavior
      mockFrom.mockImplementation((table: string) => {
        // For tracked_repositories table - always return the same valid repository
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', tracking_enabled: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For repositories table - return consistent repository data
        if (table === 'repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', full_name: 'owner/repo' },
            error: null,
          });
          const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
          return { select: mockSelect };
        }

        // Default for unknown tables
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });
    });

    it('should reject requests without files array', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prAuthor: 'author1' }),
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.userMessage).toBe(
        'Please provide a list of changed files or a valid PR URL.'
      );
    });

    it('should reject requests with empty files array', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [], prAuthor: 'author1' }),
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.userMessage).toBe(
        'Please provide a list of changed files or a valid PR URL.'
      );
    });

    it('should reject requests with invalid files format', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: 'not-an-array', prAuthor: 'author1' }),
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.userMessage).toBe(
        'Please provide a list of changed files or a valid PR URL.'
      );
    });
  });

  describe('Reviewer suggestions', () => {
    beforeEach(() => {
      // Override the from mock to handle all tables
      mockFrom.mockImplementation((table: string) => {
        // For tracked_repositories table - return consistent repository data
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', tracking_enabled: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For repositories table - return consistent repository data
        if (table === 'repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', full_name: 'owner/repo' },
            error: null,
          });
          const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
          return { select: mockSelect };
        }

        // For pull_requests table - for fallback PR author lookup
        if (table === 'pull_requests') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null, // No PR found (simulating PR not in database)
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
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
                },
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
                },
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

        // For commits table (fallback contributor suggestions)
        if (table === 'commits') {
          const mockLimit = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });
          const mockNot = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGte = vi.fn().mockReturnValue({ not: mockNot });
          const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For reviewer_suggestions_cache table
        if (table === 'reviewer_suggestions_cache') {
          // Mock for cache get (select chain)
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null, // Cache miss by default
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGt = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq2 = vi.fn().mockReturnValue({ gt: mockGt });
          const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

          // Mock for cache set (delete chain)
          const mockDeleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
          const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
          const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 });

          // Mock for cache set (insert)
          const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

          return {
            select: mockSelect,
            delete: mockDelete,
            insert: mockInsert,
          };
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.repository).toBe('owner/repo');
      expect(data.data.filesAnalyzed).toBe(2);
      expect(data.data.suggestions).toBeDefined();
      expect(Array.isArray(data.data.suggestions)).toBe(true);

      // Should include developers who worked on similar files
      const allSuggestions = data.data.suggestions;

      interface Suggestion {
        handle: string;
        [key: string]: unknown;
      }
      expect(allSuggestions.some((s: Suggestion) => s.handle === 'developer1')).toBe(true);
      expect(allSuggestions.some((s: Suggestion) => s.handle === 'developer2')).toBe(true);
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);

      const allSuggestions = data.data?.suggestions || [];

      // Should not include the PR author
      interface Suggestion {
        handle: string;
        [key: string]: unknown;
      }
      expect(allSuggestions.some((s: Suggestion) => s.handle === 'developer1')).toBe(false);
      expect(allSuggestions.some((s: Suggestion) => s.handle === 'developer2')).toBe(true);
    });

    it('should include CODEOWNERS in suggestions when available', async () => {
      // Override the from mock to include CODEOWNERS data
      mockFrom.mockImplementation((table: string) => {
        // For tracked_repositories table
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', tracking_enabled: true },
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
            data: { id: 'repo-123', full_name: 'owner/repo' },
            error: null,
          });
          const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
          return { select: mockSelect };
        }

        // For pull_requests table
        if (table === 'pull_requests') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
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

        // For commits table
        if (table === 'commits') {
          const mockLimit = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });
          const mockNot = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGte = vi.fn().mockReturnValue({ not: mockNot });
          const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For reviewer_suggestions_cache table
        if (table === 'reviewer_suggestions_cache') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGt = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq2 = vi.fn().mockReturnValue({ gt: mockGt });
          const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
          const mockDeleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
          const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
          const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 });
          const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
          return { select: mockSelect, delete: mockDelete, insert: mockInsert };
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.codeOwners).toEqual(['codeowner1', 'codeowner2']);

      // CODEOWNERS should be in suggestions
      expect(data.data.suggestions).toBeDefined();
      expect(data.data.suggestions.length).toBeGreaterThan(0);
      interface Suggestion {
        handle: string;
        [key: string]: unknown;
      }
      const suggestionHandles = data.data.suggestions.map((s: Suggestion) => s.handle);
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.codeOwners).toEqual([]);
      // Should still provide suggestions based on contribution data
      expect(data.data.suggestions).toBeDefined();
    });

    it('should return a specific error when GitHub file fetch fails', async () => {
      // Mock fetch to simulate GitHub API failure
      (global.fetch as vi.MockedFunction<typeof fetch>).mockResolvedValue({
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.userMessage).toBe(
        'Unable to fetch changed files from the provided PR URL. Please check the URL and try again.'
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
        // For tracked_repositories table
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', tracking_enabled: true },
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
            data: { id: 'repo-123', full_name: 'owner/repo' },
            error: null,
          });
          const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
          return { select: mockSelect };
        }

        // For pull_requests table
        if (table === 'pull_requests') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
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

        // For reviewer_suggestions_cache table
        if (table === 'reviewer_suggestions_cache') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGt = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq2 = vi.fn().mockReturnValue({ gt: mockGt });
          const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
          const mockDeleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
          const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
          const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 });
          const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
          return { select: mockSelect, delete: mockDelete, insert: mockInsert };
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Failed to fetch review data');
    });
  });

  describe('File analysis', () => {
    beforeEach(() => {
      // Mock all required tables for file analysis tests
      mockFrom.mockImplementation((table: string) => {
        // For tracked_repositories table
        if (table === 'tracked_repositories') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 'repo-123', tracking_enabled: true },
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
            data: { id: 'repo-123', full_name: 'owner/repo' },
            error: null,
          });
          const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
          return { select: mockSelect };
        }

        // For pull_requests table
        if (table === 'pull_requests') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
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

        // For commits table
        if (table === 'commits') {
          const mockLimit = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });
          const mockNot = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGte = vi.fn().mockReturnValue({ not: mockNot });
          const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For reviewer_suggestions_cache table
        if (table === 'reviewer_suggestions_cache') {
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockGt = vi.fn().mockReturnValue({ order: mockOrder });
          const mockEq2 = vi.fn().mockReturnValue({ gt: mockGt });
          const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
          const mockDeleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
          const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
          const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 });
          const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
          return { select: mockSelect, delete: mockDelete, insert: mockInsert };
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

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.filesAnalyzed).toBe(4);
      expect(data.data.directoriesAffected).toBeGreaterThan(0); // Should detect multiple directories
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/suggest-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Internal server error');
    });
  });
});
