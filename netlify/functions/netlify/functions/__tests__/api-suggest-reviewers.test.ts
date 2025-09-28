import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase before importing
vi.mock('../../../src/lib/supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

import { createSupabaseClient } from '../../../src/lib/supabase';
import handler from '../api-suggest-reviewers';

describe('Suggest Reviewers API Tests', () => {
  let mockSupabase: any;
  let mockFrom: any;

  beforeEach(() => {
    // Setup Supabase mocks with proper query chain
    const mockMaybeSingle = vi.fn();
    const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase = { from: mockFrom };

    (createSupabaseClient as any).mockReturnValue(mockSupabase);

    // Mock tracked repository
    mockMaybeSingle.mockResolvedValue({
      data: { id: 1, is_active: true },
      error: null,
    });

    // Mock environment variables
    process.env.GITHUB_TOKEN = 'test-github-token';

    // Reset fetch mock
    (global.fetch as any).mockReset();
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
      // Mock contribution data query
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

      // Override the from mock to return contributions query chain
      mockFrom.mockImplementation((table: string) => {
        if (table === 'github_contributions') {
          return { select: mockSelect };
        }
        // For tracked_repositories table
        const mockMaybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, is_active: true },
          error: null,
        });
        const mockEqRepo = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelectRepo = vi.fn().mockReturnValue({ eq: mockEqRepo });
        return { select: mockSelectRepo };
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
      // Mock CODEOWNERS fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: Buffer.from('src/components/ @codeowner1 @codeowner2').toString('base64'),
          path: '.github/CODEOWNERS',
        }),
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
      // Mock database error
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'github_contributions') {
          return { select: mockSelect };
        }
        // For tracked_repositories table
        const mockMaybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, is_active: true },
          error: null,
        });
        const mockEqRepo = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelectRepo = vi.fn().mockReturnValue({ eq: mockEqRepo });
        return { select: mockSelectRepo };
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
      // Mock empty contribution data for these tests
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'github_contributions') {
          return { select: mockSelect };
        }
        // For tracked_repositories table
        const mockMaybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, is_active: true },
          error: null,
        });
        const mockEqRepo = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelectRepo = vi.fn().mockReturnValue({ eq: mockEqRepo });
        return { select: mockSelectRepo };
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