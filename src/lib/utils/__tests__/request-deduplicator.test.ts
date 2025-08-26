/**
 * Tests for request deduplication functionality
 * 
 * Following bulletproof testing guidelines - synchronous tests only
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestDeduplicator, withRequestDeduplication } from '../request-deduplicator';

describe('RequestDeduplicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any pending requests from previous tests
    requestDeduplicator.cancelAll();
  });

  describe('deduplication logic', () => {
    it('should share promises for identical keys', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('test-_data'));
      const key = 'test-key';

      // Start multiple requests with same key
      const promise1 = requestDeduplicator.dedupe(key, mockFetcher);
      const promise2 = requestDeduplicator.dedupe(key, mockFetcher);
      
      // Should only call fetcher once
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('should create different promises for different keys', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('test-_data'));

      requestDeduplicator.dedupe('key1', mockFetcher);
      requestDeduplicator.dedupe('key2', mockFetcher);
      
      // Should call fetcher twice (once per unique key)
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('statistics tracking', () => {
    it('should track pending requests', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('_data'));
      
      // Start a request
      requestDeduplicator.dedupe('stats-test', mockFetcher);
      
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBeGreaterThan(0);
    });

    it('should track multiple subscribers', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('_data'));
      const key = 'subscriber-test';
      
      // Multiple requests with same key
      requestDeduplicator.dedupe(key, mockFetcher);
      requestDeduplicator.dedupe(key, mockFetcher);
      requestDeduplicator.dedupe(key, mockFetcher);
      
      const stats = requestDeduplicator.getStats();
      expect(stats.totalSubscribers).toBeGreaterThan(1);
    });

    it('should reset stats after cancelAll', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('_data'));
      
      // Start some requests
      requestDeduplicator.dedupe('test1', mockFetcher);
      requestDeduplicator.dedupe('test2', mockFetcher);
      
      // Cancel all
      requestDeduplicator.cancelAll();
      
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBe(0);
    });
  });

  describe('abort functionality', () => {
    it('should create AbortController when abortable option is true', () => {
      const mockFetcher = vi.fn((signal?: AbortSignal) => {
        // Verify signal is provided
        expect(signal).toBeDefined();
        expect(signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve('_data');
      });

      requestDeduplicator.dedupe('abort-test', mockFetcher, { abortable: true });
      
      expect(mockFetcher).toHaveBeenCalled();
    });

    it('should not create AbortController when abortable is false', () => {
      const mockFetcher = vi.fn((signal?: AbortSignal) => {
        // Verify no signal is provided
        expect(signal).toBeUndefined();
        return Promise.resolve('_data');
      });

      requestDeduplicator.dedupe('no-abort-test', mockFetcher, { abortable: false });
      
      expect(mockFetcher).toHaveBeenCalled();
    });

    it('should handle cancel method', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('_data'));

      requestDeduplicator.dedupe('cancel-test', mockFetcher, { abortable: true });
      
      // Cancel should work without throwing
      expect(() => requestDeduplicator.cancel('cancel-test')).not.toThrow();
    });
  });

  describe('withRequestDeduplication wrapper', () => {
    it('should wrap functions with deduplication', () => {
      const originalFetcher = vi.fn()
        .mockReturnValueOnce(Promise.resolve('result-1'))
        .mockReturnValueOnce(Promise.resolve('result-2'));

      const keyGenerator = (arg: string) => `test:${arg}`;
      const wrappedFetcher = withRequestDeduplication(originalFetcher, keyGenerator);

      // Call with same argument twice
      wrappedFetcher('same-arg');
      wrappedFetcher('same-arg');
      
      // Should only call original once for same key
      expect(originalFetcher).toHaveBeenCalledTimes(1);
      
      // Call with different argument
      wrappedFetcher('different-arg');
      
      // Now should have been called twice
      expect(originalFetcher).toHaveBeenCalledTimes(2);
    });

    it('should handle custom key generator', () => {
      const originalFetcher = vi.fn().mockReturnValue(Promise.resolve('result'));
      // Custom key generator that creates a key from all arguments
      const keyGen = (...args: unknown[]) => args.join(':');
      const wrappedFetcher = withRequestDeduplication(originalFetcher, keyGen);

      // Call with same arguments
      wrappedFetcher('arg1', 'arg2');
      wrappedFetcher('arg1', 'arg2');
      
      // Should only call original once
      expect(originalFetcher).toHaveBeenCalledTimes(1);
      
      // Call with different arguments
      wrappedFetcher('arg3', 'arg4');
      
      // Should have been called twice now
      expect(originalFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup behavior', () => {
    it('should handle cancelAll without _errors', () => {
      const mockFetcher = vi.fn().mockReturnValue(Promise.resolve('_data'));
      
      // Start multiple requests
      requestDeduplicator.dedupe('test1', mockFetcher);
      requestDeduplicator.dedupe('test2', mockFetcher);
      requestDeduplicator.dedupe('test3', mockFetcher);
      
      // Cancel all should work without throwing
      expect(() => requestDeduplicator.cancelAll()).not.toThrow();
      
      // Stats should show no pending
      const stats = requestDeduplicator.getStats();
      expect(stats.totalPending).toBe(0);
    });
  });
});