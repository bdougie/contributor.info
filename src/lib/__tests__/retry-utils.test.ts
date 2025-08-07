import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  withRetry, 
  createRetryableFunction, 
  resetCircuitBreaker,
  getCircuitBreakerState,
  clearAllCircuitBreakers
} from '../retry-utils';

describe('retry-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllCircuitBreakers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt if no error', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        retryableErrors: new Set(['NetworkError']),
      });
      
      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(150);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ValidationError'));
      
      await expect(withRetry(fn, {
        maxRetries: 3,
        retryableErrors: new Set(['NetworkError']),
      })).rejects.toThrow('ValidationError');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: new Set(['NetworkError']),
        onRetry,
      });
      
      // First retry after ~100ms (with jitter)
      await vi.advanceTimersByTimeAsync(150);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
      
      // Second retry after ~200ms (with jitter)
      await vi.advanceTimersByTimeAsync(250);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('NetworkError'));
      
      const promise = withRetry(fn, {
        maxRetries: 2,
        initialDelay: 100,
        retryableErrors: new Set(['NetworkError']),
      }).catch(err => err); // Catch to prevent unhandled rejection
      
      // Advance through all retry attempts
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('NetworkError');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect max delay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 2000,
        backoffMultiplier: 10, // Would exceed maxDelay
        retryableErrors: new Set(['NetworkError']),
      });
      
      // Should not wait longer than maxDelay (2000ms + jitter)
      await vi.advanceTimersByTimeAsync(2500);
      
      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('NetworkError'));
      
      const attempts = [];
      
      // Try multiple times to trigger circuit breaker
      for (let i = 0; i < 7; i++) {
        try {
          await withRetry(fn, {
            maxRetries: 0,
            retryableErrors: new Set(['NetworkError']),
          }, 'test-circuit', {
            failureThreshold: 5,
          });
        } catch {
          attempts.push(i);
        }
      }
      
      // After 5 failures, circuit should be open
      expect(getCircuitBreakerState('test-circuit')).toBe('OPEN');
      
      // Subsequent calls should fail immediately
      await expect(withRetry(fn, {}, 'test-circuit')).rejects.toThrow('Circuit breaker is open');
      
      // Function should not be called after circuit opens
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should reset to half-open after timeout', async () => {
      const fn = vi.fn()
        .mockRejectedValue(new Error('NetworkError'));
      
      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await withRetry(fn, {
            maxRetries: 0,
            retryableErrors: new Set(['NetworkError']),
          }, 'test-circuit-2', {
            failureThreshold: 5,
            resetTimeout: 1000,
          });
        } catch {
          // Ignore errors
        }
      }
      
      expect(getCircuitBreakerState('test-circuit-2')).toBe('OPEN');
      
      // Advance time past reset timeout
      vi.advanceTimersByTime(1100);
      
      // Next call should be allowed (half-open state)
      fn.mockResolvedValue('success');
      const result = await withRetry(fn, {}, 'test-circuit-2');
      
      expect(result).toBe('success');
    });

    it('should close circuit after successful requests in half-open', async () => {
      const fn = vi.fn()
        .mockRejectedValue(new Error('NetworkError'));
      
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await withRetry(fn, {
            maxRetries: 0,
            retryableErrors: new Set(['NetworkError']),
          }, 'test-circuit-3', {
            failureThreshold: 5,
            resetTimeout: 1000,
            halfOpenRequests: 2,
          });
        } catch {
          // Ignore
        }
      }
      
      // Move to half-open
      vi.advanceTimersByTime(1100);
      
      // Successful requests in half-open
      fn.mockResolvedValue('success');
      await withRetry(fn, {}, 'test-circuit-3');
      await withRetry(fn, {}, 'test-circuit-3');
      
      // Circuit should be closed now
      expect(getCircuitBreakerState('test-circuit-3')).toBe('CLOSED');
    });

    it('should reset circuit breaker manually', async () => {
      // Set up a circuit breaker state
      const fn = vi.fn().mockRejectedValue(new Error('NetworkError'));
      
      // This will create and potentially trip the breaker
      await withRetry(fn, {
        maxRetries: 0,
        retryableErrors: new Set(['NetworkError']),
      }, 'test-reset', {
        failureThreshold: 1,
      }).catch(() => {});
      
      // Reset the circuit
      resetCircuitBreaker('test-reset');
      
      // State should be null or CLOSED after reset
      const state = getCircuitBreakerState('test-reset');
      expect(state === null || state === 'CLOSED').toBe(true);
    });
  });

  describe('createRetryableFunction', () => {
    it('should create a retryable version of a function', async () => {
      const originalFn = vi.fn()
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockResolvedValue('success');
      
      const retryableFn = createRetryableFunction(originalFn, {
        maxRetries: 3,
        initialDelay: 100,
        retryableErrors: new Set(['NetworkError']),
      });
      
      const promise = retryableFn();
      
      // Advance through retry
      await vi.advanceTimersByTimeAsync(150);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments correctly', async () => {
      const originalFn = vi.fn((a: number, b: string) => Promise.resolve(`${a}-${b}`));
      
      const retryableFn = createRetryableFunction(originalFn);
      
      const result = await retryableFn(42, 'test');
      
      expect(result).toBe('42-test');
      expect(originalFn).toHaveBeenCalledWith(42, 'test');
    });
  });

  describe('error detection', () => {
    it('should detect HTTP status codes in error messages', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Request failed with status 503'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        retryableErrors: new Set(['503']),
      });
      
      await vi.advanceTimersByTimeAsync(150);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should detect error by name', async () => {
      const error = new Error('Connection failed');
      error.name = 'NetworkError';
      
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        retryableErrors: new Set(['NetworkError']),
      });
      
      await vi.advanceTimersByTimeAsync(150);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should detect fetch response status', async () => {
      const fetchError = { status: 429, message: 'Rate limited' };
      
      const fn = vi.fn()
        .mockRejectedValueOnce(fetchError)
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        retryableErrors: new Set(['429']),
      });
      
      await vi.advanceTimersByTimeAsync(150);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});