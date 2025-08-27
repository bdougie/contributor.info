/**
 * Simplified retry-utils tests
 * Following bulletproof testing guidelines - no async/await
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resetCircuitBreaker,
  getCircuitBreakerState,
  clearAllCircuitBreakers,
} from '../retry-utils';

describe('retry-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCircuitBreakers();
  });

  describe('Circuit Breaker State Management', () => {
    it('should get circuit breaker state', () => {
      const state = getCircuitBreakerState('test-circuit');
      expect(state).toBe(null); // Initial state is null
    });

    it('should reset circuit breaker', () => {
      resetCircuitBreaker('test-circuit');
      const state = getCircuitBreakerState('test-circuit');
      expect(state).toBeDefined();
    });

    it('should clear all circuit breakers', () => {
      resetCircuitBreaker('circuit1');
      resetCircuitBreaker('circuit2');
      clearAllCircuitBreakers();

      const state1 = getCircuitBreakerState('circuit1');
      const state2 = getCircuitBreakerState('circuit2');

      expect(state1).toBe(null);
      expect(state2).toBe(null);
    });
  });
});
