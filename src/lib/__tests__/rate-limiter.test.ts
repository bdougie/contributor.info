/**
 * Rate limiter tests
 * Tests for the GraphQL request throttling functionality
 * Addresses issue #1260 - Batch/throttle GraphQL requests for linked PRs
 *
 * Following bulletproof testing guidelines - synchronous tests only
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter, graphqlRateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default values when no options provided', () => {
      const limiter = new RateLimiter();
      const stats = limiter.getStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeRequests).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });

    it('should accept custom options', () => {
      const limiter = new RateLimiter({
        maxConcurrent: 10,
        minDelay: 50,
        maxRetries: 5,
      });
      const stats = limiter.getStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeRequests).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return current queue statistics', () => {
      const limiter = new RateLimiter({ maxConcurrent: 2, minDelay: 10 });
      const stats = limiter.getStats();
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('activeRequests');
      expect(stats).toHaveProperty('isProcessing');
    });

    it('should show correct initial state', () => {
      const limiter = new RateLimiter();
      const stats = limiter.getStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeRequests).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });
  });

  describe('enqueue', () => {
    it('should accept a function and return a promise', () => {
      const limiter = new RateLimiter({ maxConcurrent: 10, minDelay: 0 });
      const result = limiter.enqueue(() => Promise.resolve('test'));
      expect(result).toBeInstanceOf(Promise);
    });

    it('should track queued items in stats', () => {
      const limiter = new RateLimiter({ maxConcurrent: 1, minDelay: 1000 });

      // Queue several slow tasks (they won't complete immediately)
      limiter.enqueue(() => new Promise(() => {})).catch(() => {});
      limiter.enqueue(() => new Promise(() => {})).catch(() => {});
      limiter.enqueue(() => new Promise(() => {})).catch(() => {});

      const stats = limiter.getStats();
      // At least some should be queued or processing
      expect(stats.queueLength + stats.activeRequests).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should empty the queue', () => {
      const limiter = new RateLimiter({ maxConcurrent: 1, minDelay: 1000 });

      // Queue several tasks
      limiter.enqueue(() => new Promise(() => {})).catch(() => {});
      limiter.enqueue(() => new Promise(() => {})).catch(() => {});
      limiter.enqueue(() => new Promise(() => {})).catch(() => {});

      // Clear the queue
      limiter.clear();

      const stats = limiter.getStats();
      expect(stats.queueLength).toBe(0);
    });
  });
});

describe('graphqlRateLimiter', () => {
  it('should be exported and defined', () => {
    expect(graphqlRateLimiter).toBeDefined();
  });

  it('should have stats method available', () => {
    const stats = graphqlRateLimiter.getStats();
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('queueLength');
    expect(stats).toHaveProperty('activeRequests');
    expect(stats).toHaveProperty('isProcessing');
  });

  it('should have enqueue method available', () => {
    expect(typeof graphqlRateLimiter.enqueue).toBe('function');
  });

  it('should have clear method available', () => {
    expect(typeof graphqlRateLimiter.clear).toBe('function');
  });
});
