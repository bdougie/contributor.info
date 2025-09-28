import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase before importing
vi.mock('../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

import { createSupabaseClient } from '../../src/lib/supabase.js';
import handler from '../api-suggest-reviewers';

describe('Suggest Reviewers API Tests', () => {
  let mockSupabase: any;
  let mockFrom: any;

  beforeEach(() => {
    // Setup default Supabase mock
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    (createSupabaseClient as any).mockReturnValue(mockSupabase);

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
      // Mock repository validation for body validation tests
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 1, is_active: true },
        error: null
      });
      const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });
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
        // For tracked_repositories table (validation)
        if (table === 'tracked_repositories') {
          queryCount++;
          const mockMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: 1, is_active: true },
            error: null,
          });
          const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
          const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          return { select: mockSelect };
        }

        // For repositories table (getting repository ID)
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

        // For github_contributions table
        if (table === 'github_contributions') {
          const mockLimit = vi.fn().mockResolvedValue({
            data: [
              {
                contributor: {
                  username: 'developer1',
                  avatar_url: 'https://github.com/developer1.png',
                },
                additions: 100,
                deletions: 50,
                commits: 10,
                files_changed: ['src/components/auth.tsx', 'src/lib/utils.ts'],
                last_contributed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
              },
              {
                contributor: {
                  username: 'developer2',
                  avatar_url: 'https://github.com/developer2.png',
                },
                additions: 200,
                deletions: 30,
                commits: 15,
                files_changed: ['src/components/auth.tsx', 'tests/auth.test.ts'],
                last_contributed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
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
      expect(data.suggestions.primary).toBeDefined();
      expect(data.suggestions.secondary).toBeDefined();
      expect(data.suggestions.additional).toBeDefined();

      // Should include developers who worked on similar files
      const allSuggestions = [
        ...data.suggestions.primary,
        ...data.suggestions.secondary,
        ...data.suggestions.additional,
      ];

      expect(allSuggestions.some((s: any) => s.username === 'developer1')).toBe(true);
      expect(allSuggestions.some((s: any) => s.username === 'developer2')).toBe(true);
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

      const allSuggestions = [
        ...data.suggestions.primary,
        ...data.suggestions.secondary,
        ...data.suggestions.additional,
      ];

      // Should not include the PR author
      expect(allSuggestions.some((s: any) => s.username === 'developer1')).toBe(false);
      expect(allSuggestions.some((s: any) => s.username === 'developer2')).toBe(true);
    });

    it('should include CODEOWNERS in suggestions when available', async () => {
      // Override the from mock to include CODEOWNERS data
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

        // For repositories table (getting repository ID)
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

        // For github_contributions table
        if (table === 'github_contributions') {
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

      // CODEOWNERS should get high priority (primary suggestions)
      expect(data.suggestions.primary.length).toBeGreaterThan(0);
      const primaryUsernames = data.suggestions.primary.map((s: any) => s.username);
      expect(primaryUsernames).toContain('codeowner1');
      expect(primaryUsernames).toContain('codeowner2');
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

        // For github_contributions table - return error
        if (table === 'github_contributions') {
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

        // For github_contributions table - empty data for file analysis tests
        if (table === 'github_contributions') {
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
