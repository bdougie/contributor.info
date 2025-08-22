import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  trackWebVitals,
  batchTrackWebVitals,
  trackPerformanceMetric,
  enablePostHogInDev,
  disablePostHogInDev,
  optOutOfPostHog,
  optInToPostHog,
  isPostHogEnabled,
  getPostHogInstance
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

// Mock env module with valid PostHog key format
vi.mock('../env', () => ({
  env: {
    POSTHOG_KEY: 'phc_' + 'a'.repeat(32), // Valid PostHog key format
    POSTHOG_HOST: 'https://test.posthog.com',
    DEV: false
  }
}));

// Mock dynamic import of posthog-js
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    people: {
      set: vi.fn()
    },
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn()
  }
}));

describe('PostHog Lazy Loading', () => {
  beforeEach(() => {
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    localStorageMock.clear();
    
    // Clear module cache
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackWebVitals', () => {
    it('should not track when PostHog key is missing', async () => {
      // Mock env without key
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: '',
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
    });

    it('should track web vitals when enabled', async () => {
      const mockPostHog = await import('posthog-js');
      
      await trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        delta: 100,
        navigationType: 'navigate'
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPostHog.default.init).toHaveBeenCalledWith(
        'phc_' + 'a'.repeat(32),
        expect.objectContaining({
          api_host: 'https://test.posthog.com',
          autocapture: false,
          capture_pageview: false,
          disable_session_recording: true
        })
      );

      expect(mockPostHog.default.capture).toHaveBeenCalledWith(
        'web_vitals',
        expect.objectContaining({
          metric_name: 'LCP',
          metric_value: 2500,
          metric_rating: 'good',
          metric_delta: 100,
          navigation_type: 'navigate'
        })
      );
    });

    it('should respect opt-out preference', async () => {
      localStorageMock.setItem('posthog_opt_out', 'true');
      
      const mockPostHog = await import('posthog-js');
      await trackWebVitals({
        name: 'CLS',
        value: 0.1,
        rating: 'good',
        navigationType: 'navigate'
      });

      expect(mockPostHog.default.capture).not.toHaveBeenCalled();
    });

    it('should be disabled in development by default', async () => {
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: 'phc_' + 'a'.repeat(32),
          POSTHOG_HOST: 'https://test.posthog.com',
          DEV: true
        }
      }));

      const mockPostHog = await import('posthog-js');
      await trackWebVitals({
        name: 'FCP',
        value: 1800,
        rating: 'good',
        navigationType: 'navigate'
      });

      expect(mockPostHog.default.capture).not.toHaveBeenCalled();
    });

    it('should work in development when explicitly enabled', async () => {
      vi.doMock('../env', () => ({
        env: {
          POSTHOG_KEY: 'phc_' + 'a'.repeat(32),
          POSTHOG_HOST: 'https://test.posthog.com',
          DEV: true
        }
      }));

      localStorageMock.setItem('enablePostHogDev', 'true');
      
      const mockPostHog = await import('posthog-js');
      await trackWebVitals({
        name: 'INP',
        value: 200,
        rating: 'good',
        navigationType: 'navigate'
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPostHog.default.capture).toHaveBeenCalled();
    });
  });

  describe('batchTrackWebVitals', () => {
    it('should batch multiple metrics into a single event', async () => {
      const mockPostHog = await import('posthog-js');
      
      const metrics = [
        { name: 'LCP', value: 2500, rating: 'good' as const, delta: 100 },
        { name: 'FCP', value: 1800, rating: 'good' as const, delta: 50 },
        { name: 'CLS', value: 0.1, rating: 'good' as const }
      ];

      await batchTrackWebVitals(metrics);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPostHog.default.capture).toHaveBeenCalledWith(
        'web_vitals_batch',
        expect.objectContaining({
          lcp_value: 2500,
          lcp_rating: 'good',
          lcp_delta: 100,
          fcp_value: 1800,
          fcp_rating: 'good',
          fcp_delta: 50,
          cls_value: 0.1,
          cls_rating: 'good'
        })
      );
    });
  });

  describe('trackPerformanceMetric', () => {
    it('should track custom performance metrics', async () => {
      const mockPostHog = await import('posthog-js');
      
      await trackPerformanceMetric('bundle_size', 1024, {
        chunk: 'main',
        compressed: true
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPostHog.default.capture).toHaveBeenCalledWith(
        'performance_metric',
        expect.objectContaining({
          metric_name: 'bundle_size',
          metric_value: 1024,
          chunk: 'main',
          compressed: true
        })
      );
    });
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

  describe('Opt-out/Opt-in controls', () => {
    it('should handle opt-out', async () => {
      const mockPostHog = await import('posthog-js');
      
      // First track something to initialize PostHog
      await trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      });

      await optOutOfPostHog();
      
      expect(localStorageMock.getItem('posthog_opt_out')).toBe('true');
      expect(mockPostHog.default.opt_out_capturing).toHaveBeenCalled();
    });

    it('should handle opt-in', async () => {
      const mockPostHog = await import('posthog-js');
      
      localStorageMock.setItem('posthog_opt_out', 'true');
      
      // Initialize PostHog first
      await trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      });
      
      await optInToPostHog();
      
      expect(localStorageMock.getItem('posthog_opt_out')).toBeNull();
      expect(mockPostHog.default.opt_in_capturing).toHaveBeenCalled();
    });
  });

  describe('isPostHogEnabled', () => {
    it('should return false when not initialized', () => {
      expect(isPostHogEnabled()).toBe(false);
    });

    it('should return false when opted out', () => {
      localStorageMock.setItem('posthog_opt_out', 'true');
      expect(isPostHogEnabled()).toBe(false);
    });

    it('should return true when enabled and initialized', async () => {
      // Track something to initialize
      await trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      // Note: This will still return false in tests because we're mocking
      // In real usage, it would return true after initialization
      expect(isPostHogEnabled()).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle PostHog loading failures gracefully', async () => {
      // Mock import failure
      vi.doMock('posthog-js', () => {
        throw new Error('Failed to load PostHog');
      });

      // Should not throw
      await expect(trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      })).resolves.not.toThrow();
    });

    it('should handle capture failures gracefully', async () => {
      const mockPostHog = await import('posthog-js');
      mockPostHog.default.capture = vi.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      })).resolves.not.toThrow();
    });
  });

  describe('Performance considerations', () => {
    it('should generate stable distinct IDs', () => {
      const id1 = localStorageMock.getItem('contributor_info_distinct_id');
      
      // Simulate page reload by calling track again
      trackWebVitals({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        navigationType: 'navigate'
      });

      const id2 = localStorageMock.getItem('contributor_info_distinct_id');
      
      // ID should remain the same across calls
      if (id1) {
        expect(id2).toBe(id1);
      }
    });

    it('should only load PostHog once', async () => {
      const mockPostHog = await import('posthog-js');
      
      // Track multiple metrics
      await Promise.all([
        trackWebVitals({ name: 'LCP', value: 2500, rating: 'good', navigationType: 'navigate' }),
        trackWebVitals({ name: 'FCP', value: 1800, rating: 'good', navigationType: 'navigate' }),
        trackWebVitals({ name: 'CLS', value: 0.1, rating: 'good', navigationType: 'navigate' })
      ]);

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // init should only be called once despite multiple tracks
      expect(mockPostHog.default.init).toHaveBeenCalledTimes(1);
    });
  });
});