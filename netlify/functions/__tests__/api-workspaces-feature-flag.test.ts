import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Context } from '@netlify/functions';
import handler from '../api-workspaces.mts';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: { id: 'new-workspace-id' }, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({
      data: 'generated-slug-123',
      error: null,
    }),
  })),
}));

describe('api-workspaces - Feature Flag Tests', () => {
  let mockRequest: Request;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment variables
    originalEnv = process.env;

    // Clear all environment variables for each test
    process.env = {};

    // Set up default request
    mockRequest = new Request('http://localhost:8888/.netlify/functions/api-workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        name: 'Test Workspace',
        description: 'Test description',
        visibility: 'public',
      }),
    });
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('workspace creation feature flag', () => {
    it('should allow workspace creation when feature flag is enabled with "true"', async () => {
      process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION = 'true';

      const response = await handler(mockRequest, {} as Context);

      // Should not return 503 Service Unavailable
      expect(response.status).not.toBe(503);
    });

    it('should allow workspace creation when feature flag is enabled with "1"', async () => {
      process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION = '1';

      const response = await handler(mockRequest, {} as Context);

      // Should not return 503 Service Unavailable
      expect(response.status).not.toBe(503);
    });

    it('should block workspace creation when feature flag is explicitly disabled', async () => {
      process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION = 'false';

      const response = await handler(mockRequest, {} as Context);
      const responseData = await response.json();

      expect(response.status).toBe(503);
      expect(responseData.error).toBe('Workspace creation is currently disabled');
      expect(responseData.code).toBe('FEATURE_DISABLED');
      expect(response.headers.get('Retry-After')).toBe('3600');
    });

    it('should block workspace creation when feature flag is not set (default behavior)', async () => {
      // Don't set the environment variable

      const response = await handler(mockRequest, {} as Context);
      const responseData = await response.json();

      expect(response.status).toBe(503);
      expect(responseData.error).toBe('Workspace creation is currently disabled');
      expect(responseData.code).toBe('FEATURE_DISABLED');
    });

    it('should block workspace creation with invalid flag values', async () => {
      process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION = 'maybe';

      const response = await handler(mockRequest, {} as Context);
      const responseData = await response.json();

      expect(response.status).toBe(503);
      expect(responseData.error).toBe('Workspace creation is currently disabled');
    });
  });

  describe('other HTTP methods should not be affected', () => {
    beforeEach(() => {
      process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION = 'false';
    });

    it('should allow GET requests when feature flag is disabled', async () => {
      const getRequest = new Request('http://localhost:8888/.netlify/functions/api-workspaces', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(getRequest, {} as Context);

      // Should not be blocked by feature flag (GET operations are always allowed)
      expect(response.status).not.toBe(503);
    });

    it('should allow PUT requests when feature flag is disabled', async () => {
      const putRequest = new Request(
        'http://localhost:8888/.netlify/functions/api-workspaces/workspace-id',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
          },
          body: JSON.stringify({
            name: 'Updated Workspace',
          }),
        }
      );

      const response = await handler(putRequest, {} as Context);

      // Should not be blocked by feature flag (editing existing workspaces is allowed)
      expect(response.status).not.toBe(503);
    });

    it('should allow DELETE requests when feature flag is disabled', async () => {
      const deleteRequest = new Request(
        'http://localhost:8888/.netlify/functions/api-workspaces/workspace-id',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer valid-token',
          },
        }
      );

      const response = await handler(deleteRequest, {} as Context);

      // Should not be blocked by feature flag (deleting existing workspaces is allowed)
      expect(response.status).not.toBe(503);
    });
  });

  describe('response format for disabled feature', () => {
    beforeEach(() => {
      process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION = 'false';
    });

    it('should return proper CORS headers', async () => {
      const response = await handler(mockRequest, {} as Context);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return structured error response', async () => {
      const response = await handler(mockRequest, {} as Context);
      const responseData = await response.json();

      expect(responseData).toHaveProperty('error');
      expect(responseData).toHaveProperty('code');
      expect(responseData).toHaveProperty('message');
      expect(responseData.code).toBe('FEATURE_DISABLED');
    });
  });
});
