import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Set up environment variables before importing handler
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Mock Supabase before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));
import { createClient } from '@supabase/supabase-js';
import handler from '../api-codeowners';
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

describe('CODEOWNERS API Database Tests', () => {
  let mockSupabase: MockSupabaseClient;
  let mockFrom: vi.MockedFunction<(table: string) => unknown>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup Supabase mocks
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    (createClient as vi.MockedFunction<typeof createClient>).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'OPTIONS',
      });

      const response = await handler(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });
  });

  describe('Database error handling', () => {
    it('should return 500 for database errors, not 404', async () => {
      // Mock repository query to return database error (simplified chain)
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockRepositoryQuery = { select: mockSelect };

      mockFrom.mockReturnValue(mockRepositoryQuery);

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Database error');
    });

    it('should return 404 for repository not found (not database error)', async () => {
      // Mock repository query to return no data (but no error)
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockRepositoryQuery = { select: mockSelect };

      mockFrom.mockReturnValue(mockRepositoryQuery);

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Repository not found');
    });
  });

  describe('Database queries', () => {
    it('should query repositories table first', async () => {
      // Track the number of calls to determine which query is which
      let callCount = 0;

      // Mock repository validation (first query)
      const mockValidationMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 1, tracking_enabled: true },
        error: null,
      });
      const mockValidationEq2 = vi.fn().mockReturnValue({ maybeSingle: mockValidationMaybeSingle });
      const mockValidationEq = vi.fn().mockReturnValue({ eq: mockValidationEq2 });
      const mockValidationSelect = vi.fn().mockReturnValue({ eq: mockValidationEq });
      const mockValidationQuery = { select: mockValidationSelect };

      // Mock repository lookup (second query)
      const mockRepositoryMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 'repo-123' },
        error: null,
      });
      const mockRepositoryLimit = vi
        .fn()
        .mockReturnValue({ maybeSingle: mockRepositoryMaybeSingle });
      const mockRepositoryEq2 = vi.fn().mockReturnValue({ limit: mockRepositoryLimit });
      const mockRepositoryEq = vi.fn().mockReturnValue({ eq: mockRepositoryEq2 });
      const mockRepositorySelect = vi.fn().mockReturnValue({ eq: mockRepositoryEq });
      const mockRepositoryQuery = { select: mockRepositorySelect };

      // Mock codeowners table query
      const mockCodeownersMaybeSingle = vi.fn().mockResolvedValue({
        data: {
          content: '# CODEOWNERS\n/src/ @dev1 @dev2',
          file_path: '.github/CODEOWNERS',
          fetched_at: '2023-01-01T00:00:00Z',
        },
        error: null,
      });
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockCodeownersMaybeSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockCodeownersEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockCodeownersSelect = vi.fn().mockReturnValue({ eq: mockCodeownersEq });
      const mockCodeownersQuery = { select: mockCodeownersSelect };

      // Setup from mock to return different queries based on table name and call order
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'tracked_repositories') {
          callCount++;
          // First call is validation, second is repository lookup
          return callCount === 1 ? mockValidationQuery : mockRepositoryQuery;
        }
        if (tableName === 'codeowners') return mockCodeownersQuery;
        throw new Error(`Unexpected table: ${tableName}`);
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      const response = await handler(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.content).toBe('# CODEOWNERS\n/src/ @dev1 @dev2');
      expect(data.path).toBe('.github/CODEOWNERS');

      // Verify correct database queries were made
      expect(mockFrom).toHaveBeenCalledWith('tracked_repositories');
      expect(mockFrom).toHaveBeenCalledWith('codeowners');
    });

    it('should query codeowners table with correct repository ID', async () => {
      const repositoryId = 'test-repo-123';
      let callCount = 0;

      // Mock repository validation (first query)
      const mockValidationMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 1, tracking_enabled: true },
        error: null,
      });
      const mockValidationEq2 = vi.fn().mockReturnValue({ maybeSingle: mockValidationMaybeSingle });
      const mockValidationEq = vi.fn().mockReturnValue({ eq: mockValidationEq2 });
      const mockValidationSelect = vi.fn().mockReturnValue({ eq: mockValidationEq });
      const mockValidationQuery = { select: mockValidationSelect };

      // Mock repository lookup (second query)
      const mockRepositoryMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: repositoryId },
        error: null,
      });
      const mockRepositoryLimit = vi
        .fn()
        .mockReturnValue({ maybeSingle: mockRepositoryMaybeSingle });
      const mockRepositoryEq2 = vi.fn().mockReturnValue({ limit: mockRepositoryLimit });
      const mockRepositoryEq = vi.fn().mockReturnValue({ eq: mockRepositoryEq2 });
      const mockRepositorySelect = vi.fn().mockReturnValue({ eq: mockRepositoryEq });
      const mockRepositoryQuery = { select: mockRepositorySelect };

      // Mock codeowners query
      const mockCodeownersMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockCodeownersMaybeSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEqSpy = vi.fn().mockReturnValue({ order: mockOrder });
      const mockCodeownersSelect = vi.fn().mockReturnValue({ eq: mockEqSpy });
      const mockCodeownersQuery = { select: mockCodeownersSelect };

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'tracked_repositories') {
          callCount++;
          // First call is validation, second is repository lookup
          return callCount === 1 ? mockValidationQuery : mockRepositoryQuery;
        }
        if (tableName === 'codeowners') return mockCodeownersQuery;
        throw new Error(`Unexpected table: ${tableName}`);
      });

      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'GET',
      });

      await handler(request, mockContext);

      // Verify the codeowners query used the correct repository ID
      expect(mockEqSpy).toHaveBeenCalledWith('repository_id', repositoryId);
    });
  });

  describe('CORS security', () => {
    it('should not include Access-Control-Allow-Credentials header', async () => {
      const request = new Request('https://test.com/api/repos/owner/repo/codeowners', {
        method: 'OPTIONS',
      });

      const response = await handler(request, mockContext);

      // Should not have credentials header (security vulnerability when used with wildcard origin)
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
