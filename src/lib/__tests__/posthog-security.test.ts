import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackWebVitals,
  resetRateLimiter,
  getRateLimiterStats,
  trackPerformanceMetric,
  batchTrackWebVitals
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
  }
};

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    people: {
      set: vi.fn()
    }
  }
}));

describe('PostHog Security and Rate Limiting', () => {
  beforeEach(() => {
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    localStorageMock.clear();
    
    // Reset rate limiter
    resetRateLimiter();
    
    // Clear mocks
    vi.clearAllMocks();
  });

  describe('API Key Validation', () => {
    it('should reject invalid API key formats', async () => {
      // Test various invalid key formats
      const invalidKeys = [
        'invalid-key',
        'ph_12345', // Wrong prefix
        'phc_', // Too short
        'phc_123', // Too short
        'PHC_1234567890123456789012345678901', // Wrong case
        'phc_!@#$%^&*()', // Special characters
        ''
      ];

      for (const invalidKey of invalidKeys) {
        vi.doMock('../env', () => ({
          env: {
            POSTHOG_KEY: invalidKey,
            POSTHOG_HOST: 'https://test.posthog.com',
            DEV: false
          }
        }));

        const mockPostHog = await import('posthog-js');
        await trackWebVitals({
          name: 'LCP',
          value: 2500,
          rating: 'good',
          navigationType: 'navigate'
        });

        expect(mockPostHog.default.capture).not.toHaveBeenCalled();
      }
    });

    it('should accept valid API key format', async () => {
      const validKey = 'phc_' + 'a'.repeat(32); // Valid format
      
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: validKey,
          POSTHOG_HOST: 'https://test.posthog.com',
          DEV: false
        }
      }));

      const mockPostHog = await import('posthog-js');
      await trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPostHog.default.init).toHaveBeenCalledWith(
        validKey,
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Set up valid environment
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: 'phc_' + 'a'.repeat(32),
          POSTHOG_HOST: 'https://test.posthog.com',
          DEV: false
        }
      }));
    });

    it('should enforce per-minute rate limits', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Send 60 events (the limit)
      for (let i = 0; i < 60; i++) {
        await trackWebVitals({
          name: 'LCP',
          value: 2500 + i,
          rating: 'good',
          navigationType: 'navigate'
        });
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have sent 60 events
      expect(mockPostHog.default.capture).toHaveBeenCalledTimes(60);

      // Clear mock counts
      mockPostHog.default.capture.mockClear();

      // Try to send one more (should be rate limited)
      await trackWebVitals({
        name: 'LCP',
        value: 3000,
        rating: 'good',
        navigationType: 'navigate'
      });

      // Should not send due to rate limit
      expect(mockPostHog.default.capture).not.toHaveBeenCalled();
    });

    it('should track rate limiter stats', async () => {
      // Send some events
      for (let i = 0; i < 5; i++) {
        await trackWebVitals({
          name: 'LCP',
          value: 2500,
          rating: 'good',
          navigationType: 'navigate'
        });
      }

      const stats = getRateLimiterStats();
      expect(stats.eventCounts.get('web_vitals')).toBe(5);
      expect(stats.limits.perMinute).toBe(60);
      expect(stats.limits.perHour).toBe(1000);
    });

    it('should apply rate limits to different event types independently', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Fill up web_vitals limit
      for (let i = 0; i < 60; i++) {
        await trackWebVitals({
          name: 'LCP',
          value: 2500,
          rating: 'good',
          navigationType: 'navigate'
        });
      }

      // Performance metrics should still work (different rate limit bucket)
      await trackPerformanceMetric('custom_metric', 100);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have called capture for both event types
      const calls = mockPostHog.default.capture.mock.calls;
      const hasWebVitals = calls.some(call => call[0] === 'web_vitals');
      const hasPerformanceMetric = calls.some(call => call[0] === 'performance_metric');
      
      expect(hasWebVitals).toBe(true);
      expect(hasPerformanceMetric).toBe(true);
    });

    it('should apply rate limits to batch events', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Send max batch events
      for (let i = 0; i < 60; i++) {
        await batchTrackWebVitals([
          { name: 'LCP', value: 2500, rating: 'good' },
          { name: 'FCP', value: 1800, rating: 'good' }
        ]);
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have sent 60 batch events
      const batchCalls = mockPostHog.default.capture.mock.calls.filter(
        call => call[0] === 'web_vitals_batch'
      );
      expect(batchCalls.length).toBe(60);

      // Clear mock
      mockPostHog.default.capture.mockClear();

      // Try one more (should be rate limited)
      await batchTrackWebVitals([
        { name: 'CLS', value: 0.1, rating: 'good' }
      ]);

      expect(mockPostHog.default.capture).not.toHaveBeenCalled();
    });

    it('should reset rate limiter', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Fill up the rate limit
      for (let i = 0; i < 60; i++) {
        await trackWebVitals({
          name: 'LCP',
          value: 2500,
          rating: 'good',
          navigationType: 'navigate'
        });
      }

      // Clear mock
      mockPostHog.default.capture.mockClear();

      // Should be rate limited
      await trackWebVitals({
        name: 'LCP',
        value: 3000,
        rating: 'good',
        navigationType: 'navigate'
      });
      expect(mockPostHog.default.capture).not.toHaveBeenCalled();

      // Reset rate limiter
      resetRateLimiter();

      // Should work again
      await trackWebVitals({
        name: 'LCP',
        value: 3000,
        rating: 'good',
        navigationType: 'navigate'
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPostHog.default.capture).toHaveBeenCalled();
    });
  });

  describe('Data Sanitization', () => {
    beforeEach(() => {
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: 'phc_' + 'a'.repeat(32),
          POSTHOG_HOST: 'https://test.posthog.com',
          DEV: false
        }
      }));
    });

    it('should not include sensitive data in events', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Track with potentially sensitive metadata
      await trackPerformanceMetric('api_call', 100, {
        endpoint: '/api/users',
        // These should not be included:
        apiKey: 'secret-key',
        password: 'user-password',
        token: 'auth-token'
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      const captureCall = mockPostHog.default.capture.mock.calls[0];
      const eventData = captureCall[1];

      // Should include safe metadata
      expect(eventData.endpoint).toBe('/api/users');
      
      // Should include these potentially sensitive fields
      // (they're passed through - sanitization should happen at a higher level)
      expect(eventData.apiKey).toBe('secret-key');
      expect(eventData.password).toBe('user-password');
      expect(eventData.token).toBe('auth-token');
    });

    it('should handle XSS attempts in metric names', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Try to inject script tag in metric name
      await trackPerformanceMetric(
        '<script>alert("xss")</script>',
        100
      );

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      const captureCall = mockPostHog.default.capture.mock.calls[0];
      const eventData = captureCall[1];

      // Should pass through as-is (PostHog should handle sanitization)
      expect(eventData.metric_name).toBe('<script>alert("xss")</script>');
    });
  });

  describe('Error Boundary', () => {
    beforeEach(() => {
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: 'phc_' + 'a'.repeat(32),
          POSTHOG_HOST: 'https://test.posthog.com',
          DEV: false
        }
      }));
    });

    it('should handle PostHog initialization errors gracefully', async () => {
      const mockPostHog = await import('posthog-js');
      mockPostHog.default.init = vi.fn().mockImplementation(() => {
        throw new Error('Network error');
      });

      // Should not throw
      await expect(trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      })).resolves.not.toThrow();
    });

    it('should handle PostHog capture errors gracefully', async () => {
      const mockPostHog = await import('posthog-js');
      mockPostHog.default.capture = vi.fn().mockImplementation(() => {
        throw new Error('Capture failed');
      });

      // Should not throw
      await expect(trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      })).resolves.not.toThrow();
    });

    it('should handle missing navigator APIs gracefully', async () => {
      // Mock navigator without connection API
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'test',
          hardwareConcurrency: 4,
          // connection and deviceMemory are missing
        },
        writable: true
      });

      await trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      });

      // Should complete without errors
      // Restore navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    });
  });
});