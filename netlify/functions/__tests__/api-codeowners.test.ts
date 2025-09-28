import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase before importing
vi.mock('@/lib/supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

import { createSupabaseClient } from '@/lib/supabase';
import handler from '../api-codeowners';

describe('CODEOWNERS API Tests', () => {
  let mockSupabase: any;
  let mockFrom: any;
  let mockSelect: any;
  let mockEq: any;
  let mockMaybeSingle: any;

  beforeEach(() => {
    // Setup Supabase mocks with proper chain
    mockMaybeSingle = vi.fn();
    const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
    mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase = { from: mockFrom };

    (createSupabaseClient as any).mockReturnValue(mockSupabase);

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
      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'OPTIONS',
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Method validation', () => {
    it('should reject non-GET requests', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'POST',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('URL path validation', () => {
    it('should reject invalid API path format', async () => {
      const request = new Request('https://test.com/invalid/path', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid API path format');
    });
  });

  describe('Repository tracking validation', () => {
    it('should return 404 for untracked repository', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Repository not found');
      expect(data.trackingUrl).toBe('https://contributor.info/owner/repo');
    });

    it('should return 404 for inactive repository tracking', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, is_active: false },
        error: null,
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.trackingUrl).toBe('https://contributor.info/owner/repo');
    });

    it('should handle database errors gracefully', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Repository not found');
    });
  });

  describe('GitHub token validation', () => {
    it('should return 500 when GitHub token is missing', async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.VITE_GITHUB_TOKEN;

      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, is_active: true },
        error: null,
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('GitHub token not configured');
    });
  });

  describe('CODEOWNERS file fetching', () => {
    beforeEach(() => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, is_active: true },
        error: null,
      });
    });

    it('should fetch CODEOWNERS from .github/CODEOWNERS', async () => {
      const codeOwnersContent = '# CODEOWNERS\n/src/ @developer1 @developer2';
      const base64Content = Buffer.from(codeOwnersContent).toString('base64');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: base64Content,
          path: '.github/CODEOWNERS',
        }),
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.content).toBe(codeOwnersContent);
      expect(data.path).toBe('.github/CODEOWNERS');
      expect(data.repository).toBe('owner/repo');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/contents/.github/CODEOWNERS',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-github-token',
          }),
        })
      );
    });

    it('should try multiple CODEOWNERS file locations', async () => {
      // First call fails (no .github/CODEOWNERS)
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 404 })
        // Second call succeeds (root CODEOWNERS)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            content: Buffer.from('# Root CODEOWNERS').toString('base64'),
            path: 'CODEOWNERS',
          }),
        });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.content).toBe('# Root CODEOWNERS');
      expect(data.path).toBe('CODEOWNERS');

      // Should have tried .github/CODEOWNERS first, then CODEOWNERS
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return 404 when no CODEOWNERS file is found', async () => {
      // All CODEOWNERS file locations fail
      (global.fetch as any)
        .mockResolvedValue({ ok: false, status: 404 });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.exists).toBe(false);
      expect(data.message).toBe('No CODEOWNERS file found in repository');
      expect(data.checkedPaths).toEqual([
        '.github/CODEOWNERS',
        'CODEOWNERS',
        'docs/CODEOWNERS',
        '.gitlab/CODEOWNERS',
      ]);

      // Should have tried all possible locations
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should handle GitHub API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.exists).toBe(false);
    });

    it('should include proper cache headers for successful responses', async () => {
      const codeOwnersContent = '# CODEOWNERS\n/src/ @developer1';
      const base64Content = Buffer.from(codeOwnersContent).toString('base64');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: base64Content,
          path: '.github/CODEOWNERS',
        }),
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Input validation', () => {
    it('should handle invalid repository names', async () => {
      const request = new Request('https://test.com/api/repos/invalid@name/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Repository not found');
    });

    it('should handle repository names that are too long', async () => {
      const longName = 'a'.repeat(101);
      const request = new Request(`https://test.com/api/repos/owner/${longName}/codeowners`, {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Repository not found');
    });
  });
});
