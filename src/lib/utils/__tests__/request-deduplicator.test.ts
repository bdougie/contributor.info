/**
 * Tests for request deduplication functionality
 * 
 * Covers concurrent request scenarios, proper cleanup, and integration patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestDeduplicator, RequestDeduplicator, withRequestDeduplication } from '../request-deduplicator';

// Mock timer functions
vi.useFakeTimers();

describe('RequestDeduplicator', () => {
  beforeEach(() => {
    // Clear any pending requests
    requestDeduplicator.cancelAll();
  });

  afterEach(() => {
    vi.clearAllTimers();
    requestDeduplicator.cancelAll();
  });

  describe('basic deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      const mockFetcher = vi.fn().mockResolvedValue('test-data');
      const key = 'test-key';

      // Start multiple concurrent requests
      const promises = [
        requestDeduplicator.dedupe(key, mockFetcher),
        requestDeduplicator.dedupe(key, mockFetcher),
        requestDeduplicator.dedupe(key, mockFetcher),
      ];

      // Wait for all to complete
      const results = await Promise.all(promises);

      // Should only call fetcher once
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      
      // All should return the same result
      expect(results).toEqual(['test-data', 'test-data', 'test-data']);
    });

    it('should not deduplicate requests after TTL expires', async () => {
      const mockFetcher = vi.fn()
        .mockResolvedValueOnce('first-result')
        .mockResolvedValueOnce('second-result');
      
      const key = 'test-key';
      const ttl = 1000; // 1 second

      // First request
      const first = await requestDeduplicator.dedupe(key, mockFetcher, { ttl });
      expect(first).toBe('first-result');

      // Advance time beyond TTL
      vi.advanceTimersByTime(ttl + 100);

      // Second request should not be deduplicated
      const second = await requestDeduplicator.dedupe(key, mockFetcher, { ttl });
      expect(second).toBe('second-result');

      // Should have called fetcher twice
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });

    it('should handle request failures properly', async () => {
      const error = new Error('Request failed');
      const mockFetcher = vi.fn().mockRejectedValue(error);
      const key = 'test-key';

      // First request should fail
      await expect(requestDeduplicator.dedupe(key, mockFetcher)).rejects.toThrow('Request failed');

      // Second request should also call fetcher (failed requests are not cached)
      await expect(requestDeduplicator.dedupe(key, mockFetcher)).rejects.toThrow('Request failed');

      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('abort functionality', () => {
    it('should cancel requests when abort signal is triggered', async () => {
      const mockFetcher = vi.fn().mockImplementation(
        (signal?: AbortSignal) => 
          new Promise((resolve, reject) => {
            if (signal?.aborted) {
              reject(new Error('Aborted'));
              return;
            }
            signal?.addEventListener('abort', () => reject(new Error('Aborted')));
            setTimeout(resolve, 1000, 'success');
          })
      );

      const key = 'test-key';
      const promise = requestDeduplicator.dedupe(key, mockFetcher, { abortable: true });

      // Cancel the request
      requestDeduplicator.cancel(key);

      // Should reject with abort error
      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should cancel all requests', async () => {
      const mockFetcher = vi.fn().mockImplementation(
        (signal?: AbortSignal) =>
          new Promise((resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('Aborted')));
            setTimeout(resolve, 1000, 'success');
          })
      );

      const promises = [
        requestDeduplicator.dedupe('key1', mockFetcher, { abortable: true }),
        requestDeduplicator.dedupe('key2', mockFetcher, { abortable: true }),
        requestDeduplicator.dedupe('key3', mockFetcher, { abortable: true }),
      ];

      // Cancel all requests
      requestDeduplicator.cancelAll();

      // All should be aborted
      await Promise.allSettled(promises);
      
      // Verify stats show no pending requests
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBe(0);
    });
  });

  describe('key generation', () => {
    it('should generate repository keys correctly', () => {
      const key = RequestDeduplicator.generateKey.repository('owner', 'repo', 'param1', 'param2');
      expect(key).toBe('repo:owner/repo:param1:param2');
    });

    it('should generate user keys correctly', () => {
      const key = RequestDeduplicator.generateKey.user('username', 'param1');
      expect(key).toBe('user:username:param1');
    });

    it('should generate progressive stage keys correctly', () => {
      const key = RequestDeduplicator.generateKey.progressiveStage(
        'critical', 
        'owner', 
        'repo', 
        '30', 
        true
      );
      expect(key).toBe('progressive:critical:owner/repo:30:true');
    });
  });

  describe('statistics and monitoring', () => {
    it('should track request statistics', async () => {
      const slowFetcher = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100, 'data'))
      );

      // Start multiple requests
      const promises = [
        requestDeduplicator.dedupe('key1', slowFetcher),
        requestDeduplicator.dedupe('key2', slowFetcher),
        requestDeduplicator.dedupe('key1', slowFetcher), // Duplicate of first
      ];

      // Check stats before completion
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBe(2); // Only 2 unique keys
      expect(stats.totalSubscribers).toBe(3); // 3 total subscriptions

      // Complete all requests
      vi.advanceTimersByTime(100);
      await Promise.all(promises);

      // Stats should show no pending requests after completion
      const finalStats = requestDeduplicator.getStats();
      expect(finalStats.totalPending).toBe(0);
      expect(finalStats.totalSubscribers).toBe(0);
    });
  });

  describe('withRequestDeduplication wrapper', () => {
    it('should wrap functions with deduplication', async () => {
      const originalFetcher = vi.fn()
        .mockResolvedValueOnce('result-1')
        .mockResolvedValueOnce('result-2');

      const keyGenerator = (arg: string) => `test:${arg}`;
      const wrappedFetcher = withRequestDeduplication(originalFetcher, keyGenerator);

      // Concurrent calls with same argument
      const promises = [
        wrappedFetcher('same-arg'),
        wrappedFetcher('same-arg'),
        wrappedFetcher('different-arg'),
      ];

      const results = await Promise.all(promises);

      // Should call original function twice (once per unique key)
      expect(originalFetcher).toHaveBeenCalledTimes(2);
      
      // First two should be same result, third should be different
      expect(results[0]).toBe(results[1]);
      expect(results[2]).toBe('result-2');
    });
  });

  describe('cleanup behavior', () => {
    it('should clean up completed requests', async () => {
      const fastFetcher = vi.fn().mockResolvedValue('quick-data');

      // Make a request and wait for completion
      await requestDeduplicator.dedupe('cleanup-test', fastFetcher);

      // Stats should show no pending requests after completion
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBe(0);
    });

    it('should handle multiple subscribers correctly', async () => {
      let resolveCount = 0;
      const slowFetcher = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolveCount++;
            resolve(`data-${resolveCount}`);
          }, 100);
        });
      });

      const key = 'multi-subscriber-test';
      
      // Start first request
      const promise1 = requestDeduplicator.dedupe(key, slowFetcher);
      
      // Start second request immediately (should share the same promise)
      const promise2 = requestDeduplicator.dedupe(key, slowFetcher);

      // Verify we have 1 pending request with 2 subscribers
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBe(1);
      expect(stats.totalSubscribers).toBe(2);

      vi.advanceTimersByTime(100);
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result
      expect(result1).toBe(result2);
      expect(result1).toBe('data-1');
      
      // Should only have called the fetcher once
      expect(slowFetcher).toHaveBeenCalledTimes(1);
    });
  });
});