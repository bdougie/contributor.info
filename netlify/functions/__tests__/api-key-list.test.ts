import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

// Mock the lib modules before importing the handler
vi.mock('../lib/api-key-clients', () => ({
  getSupabaseWithAuth: vi.fn(),
  API_KEY_CORS_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  },
  API_KEY_VALIDATION: {
    MAX_KEY_NAME_LENGTH: 100,
    VALID_NAME_PATTERN: /^[a-zA-Z0-9\s\-_.]+$/,
    MAX_EXPIRY_DAYS: 365,
    MAX_KEYS_PER_USER: 50,
  },
}));

import { handler } from '../api-key-list';
import { getSupabaseWithAuth } from '../lib/api-key-clients';

function createMockEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    rawUrl: 'https://example.com/.netlify/functions/api-key-list',
    rawQuery: '',
    path: '/.netlify/functions/api-key-list',
    httpMethod: 'GET',
    headers: {
      authorization: 'Bearer test-token',
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...overrides,
  };
}

const mockContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'api-key-list',
  functionVersion: '1',
  invokedFunctionArn: '',
  memoryLimitInMB: '128',
  awsRequestId: '',
  logGroupName: '',
  logStreamName: '',
  getRemainingTimeInMillis: () => 5000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('api-key-list handler', () => {
  let mockSupabaseGetUser: ReturnType<typeof vi.fn>;
  let mockSupabaseSelect: ReturnType<typeof vi.fn>;
  let mockSupabaseEq: ReturnType<typeof vi.fn>;
  let mockSupabaseIs: ReturnType<typeof vi.fn>;
  let mockSupabaseOrder: ReturnType<typeof vi.fn>;
  let mockSupabaseLimit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Build the query chain from the end backwards
    mockSupabaseLimit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    mockSupabaseOrder = vi.fn().mockReturnValue({ limit: mockSupabaseLimit });
    mockSupabaseIs = vi.fn().mockReturnValue({ order: mockSupabaseOrder });
    mockSupabaseEq = vi.fn().mockReturnValue({ is: mockSupabaseIs });
    mockSupabaseSelect = vi.fn().mockReturnValue({ eq: mockSupabaseEq });
    mockSupabaseGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    vi.mocked(getSupabaseWithAuth).mockReturnValue({
      auth: {
        getUser: mockSupabaseGetUser,
      },
      from: vi.fn().mockReturnValue({
        select: mockSupabaseSelect,
      }),
    } as unknown as ReturnType<typeof getSupabaseWithAuth>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('HTTP method handling', () => {
    it('should return 200 for OPTIONS request', async () => {
      const event = createMockEvent({ httpMethod: 'OPTIONS' });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(200);
    });

    it('should return 405 for non-GET requests', async () => {
      const event = createMockEvent({ httpMethod: 'POST' });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(405);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Authentication', () => {
    it('should return 401 when authorization header is missing', async () => {
      const event = createMockEvent({ headers: {} });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(401);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Missing authorization header');
    });

    it('should return 401 when user authentication fails', async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(401);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Successful key listing', () => {
    it('should return empty array when user has no keys', async () => {
      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(200);
      const body = JSON.parse(result?.body || '{}');
      expect(body.keys).toEqual([]);
    });

    it('should return user keys correctly mapped', async () => {
      const mockKeys = [
        {
          id: 'db-id-1',
          unkey_key_id: 'key-123',
          name: 'Production Key',
          prefix: 'ck_live',
          last_four: 'abcd',
          created_at: '2024-01-01T00:00:00Z',
          last_used_at: '2024-01-15T00:00:00Z',
          expires_at: null,
        },
        {
          id: 'db-id-2',
          unkey_key_id: 'key-456',
          name: 'Dev Key',
          prefix: 'ck_live',
          last_four: 'efgh',
          created_at: '2024-01-02T00:00:00Z',
          last_used_at: null,
          expires_at: '2024-06-01T00:00:00Z',
        },
      ];

      mockSupabaseLimit.mockResolvedValue({
        data: mockKeys,
        error: null,
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(200);
      const body = JSON.parse(result?.body || '{}');
      expect(body.keys).toHaveLength(2);
      expect(body.keys[0]).toEqual({
        id: 'db-id-1',
        keyId: 'key-123',
        name: 'Production Key',
        prefix: 'ck_live',
        lastFour: 'abcd',
        createdAt: '2024-01-01T00:00:00Z',
        lastUsedAt: '2024-01-15T00:00:00Z',
        expiresAt: null,
      });
      expect(body.keys[1]).toEqual({
        id: 'db-id-2',
        keyId: 'key-456',
        name: 'Dev Key',
        prefix: 'ck_live',
        lastFour: 'efgh',
        createdAt: '2024-01-02T00:00:00Z',
        lastUsedAt: null,
        expiresAt: '2024-06-01T00:00:00Z',
      });
    });

    it('should apply pagination limit', async () => {
      const event = createMockEvent();
      await handler(event, mockContext);

      expect(mockSupabaseLimit).toHaveBeenCalledWith(50);
    });

    it('should order by created_at descending', async () => {
      const event = createMockEvent();
      await handler(event, mockContext);

      expect(mockSupabaseOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should only fetch non-revoked keys', async () => {
      const event = createMockEvent();
      await handler(event, mockContext);

      expect(mockSupabaseIs).toHaveBeenCalledWith('revoked_at', null);
    });
  });

  describe('Error handling', () => {
    it('should return 500 when database query fails', async () => {
      mockSupabaseLimit.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Failed to list API keys');
    });

    it('should return 500 for unexpected errors', async () => {
      vi.mocked(getSupabaseWithAuth).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Failed to list API keys');
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in response', async () => {
      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result?.headers?.['Content-Type']).toBe('application/json');
    });
  });
});
