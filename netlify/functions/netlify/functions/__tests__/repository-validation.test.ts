import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase before importing
vi.mock('../../../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

import { createSupabaseClient } from '../../../../src/lib/supabase.js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from '../lib/repository-validation';

interface MockSupabaseClient {
  from: vi.MockedFunction<(table: string) => unknown>;
}

describe('Repository Validation Tests', () => {
  let mockSupabase: MockSupabaseClient;
  let mockFrom: vi.MockedFunction<(table: string) => unknown>;
  let mockSelect: vi.MockedFunction<() => unknown>;
  let mockEq: vi.MockedFunction<(column: string, value: unknown) => unknown>;
  let mockEq2: vi.MockedFunction<(column: string, value: unknown) => unknown>;
  let mockMaybeSingle: vi.MockedFunction<() => Promise<unknown>>;

  beforeEach(() => {
    // Setup Supabase mocks with proper query chain
    mockMaybeSingle = vi.fn();
    mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
    mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase = { from: mockFrom };

    (createSupabaseClient as vi.MockedFunction<typeof createSupabaseClient>).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createSupabaseClient>
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRepository', () => {
    it('should reject missing owner', async () => {
      const result = await validateRepository('', 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe('Missing owner or repo parameter');
    });

    it('should reject missing repo', async () => {
      const result = await validateRepository('owner', '');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe('Missing owner or repo parameter');
    });

    it('should reject invalid repository name format', async () => {
      const result = await validateRepository('owner@invalid', 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe(
        'Invalid repository format. Names can only contain letters, numbers, dots, underscores, and hyphens'
      );
    });

    it('should reject repository names that are too long', async () => {
      const longOwner = 'a'.repeat(40);
      const result = await validateRepository(longOwner, 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe('Repository or organization name is too long');
    });

    it('should reject repo names that are too long', async () => {
      const longRepo = 'a'.repeat(101);
      const result = await validateRepository('owner', longRepo);

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe('Repository or organization name is too long');
    });

    it('should handle database errors', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      const result = await validateRepository('owner', 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe('Database error while checking repository tracking');
    });

    it('should return not tracked for untracked repository', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await validateRepository('owner', 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(true);
      expect(result.error).toBe(
        'Repository owner/repo is not tracked. Please track it first at https://contributor.info/owner/repo'
      );
      expect(result.trackingUrl).toBe('https://contributor.info/owner/repo');
    });

    it('should return not tracked for inactive repository', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, is_active: false },
        error: null,
      });

      const result = await validateRepository('owner', 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(true);
      expect(result.error).toBe(
        'Repository owner/repo tracking is inactive. Please reactivate it at https://contributor.info/owner/repo'
      );
      expect(result.trackingUrl).toBe('https://contributor.info/owner/repo');
    });

    it('should return tracked for active tracked repository', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, tracking_enabled: true },
        error: null,
      });

      const result = await validateRepository('owner', 'repo');

      expect(result.isTracked).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle unexpected errors', async () => {
      mockMaybeSingle.mockRejectedValue(new Error('Unexpected error'));

      const result = await validateRepository('owner', 'repo');

      expect(result.isTracked).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe('Internal error while validating repository');
    });

    it('should normalize repository names to lowercase', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, tracking_enabled: true },
        error: null,
      });

      const result = await validateRepository('OWNER', 'REPO');

      // Verify the function was called and worked correctly
      expect(result.isTracked).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('tracked_repositories');
      expect(mockSelect).toHaveBeenCalledWith('id, tracking_enabled');

      // Assert that Supabase receives lowercase values
      expect(mockEq).toHaveBeenCalledWith('organization_name', 'owner');
      expect(mockEq2).toHaveBeenCalledWith('repository_name', 'repo');
    });
  });

  describe('createNotFoundResponse', () => {
    it('should create proper 404 response', async () => {
      const response = createNotFoundResponse('owner', 'repo');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

      expect(data.error).toBe('Repository not found');
      expect(data.message).toBe('Repository owner/repo is not being tracked');
      expect(data.trackingUrl).toBe('https://contributor.info/owner/repo');
      expect(data.action).toBe('Please visit the tracking URL to start tracking this repository');
    });

    it('should use custom tracking URL when provided', async () => {
      const customUrl = 'https://custom.com/track';
      const response = createNotFoundResponse('owner', 'repo', customUrl);
      const data = await response.json();

      expect(data.trackingUrl).toBe(customUrl);
    });
  });

  describe('createErrorResponse', () => {
    it('should create proper error response with default status', async () => {
      const response = createErrorResponse('Test error');
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

      expect(data.error).toBe('Test error');
      expect(data.success).toBe(false);
    });

    it('should create proper error response with custom status', async () => {
      const response = createErrorResponse('Server error', 500);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Server error');
      expect(data.success).toBe(false);
    });
  });

  describe('CORS_HEADERS', () => {
    it('should include proper CORS headers', () => {
      expect(CORS_HEADERS).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
    });
  });

  describe('Input sanitization', () => {
    it('should allow valid repository names', async () => {
      const validNames = [
        ['owner', 'repo'],
        ['my-org', 'my-repo'],
        ['org_name', 'repo.name'],
        ['123org', 'repo123'],
        ['a', 'b'], // minimum length
      ];

      mockMaybeSingle.mockResolvedValue({
        data: { id: 1, tracking_enabled: true },
        error: null,
      });

      for (const [owner, repo] of validNames) {
        const result = await validateRepository(owner, repo);
        expect(result.isTracked).toBe(true);
      }
    });

    it('should reject invalid characters', async () => {
      const invalidNames = [
        ['owner@', 'repo'],
        ['owner', 'repo#'],
        ['owner!', 'repo'],
        ['owner', 'repo$'],
        ['owner%', 'repo'],
        ['owner', 'repo^'],
      ];

      for (const [owner, repo] of invalidNames) {
        const result = await validateRepository(owner, repo);
        expect(result.isTracked).toBe(false);
        expect(result.error).toContain('Invalid repository format');
      }
    });
  });
});
