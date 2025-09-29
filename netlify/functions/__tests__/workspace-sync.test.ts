import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../workspace-sync-simple';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { owner: 'test-owner', name: 'test-repo' },
                error: null,
              })
            ),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

describe('workspace-sync', () => {
  const mockContext = {} as HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
  });

  it('should handle OPTIONS request for CORS', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      body: null,
    } as HandlerEvent;

    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
  });

  it('should reject non-POST methods', async () => {
    const event = {
      httpMethod: 'GET',
      body: null,
    } as HandlerEvent;

    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(405);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Method not allowed');
  });

  it('should validate required repositoryIds', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ workspaceId: 'test-workspace' }),
    } as HandlerEvent;

    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('repositoryIds array is required');
  });

  it('should successfully sync repositories', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        repositoryIds: ['repo-1', 'repo-2'],
        workspaceId: 'test-workspace',
      }),
    } as HandlerEvent;

    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Sync requested for');
    expect(body.summary).toEqual({
      total: 2,
      successful: 2,
      failed: 0,
    });
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual({
      repositoryId: 'repo-1',
      status: 'success',
      repository: 'test-owner/test-repo',
    });
  });

  it('should enforce rate limiting', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        repositoryIds: ['repo-1'],
        workspaceId: 'rate-limited-workspace',
      }),
    } as HandlerEvent;

    // Make 10 requests to hit the rate limit
    for (let i = 0; i < 10; i++) {
      await handler(event, mockContext);
    }

    // 11th request should be rate limited
    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.message).toContain('Too many sync requests');
    expect(response.headers).toHaveProperty('X-RateLimit-Remaining', '0');
    expect(response.headers).toHaveProperty('Retry-After');
  });

  it('should work without workspaceId', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        repositoryIds: ['repo-1'],
      }),
    } as HandlerEvent;

    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Sync requested for');
  });

  it('should handle missing Supabase configuration', async () => {
    // Remove environment variables
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        repositoryIds: ['repo-1'],
      }),
    } as HandlerEvent;

    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Service configuration error');
  });
});
