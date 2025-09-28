import { describe, it, expect, vi, beforeEach } from 'vitest';
import GitHubAPIService from './github-api.service';

// Mock Octokit to prevent real API calls
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => ({
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
  })),
}));

describe('GitHubAPIService', () => {
  let service: GitHubAPIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubAPIService();
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
      const result = (service as any).parseRateLimitHeaders(mockHeaders);

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

      const result = (service as any).parseRateLimitHeaders(mockHeaders);
      expect(result).toBeNull();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 status', () => {
      const error = { status: 429 } as any;
      const shouldRetry = (service as any).shouldRetry(error, 0, 3);
      expect(shouldRetry).toBe(true);
    });

    it('should retry on 5xx status', () => {
      const error = { status: 503 } as any;
      const shouldRetry = (service as any).shouldRetry(error, 0, 3);
      expect(shouldRetry).toBe(true);
    });

    it('should not retry on 4xx status except 429', () => {
      const error = { status: 404 } as any;
      const shouldRetry = (service as any).shouldRetry(error, 0, 3);
      expect(shouldRetry).toBe(false);
    });

    it('should not retry when max retries reached', () => {
      const error = { status: 503 } as any;
      const shouldRetry = (service as any).shouldRetry(error, 3, 3);
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

      const delay0 = (service as any).calculateDelay(0, config);
      const delay1 = (service as any).calculateDelay(1, config);
      const delay2 = (service as any).calculateDelay(2, config);

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

      const delay5 = (service as any).calculateDelay(5, config);
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
        delays.push((service as any).calculateDelay(1, config));
      }

      // With jitter, not all delays should be identical
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });
});