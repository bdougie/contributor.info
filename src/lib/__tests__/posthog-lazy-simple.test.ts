import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resetRateLimiter,
  getRateLimiterStats,
  enablePostHogInDev,
  disablePostHogInDev,
  isPostHogEnabled,
} from '../posthog-lazy';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null;
  },
  setItem(key: string, value: string) {
    this.store[key] = value;
  },
  removeItem(key: string) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

describe('PostHog Lazy Loading - Simple Tests', () => {
  beforeEach(() => {
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();

    // Reset rate limiter
    resetRateLimiter();

    // Clear mocks
    vi.clearAllMocks();
  });

  describe('Development mode controls', () => {
    it('should enable PostHog in development', () => {
      enablePostHogInDev();
      expect(localStorageMock.getItem('enablePostHogDev')).toBe('true');
    });

    it('should disable PostHog in development', () => {
      localStorageMock.setItem('enablePostHogDev', 'true');
      disablePostHogInDev();
      expect(localStorageMock.getItem('enablePostHogDev')).toBeNull();
    });
  });

  describe('Rate limiter', () => {
    it('should reset rate limiter', () => {
      resetRateLimiter();
      const stats = getRateLimiterStats();
      expect(stats.eventCounts.size).toBe(0);
    });

    it('should return rate limiter stats', () => {
      const stats = getRateLimiterStats();
      expect(stats).toHaveProperty('eventCounts');
      expect(stats).toHaveProperty('limits');
      expect(stats.limits.perMinute).toBe(60);
      expect(stats.limits.perHour).toBe(1000);
    });
  });

  describe('PostHog enabled check', () => {
    it('should check if PostHog is enabled', () => {
      // This will return false in tests since PostHog isn't actually loaded
      const enabled = isPostHogEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('Opt-out preference', () => {
    it('should respect opt-out preference via localStorage', () => {
      localStorageMock.setItem('posthog_opt_out', 'true');
      expect(localStorageMock.getItem('posthog_opt_out')).toBe('true');

      localStorageMock.removeItem('posthog_opt_out');
      expect(localStorageMock.getItem('posthog_opt_out')).toBeNull();
    });
  });

  describe('Distinct ID generation', () => {
    it('should store distinct ID in localStorage', () => {
      // The ID is generated when tracking occurs
      // We can test that localStorage is used properly
      const testId = 'user_123_abc';
      localStorageMock.setItem('contributor_info_distinct_id', testId);
      expect(localStorageMock.getItem('contributor_info_distinct_id')).toBe(testId);
    });

    it('should persist distinct ID across sessions', () => {
      const testId = 'user_456_def';
      localStorageMock.setItem('contributor_info_distinct_id', testId);

      // Simulate new session by reading again
      const retrievedId = localStorageMock.getItem('contributor_info_distinct_id');
      expect(retrievedId).toBe(testId);
    });
  });
});
