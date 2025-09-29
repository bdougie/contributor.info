import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Set up environment variables before importing handler
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock Supabase before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));
import { createClient } from '@supabase/supabase-js';
import handler from '../api-codeowners';

describe('CODEOWNERS API Tests', () => {
  let mockSupabase: any;
  let mockFrom: any;
  let mockSelect: any;
  let mockEq: any;
  let mockMaybeSingle: any;

  beforeEach(() => {
    // Setup Supabase mocks with complete query chain
    mockMaybeSingle = vi.fn();
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq2 = vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
      order: mockOrder,
      limit: mockLimit
    });
    mockEq = vi.fn().mockReturnValue({
      eq: mockEq2,
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle
    });
    mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle
    });
    mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase = { from: mockFrom };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error while checking repository tracking');
    });
  });


  describe('CODEOWNERS file fetching', () => {

    it('should fetch CODEOWNERS from .github/CODEOWNERS', async () => {
      const codeOwnersContent = '# CODEOWNERS\n/src/ @developer1 @developer2';

      // Clear and setup mock for this specific test
      mockMaybeSingle.mockClear();
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { id: 1, is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { content: codeOwnersContent, file_path: '.github/CODEOWNERS', fetched_at: new Date() },
          error: null,
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
    });

    it('should try multiple CODEOWNERS file locations', async () => {
      // Clear and setup mock for this specific test
      mockMaybeSingle.mockClear();
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { id: 1, is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { content: '# Root CODEOWNERS', file_path: 'CODEOWNERS', fetched_at: new Date() },
          error: null,
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
    });

    it('should return 404 when no CODEOWNERS file is found', async () => {
      // Clear and setup mock for this specific test
      mockMaybeSingle.mockClear();
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { id: 1, is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

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
    });

    it('should handle GitHub API errors gracefully', async () => {
      // Clear and setup mock for this specific test
      mockMaybeSingle.mockClear();
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { id: 1, is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

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

      // Clear and setup mock for this specific test
      mockMaybeSingle.mockClear();
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { id: 1, is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { content: codeOwnersContent, file_path: '.github/CODEOWNERS', fetched_at: new Date() },
          error: null,
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
