import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

// Mock the lib modules before importing the handler
vi.mock('../lib/api-key-clients', () => ({
  getUnkeyClient: vi.fn(),
  getSupabaseClients: vi.fn(),
  API_KEY_CORS_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  },
  hasUnkeyConfig: vi.fn(),
}));

vi.mock('../lib/server-tracking.mts', () => ({
  trackServerEvent: vi.fn().mockResolvedValue(undefined),
  captureServerException: vi.fn().mockResolvedValue(undefined),
}));

import { handler } from '../api-key-revoke';
import { getUnkeyClient, getSupabaseClients, hasUnkeyConfig } from '../lib/api-key-clients';

function createMockEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    rawUrl: 'https://example.com/.netlify/functions/api-key-revoke',
    rawQuery: '',
    path: '/.netlify/functions/api-key-revoke',
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer test-token',
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: JSON.stringify({ keyId: 'key-123' }),
    isBase64Encoded: false,
    ...overrides,
  };
}

const mockContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'api-key-revoke',
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

describe('api-key-revoke handler', () => {
  let mockUnkeyDelete: ReturnType<typeof vi.fn>;
  let mockSupabaseSelect: ReturnType<typeof vi.fn>;
  let mockSupabaseUpdate: ReturnType<typeof vi.fn>;
  let mockSupabaseGetUser: ReturnType<typeof vi.fn>;
  let mockMaybeSingle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Unkey mock
    mockUnkeyDelete = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getUnkeyClient).mockReturnValue({
      keys: {
        delete: mockUnkeyDelete,
      },
    } as unknown as ReturnType<typeof getUnkeyClient>);

    // Setup config check
    vi.mocked(hasUnkeyConfig).mockReturnValue({ hasRootKey: true, hasApiId: true });

    // Setup Supabase mock
    mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'db-id-1', unkey_key_id: 'key-123', name: 'Test Key' },
      error: null,
    });
    mockSupabaseSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    });
    mockSupabaseUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    vi.mocked(getSupabaseClients).mockReturnValue({
      admin: {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'api_keys') {
            return {
              select: mockSupabaseSelect,
              update: mockSupabaseUpdate,
            };
          }
          return {};
        }),
      },
      anon: {
        auth: {
          getUser: mockSupabaseGetUser,
        },
      },
    } as unknown as ReturnType<typeof getSupabaseClients>);
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

    it('should return 405 for non-POST requests', async () => {
      const event = createMockEvent({ httpMethod: 'GET' });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(405);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Configuration checks', () => {
    it('should return 503 when Unkey config is missing', async () => {
      vi.mocked(hasUnkeyConfig).mockReturnValue({ hasRootKey: false, hasApiId: false });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(503);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('API key service not configured');
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

  describe('Input validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({ body: 'invalid json' });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Invalid request body');
    });

    it('should return 400 when keyId is missing', async () => {
      const event = createMockEvent({ body: JSON.stringify({}) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Key ID is required');
    });

    it('should return 400 when keyId is not a string', async () => {
      const event = createMockEvent({ body: JSON.stringify({ keyId: 123 }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Key ID is required');
    });
  });

  describe('Key ownership verification', () => {
    it('should return 404 when key is not found', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(404);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('API key not found');
    });

    it('should return 404 when key belongs to another user', async () => {
      // This is handled by the query filtering by user_id
      // If no match is found, data will be null
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(404);
    });
  });

  describe('Successful key revocation', () => {
    it('should revoke a key successfully', async () => {
      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(200);
      const body = JSON.parse(result?.body || '{}');
      expect(body.success).toBe(true);
      expect(body.message).toBe('API key revoked successfully');
    });

    it('should call Unkey delete', async () => {
      const event = createMockEvent();
      await handler(event, mockContext);

      expect(mockUnkeyDelete).toHaveBeenCalledWith({ keyId: 'key-123' });
    });

    it('should still mark key as revoked even if Unkey delete fails', async () => {
      mockUnkeyDelete.mockResolvedValue({
        error: { code: 'NOT_FOUND', message: 'Key already deleted' },
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      // Should still succeed because we mark it as revoked in our DB
      expect(result?.statusCode).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should return 500 when database lookup fails', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Failed to revoke API key');
    });

    it('should return 500 when database update fails', async () => {
      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
    });

    it('should return 500 for unexpected errors', async () => {
      vi.mocked(getSupabaseClients).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Failed to revoke API key');
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
