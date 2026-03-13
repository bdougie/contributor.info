import { describe, it, expect, vi, beforeEach } from 'vitest';
import GitHubAPIService from './github-api.service';

/** Exposes private methods for testing without `any`. */
interface GitHubAPIServiceTestable {
  parseRateLimitHeaders(headers: Record<string, string | undefined>): {
    remaining: number;
    reset: number;
    limit: number;
    used: number;
  } | null;
  shouldRetry(error: { status?: number }, attempt: number, maxRetries: number): boolean;
  calculateDelay(
    attempt: number,
    config: { initialDelay: number; maxDelay: number; factor: number; jitter: boolean }
  ): number;
}

// Mock Octokit to prevent real API calls
vi.mock('@octokit/rest', () => {
  const OctokitMock = vi.fn(() => ({
    rest: {
      pulls: {
        list: vi.fn(),
        get: vi.fn(),
        listReviews: vi.fn(),
        listReviewComments: vi.fn(),
      },
      repos: {
        get: vi.fn(),
        listContributors: vi.fn(),
        listCommits: vi.fn(),
      },
      issues: {
        listForRepo: vi.fn(),
      },
      rateLimit: {
        get: vi.fn(),
      },
    },
  }));

  OctokitMock.plugin = vi.fn(() => OctokitMock);

  return {
    Octokit: OctokitMock,
  };
});

// Mock throttling plugin
vi.mock('@octokit/plugin-throttling', () => ({
  throttling: vi.fn(),
}));

describe('GitHubAPIService', () => {
  let service: GitHubAPIService;
  let testable: GitHubAPIServiceTestable;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubAPIService();
    testable = service as unknown as GitHubAPIServiceTestable;
  });

  describe('Configuration', () => {
    it('should initialize with default config', () => {
      expect(service).toBeDefined();
      expect(service.getRateLimitInfo()).toBeNull();
    });
  });

  describe('Rate Limit Parsing', () => {
    it('should parse rate limit headers correctly', () => {
      const mockHeaders = {
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': '1234567890',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-used': '1',
      };

      // Use private method through type assertion for testing
      const result = testable.parseRateLimitHeaders(mockHeaders);

      expect(result).toEqual({
        remaining: 4999,
        reset: 1234567890,
        limit: 5000,
        used: 1,
      });
    });

    it('should return null for incomplete headers', () => {
      const mockHeaders = {
        'x-ratelimit-remaining': '4999',
      };

      const result = testable.parseRateLimitHeaders(mockHeaders);
      expect(result).toBeNull();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 status', () => {
      const error = { status: 429 };
      const shouldRetry = testable.shouldRetry(error, 0, 3);
      expect(shouldRetry).toBe(true);
    });

    it('should retry on 5xx status', () => {
      const error = { status: 503 };
      const shouldRetry = testable.shouldRetry(error, 0, 3);
      expect(shouldRetry).toBe(true);
    });

    it('should not retry on 4xx status except 429', () => {
      const error = { status: 404 };
      const shouldRetry = testable.shouldRetry(error, 0, 3);
      expect(shouldRetry).toBe(false);
    });

    it('should not retry when max retries reached', () => {
      const error = { status: 503 };
      const shouldRetry = testable.shouldRetry(error, 3, 3);
      expect(shouldRetry).toBe(false);
    });
  });

  describe('Delay Calculation', () => {
    it('should calculate exponential delay without jitter', () => {
      const config = {
        initialDelay: 100,
        maxDelay: 1000,
        factor: 2,
        jitter: false,
      };

      const delay0 = testable.calculateDelay(0, config);
      const delay1 = testable.calculateDelay(1, config);
      const delay2 = testable.calculateDelay(2, config);

      expect(delay0).toBe(100);
      expect(delay1).toBe(200);
      expect(delay2).toBe(400);
    });

    it('should respect max delay', () => {
      const config = {
        initialDelay: 100,
        maxDelay: 300,
        factor: 2,
        jitter: false,
      };

      const delay5 = testable.calculateDelay(5, config);
      expect(delay5).toBe(300);
    });

    it('should add jitter when enabled', () => {
      const config = {
        initialDelay: 100,
        maxDelay: 1000,
        factor: 2,
        jitter: true,
      };

      const delays = [];
      for (let i = 0; i < 5; i++) {
        delays.push(testable.calculateDelay(1, config));
      }

      // With jitter, not all delays should be identical
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });
});
