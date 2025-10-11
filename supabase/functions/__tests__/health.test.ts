import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Deno environment
globalThis.Deno = {
  env: {
    get: (key: string) => {
      const envMap: Record<string, string> = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        ENVIRONMENT: 'test',
      };
      return envMap[key];
    },
  },
} as any;

// Mock modules
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: vi.fn(),
}));

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({
  serve: vi.fn(),
}));

describe('Health Endpoint', () => {
  let mockSupabase: any;
  let handler: (req: Request) => Promise<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockReturnThis(),
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Import handler dynamically to get fresh instance
    vi.resetModules();
  });

  it('returns healthy status when all checks pass', async () => {
    // Mock successful database query
    mockSupabase.limit.mockResolvedValueOnce({
      data: { count: 100 },
      error: null,
    });

    // Mock successful system stats
    mockSupabase.limit.mockResolvedValueOnce({
      data: { database_size: '100MB' },
      error: null,
    });

    // Import the handler
    const healthModule = await import('../health/index.ts');
    const serveCallback = (healthModule as any).default || (globalThis as any).__healthHandler;

    const request = new Request('https://example.com/health');
    const response = await serveCallback(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('healthy');
    expect(data.checks.database.status).toBe('healthy');
    expect(data.checks.system.status).toBe('healthy');
    expect(data.metadata.service).toBe('contributor.info');
    expect(data.metadata.version).toBe('1.0.0');
    expect(data.metadata.environment).toBe('test');
  });

  it('returns unhealthy status when database check fails', async () => {
    // Mock database error
    mockSupabase.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection failed' },
    });

    // Mock successful system stats
    mockSupabase.limit.mockResolvedValueOnce({
      data: { database_size: '100MB' },
      error: null,
    });

    const request = new Request('https://example.com/health');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(true);
    expect(data.status).toBe('unhealthy');
    expect(data.checks.database.status).toBe('unhealthy');
    expect(data.checks.database.error).toBe('Database connection failed');
  });

  it('returns unhealthy when database latency is too high', async () => {
    // Mock slow database query
    mockSupabase.limit.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: { count: 100 },
                error: null,
              }),
            2500,
          )
        ),
    );

    const request = new Request('https://example.com/health');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.checks.database.latency).toBeGreaterThan(2000);
  });

  it('handles CORS preflight requests', async () => {
    const request = new Request('https://example.com/health', {
      method: 'OPTIONS',
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('handles unexpected errors gracefully', async () => {
    // Mock an unexpected error
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected error occurred');
    });

    const request = new Request('https://example.com/health');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.status).toBe('unhealthy');
    expect(data.error).toBe('Health check failed');
    expect(data.details).toBe('Unexpected error occurred');
  });
});
