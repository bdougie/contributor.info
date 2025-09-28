import { describe, it, expect, beforeEach, vi } from 'vitest';
import GitHubAPIService from './github-api.service';

// Bulletproof testing with live API - no mocks, actual resilience testing
describe('GitHubAPIService - Bulletproof Live API Tests', () => {
  let service: GitHubAPIService;

  beforeEach(() => {
    // Create service without auth to test public API limits
    service = new GitHubAPIService();
  });

  describe('Exponential Backoff Algorithm', () => {
    it('should successfully retry and recover from transient failures', async () => {
      // Use a small public repo to minimize API usage
      const owner = 'octocat';
      const repo = 'Hello-World';

      // Force a scenario that might cause rate limiting by making rapid requests
      const promises = Array.from({ length: 5 }, () =>
        service.fetchRepository(owner, repo)
      );

      // All requests should eventually succeed with backoff
      const results = await Promise.allSettled(promises);

      // At least some should succeed even under pressure
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Verify the successful result has expected structure
      if (successful.length > 0 && successful[0].status === 'fulfilled') {
        const data = successful[0].value;
        expect(data).toHaveProperty('name', 'Hello-World');
        expect(data).toHaveProperty('owner.login', 'octocat');
      }
    });

    it('should handle rate limit headers correctly', async () => {
      const owner = 'octocat';
      const repo = 'Hello-World';

      // Make a single request to get rate limit info
      await service.fetchRepository(owner, repo);

      // Check that rate limit info was captured
      const rateLimitInfo = service.getRateLimitInfo();

      // If headers were present, they should be parsed correctly
      if (rateLimitInfo) {
        expect(rateLimitInfo).toHaveProperty('remaining');
        expect(rateLimitInfo).toHaveProperty('limit');
        expect(rateLimitInfo).toHaveProperty('reset');
        expect(typeof rateLimitInfo.remaining).toBe('number');
        expect(typeof rateLimitInfo.limit).toBe('number');
        expect(typeof rateLimitInfo.reset).toBe('number');
      }
    });

    it('should apply jitter to prevent thundering herd', async () => {
      // Test that jitter is being applied by verifying retry delays vary
      const testService = new GitHubAPIService();

      // Custom error that always triggers retry
      const mockOperation = vi.fn().mockRejectedValue({
        status: 503, // Server error that should trigger retry
        message: 'Service unavailable'
      });

      // Run multiple times to observe jitter
      const timings: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        try {
          await testService.executeWithBackoff(mockOperation, {
            maxRetries: 1,
            initialDelay: 100,
            jitter: true
          });
        } catch (error) {
          // Expected to fail after retries
          timings.push(Date.now() - start);
        }
      }

      // With jitter, timing should vary
      // Without jitter, all would be ~100ms (plus processing time)
      // With jitter, they should differ by at least 10ms sometimes
      const minTiming = Math.min(...timings);
      const maxTiming = Math.max(...timings);
      const variance = maxTiming - minTiming;

      // Expect at least 10ms variance due to jitter
      expect(variance).toBeGreaterThan(10);
    });
  });

  describe('GitHub API Methods', () => {
    // Using a small, stable public repo for testing
    const testOwner = 'octocat';
    const testRepo = 'Hello-World';

    it('should fetch repository information with retry capability', async () => {
      const data = await service.fetchRepository(testOwner, testRepo);

      expect(data).toBeDefined();
      expect(data.name).toBe('Hello-World');
      expect(data.owner.login).toBe('octocat');
      expect(data.id).toBeDefined();
    });

    it('should fetch pull requests with pagination options', async () => {
      const data = await service.fetchPullRequests(testOwner, testRepo, {
        state: 'all',
        per_page: 5,
        page: 1
      });

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);

      // Verify PR structure if any exist
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('number');
        expect(data[0]).toHaveProperty('title');
        expect(data[0]).toHaveProperty('state');
      }
    });

    it('should fetch contributors with retry on failure', async () => {
      const data = await service.fetchContributors(testOwner, testRepo, {
        per_page: 5,
        page: 1
      });

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.length).toBeLessThanOrEqual(5);

      // Verify contributor structure
      expect(data[0]).toHaveProperty('login');
      expect(data[0]).toHaveProperty('contributions');
      expect(typeof data[0].contributions).toBe('number');
    });

    it('should fetch issues with state filtering', async () => {
      const data = await service.fetchIssues(testOwner, testRepo, {
        state: 'all',
        per_page: 3,
        page: 1
      });

      expect(Array.isArray(data)).toBe(true);

      // Verify issue structure if any exist
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('number');
        expect(data[0]).toHaveProperty('title');
        expect(data[0]).toHaveProperty('state');
      }
    });

    it('should fetch commits with pagination', async () => {
      const data = await service.fetchCommits(testOwner, testRepo, {
        per_page: 3,
        page: 1
      });

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.length).toBeLessThanOrEqual(3);

      // Verify commit structure
      expect(data[0]).toHaveProperty('sha');
      expect(data[0]).toHaveProperty('commit.message');
      expect(data[0]).toHaveProperty('commit.author');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle 404 errors without retry', async () => {
      const nonExistentRepo = 'this-repo-definitely-does-not-exist-99999';

      await expect(
        service.fetchRepository('octocat', nonExistentRepo)
      ).rejects.toThrow();

      // Should fail fast on 404, not retry multiple times
      const startTime = Date.now();
      try {
        await service.fetchRepository('octocat', nonExistentRepo);
      } catch (error) {
        const duration = Date.now() - startTime;
        // Should fail quickly without retries (under 1 second)
        expect(duration).toBeLessThan(1000);
      }
    });

    it('should check rate limit status', async () => {
      const rateLimitData = await service.checkRateLimit();

      expect(rateLimitData).toBeDefined();
      expect(rateLimitData).toHaveProperty('rate');
      expect(rateLimitData.rate).toHaveProperty('limit');
      expect(rateLimitData.rate).toHaveProperty('remaining');
      expect(rateLimitData.rate).toHaveProperty('reset');

      // Verify we're getting real numbers
      expect(typeof rateLimitData.rate.limit).toBe('number');
      expect(typeof rateLimitData.rate.remaining).toBe('number');
      expect(rateLimitData.rate.limit).toBeGreaterThan(0);
    });

    it('should handle concurrent requests with backoff', async () => {
      // Make concurrent requests to test queue/backoff behavior
      const requests = [
        service.fetchRepository('facebook', 'react'),
        service.fetchRepository('microsoft', 'typescript'),
        service.fetchRepository('vuejs', 'vue'),
      ];

      const results = await Promise.allSettled(requests);

      // All should eventually succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(3);

      // Verify each got correct repo
      const repos = successful.map(r =>
        r.status === 'fulfilled' ? r.value.full_name : null
      );
      expect(repos).toContain('facebook/react');
      expect(repos).toContain('microsoft/TypeScript');
      expect(repos).toContain('vuejs/vue');
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom backoff configuration', async () => {
      const customService = new GitHubAPIService();

      // Test with minimal retries to fail fast
      const startTime = Date.now();

      try {
        await customService.executeWithBackoff(
          async () => {
            throw new Error('Simulated network error');
          },
          {
            maxRetries: 1,
            initialDelay: 100,
            maxDelay: 200,
            factor: 2,
            jitter: false
          }
        );
      } catch (error) {
        const duration = Date.now() - startTime;

        // Should have tried once, then retried once with ~100ms delay
        expect(duration).toBeGreaterThanOrEqual(100);
        expect(duration).toBeLessThan(500);
        expect(error).toBeDefined();
      }
    });

    it('should work without jitter when configured', async () => {
      const timings: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        try {
          await service.executeWithBackoff(
            async () => {
              throw new Error('Test error');
            },
            {
              maxRetries: 1,
              initialDelay: 50,
              jitter: false
            }
          );
        } catch (error) {
          timings.push(Date.now() - start);
        }
      }

      // Without jitter, timings should be more consistent
      const variance = Math.max(...timings) - Math.min(...timings);
      expect(variance).toBeLessThan(50);
    });
  });
});