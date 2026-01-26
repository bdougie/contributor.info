import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

// Mock the lib modules before importing the handler
vi.mock('../lib/api-key-clients', () => ({
  getUnkeyClient: vi.fn(),
  getUnkeyApiId: vi.fn(),
  getSupabaseClients: vi.fn(),
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
  hasUnkeyConfig: vi.fn(),
  hasSupabaseConfig: vi.fn(),
}));

vi.mock('../lib/server-tracking.mts', () => ({
  trackServerEvent: vi.fn().mockResolvedValue(undefined),
  captureServerException: vi.fn().mockResolvedValue(undefined),
}));

import { handler } from '../api-key-create';
import {
  getUnkeyClient,
  getUnkeyApiId,
  getSupabaseClients,
  hasUnkeyConfig,
  hasSupabaseConfig,
} from '../lib/api-key-clients';

function createMockEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    rawUrl: 'https://example.com/.netlify/functions/api-key-create',
    rawQuery: '',
    path: '/.netlify/functions/api-key-create',
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer test-token',
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: JSON.stringify({ name: 'Test Key' }),
    isBase64Encoded: false,
    ...overrides,
  };
}

const mockContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'api-key-create',
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

describe('api-key-create handler', () => {
  let mockUnkeyCreate: ReturnType<typeof vi.fn>;
  let mockUnkeyDelete: ReturnType<typeof vi.fn>;
  let mockSupabaseInsert: ReturnType<typeof vi.fn>;
  let mockSupabaseGetUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Unkey mock
    mockUnkeyCreate = vi.fn();
    mockUnkeyDelete = vi.fn();
    vi.mocked(getUnkeyClient).mockReturnValue({
      keys: {
        create: mockUnkeyCreate,
        delete: mockUnkeyDelete,
      },
    } as ReturnType<typeof getUnkeyClient>);
    vi.mocked(getUnkeyApiId).mockReturnValue('test-api-id');

    // Setup Supabase mock
    mockSupabaseInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    vi.mocked(getSupabaseClients).mockReturnValue({
      admin: {
        from: vi.fn().mockReturnValue({
          insert: mockSupabaseInsert,
        }),
      },
      anon: {
        auth: {
          getUser: mockSupabaseGetUser,
        },
      },
    } as unknown as ReturnType<typeof getSupabaseClients>);

    // Setup config checks
    vi.mocked(hasUnkeyConfig).mockReturnValue({ hasRootKey: true, hasApiId: true });
    vi.mocked(hasSupabaseConfig).mockReturnValue({
      hasUrl: true,
      hasServiceKey: true,
      hasAnonKey: true,
    });
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

    it('should return 503 when Supabase config is missing', async () => {
      vi.mocked(hasSupabaseConfig).mockReturnValue({
        hasUrl: false,
        hasServiceKey: false,
        hasAnonKey: false,
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(503);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Database service not configured');
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

    it('should return 400 when key name is missing', async () => {
      const event = createMockEvent({ body: JSON.stringify({}) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Key name is required');
    });

    it('should return 400 when key name is empty', async () => {
      const event = createMockEvent({ body: JSON.stringify({ name: '   ' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Key name is required');
    });

    it('should return 400 when key name is too long', async () => {
      const longName = 'a'.repeat(101);
      const event = createMockEvent({ body: JSON.stringify({ name: longName }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toContain('too long');
    });

    it('should return 400 when key name contains invalid characters', async () => {
      const event = createMockEvent({ body: JSON.stringify({ name: 'key@name!' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toContain('invalid characters');
    });

    it('should return 400 when expiresInDays is not a positive number', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ name: 'Test Key', expiresInDays: -5 }),
      });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Expiry days must be a positive number');
    });

    it('should return 400 when expiresInDays exceeds maximum', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ name: 'Test Key', expiresInDays: 400 }),
      });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(400);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toContain('cannot exceed 365 days');
    });
  });

  describe('Successful key creation', () => {
    beforeEach(() => {
      mockUnkeyCreate.mockResolvedValue({
        result: {
          keyId: 'key-123',
          key: 'ck_live_abc123xyz789',
        },
        error: null,
      });
    });

    it('should create a key successfully', async () => {
      const event = createMockEvent({ body: JSON.stringify({ name: 'My API Key' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(201);
      const body = JSON.parse(result?.body || '{}');
      expect(body.keyId).toBe('key-123');
      expect(body.key).toBe('ck_live_abc123xyz789');
      expect(body.name).toBe('My API Key');
      expect(body.prefix).toBe('ck_live');
      expect(body.lastFour).toBe('z789');
    });

    it('should create a key with expiration', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ name: 'Expiring Key', expiresInDays: 30 }),
      });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(201);
      const body = JSON.parse(result?.body || '{}');
      expect(body.expiresAt).toBeTruthy();
    });

    it('should NOT include email in Unkey metadata (PII protection)', async () => {
      const event = createMockEvent({ body: JSON.stringify({ name: 'Test Key' }) });
      await handler(event, mockContext);

      expect(mockUnkeyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.not.objectContaining({ email: expect.anything() }),
        })
      );
      expect(mockUnkeyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ userId: 'user-123' }),
        })
      );
    });

    it('should trim key name whitespace', async () => {
      const event = createMockEvent({ body: JSON.stringify({ name: '  My Key  ' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(201);
      const body = JSON.parse(result?.body || '{}');
      expect(body.name).toBe('My Key');
    });
  });

  describe('Error handling', () => {
    it('should return 500 when Unkey creation fails', async () => {
      mockUnkeyCreate.mockResolvedValue({
        result: null,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });

      const event = createMockEvent({ body: JSON.stringify({ name: 'Test Key' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Failed to create API key with provider');
    });

    it('should cleanup Unkey key when database insert fails', async () => {
      mockUnkeyCreate.mockResolvedValue({
        result: { keyId: 'key-123', key: 'ck_live_abc123xyz789' },
        error: null,
      });
      mockSupabaseInsert.mockResolvedValue({
        error: { code: 'DB_ERROR', message: 'Insert failed' },
      });
      mockUnkeyDelete.mockResolvedValue({ error: null });

      const event = createMockEvent({ body: JSON.stringify({ name: 'Test Key' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      expect(mockUnkeyDelete).toHaveBeenCalledWith({ keyId: 'key-123' });
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toBe('Failed to store API key metadata');
    });

    it('should report orphaned key when both DB and cleanup fail', async () => {
      mockUnkeyCreate.mockResolvedValue({
        result: { keyId: 'key-123', key: 'ck_live_abc123xyz789' },
        error: null,
      });
      mockSupabaseInsert.mockResolvedValue({ error: { code: 'DB_ERROR' } });
      mockUnkeyDelete.mockResolvedValue({ error: { code: 'CLEANUP_FAILED' } });

      const event = createMockEvent({ body: JSON.stringify({ name: 'Test Key' }) });
      const result = await handler(event, mockContext);

      expect(result?.statusCode).toBe(500);
      const body = JSON.parse(result?.body || '{}');
      expect(body.error).toContain('cleanup failed');
      expect(body.orphanedKeyId).toBe('key-123');
    });
  });

  describe('Valid key name patterns', () => {
    beforeEach(() => {
      mockUnkeyCreate.mockResolvedValue({
        result: { keyId: 'key-123', key: 'ck_live_abc123xyz789' },
        error: null,
      });
    });

    const validNames = [
      'My Key',
      'my-key',
      'my_key',
      'my.key',
      'Key123',
      'Production Key - v2',
      'CI_SERVER_2024',
    ];

    validNames.forEach((name) => {
      it(`should accept valid key name: "${name}"`, async () => {
        const event = createMockEvent({ body: JSON.stringify({ name }) });
        const result = await handler(event, mockContext);

        expect(result?.statusCode).toBe(201);
      });
    });

    const invalidNames = ['key@name', 'key#name', 'key$name', 'key!name', 'key*name', 'key/name'];

    invalidNames.forEach((name) => {
      it(`should reject invalid key name: "${name}"`, async () => {
        const event = createMockEvent({ body: JSON.stringify({ name }) });
        const result = await handler(event, mockContext);

        expect(result?.statusCode).toBe(400);
      });
    });
  });
});
