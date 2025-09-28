import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase before importing
vi.mock('../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

import { createSupabaseClient } from '../../src/lib/supabase.js';
import handler from '../api-codeowners';

describe('CODEOWNERS API Database Tests', () => {
  let mockSupabase: any;
  let mockFrom: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup Supabase mocks
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    (createSupabaseClient as any).mockReturnValue(mockSupabase);
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
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });
  });

  describe('Database error handling', () => {
    it('should return 500 for database errors, not 404', async () => {
      // Mock repository query to return database error
      const mockRepositoryQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' }
                })
              })
            })
          })
        })
      };

      mockFrom.mockReturnValue(mockRepositoryQuery);

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Database error');
    });

    it('should return 404 for repository not found (not database error)', async () => {
      // Mock repository query to return no data (but no error)
      const mockRepositoryQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          })
        })
      };

      mockFrom.mockReturnValue(mockRepositoryQuery);

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.exists).toBe(false);
    });
  });

  describe('Database queries', () => {
    it('should query repositories table first', async () => {
      // Mock successful repository lookup
      const mockRepositoryQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'repo-123' },
                  error: null
                })
              })
            })
          })
        })
      };

      // Mock codeowners table query
      const mockCodeownersQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    content: '# CODEOWNERS\n/src/ @dev1 @dev2',
                    file_path: '.github/CODEOWNERS',
                    fetched_at: '2023-01-01T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          })
        })
      };

      // Setup from mock to return different queries based on table name
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'repositories') return mockRepositoryQuery;
        if (tableName === 'codeowners') return mockCodeownersQuery;
        throw new Error(`Unexpected table: ${tableName}`);
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.content).toBe('# CODEOWNERS\n/src/ @dev1 @dev2');
      expect(data.path).toBe('.github/CODEOWNERS');

      // Verify correct database queries were made
      expect(mockFrom).toHaveBeenCalledWith('repositories');
      expect(mockFrom).toHaveBeenCalledWith('codeowners');
    });

    it('should query codeowners table with correct repository ID', async () => {
      const repositoryId = 'test-repo-123';

      // Mock repository lookup
      const mockRepositoryQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: repositoryId },
                  error: null
                })
              })
            })
          })
        })
      };

      // Mock codeowners query
      const mockEqSpy = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const mockCodeownersQuery = {
        select: vi.fn().mockReturnValue({
          eq: mockEqSpy
        })
      };

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'repositories') return mockRepositoryQuery;
        if (tableName === 'codeowners') return mockCodeownersQuery;
        throw new Error(`Unexpected table: ${tableName}`);
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      await handler(request, {} as any);

      // Verify the codeowners query used the correct repository ID
      expect(mockEqSpy).toHaveBeenCalledWith('repository_id', repositoryId);
    });
  });

  describe('CORS security', () => {
    it('should not include Access-Control-Allow-Credentials header', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'OPTIONS',
      });

      const response = await handler(request, {} as any);

      // Should not have credentials header (security vulnerability when used with wildcard origin)
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});