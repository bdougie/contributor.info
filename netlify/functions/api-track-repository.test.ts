import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './api-track-repository.mts';
import { getRateLimitKey } from './lib/rate-limiter.mts';

// Mock dependencies
const mockGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ request_count: 0 }),
        })),
        maybeSingle: vi.fn().mockResolvedValue({ request_count: 0 }),
      })),
      maybeSingle: vi.fn().mockResolvedValue({ request_count: 0 }),
    })),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock rate limiter
vi.mock('./lib/rate-limiter.mts', async () => {
  return {
    RateLimiter: vi.fn().mockImplementation(() => ({
      checkLimit: vi.fn().mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
      }),
    })),
    getRateLimitKey: vi.fn().mockImplementation((req, userId) => {
        if (userId) return `user:${userId}`;
        return 'ip:127.0.0.1';
    }),
    applyRateLimitHeaders: vi.fn((res) => res),
  };
});

// Mock fetch
global.fetch = vi.fn();

describe('api-track-repository handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.GITHUB_TOKEN = 'mock-github-token';

    // Mock GitHub API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        full_name: 'test-owner/test-repo',
        owner: { login: 'test-owner' },
        name: 'test-repo',
        private: false,
        // ... other fields optional for this test
      }),
    });
  });

  it('should validate authentication token when Authorization header is present', async () => {
    const req = new Request('https://example.com/api/track', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner: 'test-owner', repo: 'test-repo' }),
    });

    // Mock successful auth
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    await handler(req, {} as any);

    // Verify getUser was called with the token
    expect(mockGetUser).toHaveBeenCalledWith('valid-token');

    // Verify getRateLimitKey was called with the user ID
    expect(getRateLimitKey).toHaveBeenCalledWith(expect.anything(), 'user-123');
  });

  it('should fall back to unauthenticated if token is invalid', async () => {
    const req = new Request('https://example.com/api/track', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner: 'test-owner', repo: 'test-repo' }),
    });

    // Mock failed auth
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    await handler(req, {} as any);

    // Verify getUser was called
    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');

    // Verify getRateLimitKey was called with undefined (unauthenticated)
    expect(getRateLimitKey).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('should handle missing Authorization header as unauthenticated', async () => {
    const req = new Request('https://example.com/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner: 'test-owner', repo: 'test-repo' }),
    });

    await handler(req, {} as any);

    // getUser should NOT be called
    expect(mockGetUser).not.toHaveBeenCalled();

    // Verify getRateLimitKey was called with undefined
    expect(getRateLimitKey).toHaveBeenCalledWith(expect.anything(), undefined);
  });
});
