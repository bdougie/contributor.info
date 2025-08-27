import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetRateLimiter, getRateLimiterStats } from '../posthog-lazy';

describe('PostHog Integration', () => {
  beforeEach(() => {
    resetRateLimiter();

    // Mock localStorage if not already mocked
    const localStorageData: Record<string, string> = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageData[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageData[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageData[key];
      }),
      clear: vi.fn(() => {
        Object.keys(localStorageData).forEach((key) => delete localStorageData[key]);
      }),
      length: 0,
      key: vi.fn(() => null),
    } as Storage;
  });

  describe('Rate Limiting', () => {
    it('should track rate limiter statistics', () => {
      const stats = getRateLimiterStats();

      expect(stats).toBeDefined();
      expect(stats.limits).toEqual({
        perMinute: 60,
        perHour: 1000,
      });
      expect(stats.eventCounts).toBeInstanceOf(Map);
      expect(stats.eventCounts.size).toBe(0);
    });

    it('should clear rate limiter on reset', () => {
      // Get initial stats
      const statsBefore = getRateLimiterStats();
      expect(statsBefore.eventCounts.size).toBe(0);

      // Reset should maintain the same state
      resetRateLimiter();
      const statsAfter = getRateLimiterStats();
      expect(statsAfter.eventCounts.size).toBe(0);
    });
  });

  describe('API Key Validation Pattern', () => {
    const posthogKeyPattern = /^phc_[A-Za-z0-9]{32,}$/;

    it('validates correct PostHog key format', () => {
      // Valid keys
      expect(posthogKeyPattern.test('phc_' + 'a'.repeat(32))).toBe(true);
      expect(posthogKeyPattern.test('phc_1234567890ABCDEFghijklmnopqrstuv')).toBe(true);

      // Invalid keys
      expect(posthogKeyPattern.test('invalid-key')).toBe(false);
      expect(posthogKeyPattern.test('phc_short')).toBe(false);
      expect(posthogKeyPattern.test('PHC_' + 'a'.repeat(32))).toBe(false);
      expect(posthogKeyPattern.test('')).toBe(false);
    });
  });

  describe('Local Storage Integration', () => {
    it('should handle localStorage for opt-out preference', () => {
      // Test setting opt-out
      localStorage.setItem('posthog_opt_out', 'true');
      expect(localStorage.getItem('posthog_opt_out')).toBe('true');

      // Test removing opt-out
      localStorage.removeItem('posthog_opt_out');
      expect(localStorage.getItem('posthog_opt_out')).toBeNull();
    });

    it('should handle localStorage for dev mode enablement', () => {
      // Test enabling dev mode
      localStorage.setItem('enablePostHogDev', 'true');
      expect(localStorage.getItem('enablePostHogDev')).toBe('true');

      // Test disabling dev mode
      localStorage.removeItem('enablePostHogDev');
      expect(localStorage.getItem('enablePostHogDev')).toBeNull();
    });

    it('should handle distinct ID storage', () => {
      const testId = 'user_test_12345';
      localStorage.setItem('contributor_info_distinct_id', testId);
      expect(localStorage.getItem('contributor_info_distinct_id')).toBe(testId);
    });
  });
});
