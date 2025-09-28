import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from '../rate-limiter';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabase);

    rateLimiter = new RateLimiter('https://test.supabase.co', 'test-key', {
      maxRequests: 10,
      windowMs: 60000,
      keyPrefix: 'test',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkLimit', () => {
    it('should allow first request', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        }),
      };

      const mockUpsert = {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'rate_limits') {
          return mockQuery.select.mock.calls.length === 0 ? mockQuery : mockUpsert;
        }
        return null;
      });

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(mockUpsert.upsert).toHaveBeenCalled();
    });

    it('should track multiple requests in same window', async () => {
      const now = Date.now();
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            request_count: 5,
            window_start: new Date(now - 30000).toISOString(),
            last_request: new Date(now - 1000).toISOString(),
          },
          error: null,
        }),
      };

      const mockUpsert = {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'rate_limits') {
          return mockQuery.select.mock.calls.length === 0 ? mockQuery : mockUpsert;
        }
        return null;
      });

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6
    });

    it('should block when limit exceeded', async () => {
      const now = Date.now();
      const windowStart = now - 30000;

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            request_count: 10,
            window_start: new Date(windowStart).toISOString(),
            last_request: new Date(now - 1000).toISOString(),
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(30);
    });

    it('should reset counter for new window', async () => {
      const now = Date.now();
      const oldWindowStart = now - 120000; // 2 minutes ago

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            request_count: 10,
            window_start: new Date(oldWindowStart).toISOString(),
            last_request: new Date(oldWindowStart + 30000).toISOString(),
          },
          error: null,
        }),
      };

      const mockUpsert = {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'rate_limits') {
          return mockQuery.select.mock.calls.length === 0 ? mockQuery : mockUpsert;
        }
        return null;
      });

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // New window, so 10 - 1
    });

    it('should allow requests on database error', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });
  });

  describe('reset', () => {
    it('should delete rate limit record', async () => {
      const mockDelete = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockDelete);

      await rateLimiter.reset('user-123');

      expect(mockDelete.delete).toHaveBeenCalled();
      expect(mockDelete.eq).toHaveBeenCalledWith('key', 'test:user-123');
    });

    it('should handle delete errors gracefully', async () => {
      const mockDelete = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockRejectedValue(new Error('Delete failed')),
      };

      mockSupabase.from.mockReturnValue(mockDelete);

      // Should not throw
      await expect(rateLimiter.reset('user-123')).resolves.toBeUndefined();
    });
  });
});

describe('getRateLimitKey', () => {
  it('should use user ID when available', () => {
    const req = new Request('https://example.com/api/test');
    const key = getRateLimitKey(req, 'user-123');

    expect(key).toBe('user:user-123');
  });

  it('should use IP from x-forwarded-for header', () => {
    const req = new Request('https://example.com/api/test', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    });
    const key = getRateLimitKey(req);

    expect(key).toBe('ip:192.168.1.1');
  });

  it('should handle missing IP', () => {
    const req = new Request('https://example.com/api/test');
    const key = getRateLimitKey(req);

    expect(key).toBe('ip:unknown');
  });
});

describe('applyRateLimitHeaders', () => {
  it('should add rate limit headers to response', () => {
    const originalResponse = new Response('OK', { status: 200 });
    const rateLimitResult = {
      allowed: true,
      remaining: 5,
      resetTime: Date.now() + 30000,
    };

    const response = applyRateLimitHeaders(originalResponse, rateLimitResult);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('6');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('5');
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('should add Retry-After header when rate limited', () => {
    const originalResponse = new Response('Too Many Requests', { status: 429 });
    const rateLimitResult = {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
      retryAfter: 30,
    };

    const response = applyRateLimitHeaders(originalResponse, rateLimitResult);

    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('should preserve original response properties', () => {
    const body = JSON.stringify({ data: 'test' });
    const originalResponse = new Response(body, {
      status: 201,
      statusText: 'Created',
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'value',
      },
    });

    const rateLimitResult = {
      allowed: true,
      remaining: 5,
      resetTime: Date.now() + 30000,
    };

    const response = applyRateLimitHeaders(originalResponse, rateLimitResult);

    expect(response.status).toBe(201);
    expect(response.statusText).toBe('Created');
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Custom-Header')).toBe('value');
  });
});
