import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useIntersectionLoader } from '../use-intersection-loader';

// Enhanced IntersectionObserver mock that can simulate real behavior
let intersectionCallback: IntersectionObserverCallback;
let observerInstance: {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
};

const mockIntersectionObserver = vi
  .fn()
  .mockImplementation((callback: IntersectionObserverCallback) => {
    intersectionCallback = callback;
    observerInstance = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    };
    return observerInstance;
  });

// Helper to simulate intersection events
const simulateIntersection = (isIntersecting: boolean, intersectionRatio = 0) => {
  if (intersectionCallback) {
    const mockEntry = {
      isIntersecting,
      intersectionRatio,
      boundingClientRect: { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 },
      intersectionRect: isIntersecting
        ? { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 }
        : { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 },
      rootBounds: { top: 0, left: 0, bottom: 1000, right: 1000, width: 1000, height: 1000 },
      target: document.createElement('div'),
      time: Date.now(),
    } as IntersectionObserverEntry;

    intersectionCallback([mockEntry], observerInstance as any);
  }
};

// Mock window.requestIdleCallback with immediate execution for testing
const mockRequestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
  // Execute immediately in tests to avoid timing issues
  callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
  return 1;
});

Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: mockRequestIdleCallback,
});

global.IntersectionObserver = mockIntersectionObserver;

// Helper for consistent waitFor configuration
const waitForWithTimeout = (callback: () => void, options = {}) =>
  waitFor(callback, { timeout: 10000, ...options });

describe('useIntersectionLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = undefined as any;
    observerInstance = undefined as any;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Basic functionality', () => {
    it('should initialize with correct default state', () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(result.current._data).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current._error).toBe(null);
      expect(result.current.isIntersecting).toBe(false);
      expect(result.current.ref).toBeDefined();
      expect(typeof result.current.load).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should create IntersectionObserver when ref is set', () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      // Simulate ref being attached
      const mockElement = document.createElement('div');
      (result.current.ref as any).current = mockElement;

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          root: null,
          rootMargin: '0px',
          threshold: 0,
        }),
      );
    });

    it('should observe element when ref is attached', async () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      renderHook(() => useIntersectionLoader(loadFn));

      await waitFor(() => {
        expect(observerInstance?.observe).toHaveBeenCalled();
      });
    });
  });

  describe('Loading behavior', () => {
    it('should load immediately when loadImmediately is true', async () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn, { loadImmediately: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result.current._data).toBe('test _data');
        expect(result.current.isLoading).toBe(false);
        expect(loadFn).toHaveBeenCalledTimes(1);
      });
    });

    it('should load when element intersects', async () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      // Simulate intersection
      simulateIntersection(true);

      await waitFor(() => {
        expect(result.current.isIntersecting).toBe(true);
        expect(result.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result.current._data).toBe('test _data');
        expect(result.current.isLoading).toBe(false);
        expect(loadFn).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle loading _errors', async () => {
      const _error = new Error('Loading failed');
      const loadFn = vi.fn().mockRejectedValue(_error);
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      simulateIntersection(true);

      await waitFor(() => {
        expect(result.current._error).toEqual(_error);
        expect(result.current.isLoading).toBe(false);
        expect(result.current._data).toBe(null);
      });
    });

    it('should convert non-Error objects to Error', async () => {
      const loadFn = vi.fn().mockRejectedValue('string _error');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      simulateIntersection(true);

      await waitFor(() => {
        expect(result.current._error).toBeInstanceOf(Error);
        expect(result.current._error?.message).toBe('Failed to load _data');
      });
    });
  });

  describe('Options configuration', () => {
    it('should respect custom IntersectionObserver options', () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const options = {
        root: document.body,
        rootMargin: '50px',
        threshold: 0.5,
      };

      renderHook(() => useIntersectionLoader(loadFn, options));

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining(options),
      );
    });

    it('should handle delay option', async () => {
      vi.useFakeTimers();
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn, { delay: 1000 }));

      simulateIntersection(true);

      // Should not load immediately
      expect(result.current.isLoading).toBe(false);
      expect(loadFn).not.toHaveBeenCalled();

      // Should load after delay
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(loadFn).toHaveBeenCalledTimes(1);
      });

      vi.useRealTimers();
    });

    it('should cancel delayed loading if element leaves viewport', async () => {
      vi.useFakeTimers();
      const loadFn = vi.fn().mockResolvedValue('test _data');
      renderHook(() => useIntersectionLoader(loadFn, { delay: 1000 }));

      simulateIntersection(true);
      simulateIntersection(false); // Leave viewport before delay

      vi.advanceTimersByTime(1000);

      expect(loadFn).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should support continuous loading', async () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn, { continuous: true }));

      // First intersection
      simulateIntersection(true);

      await waitFor(() => {
        expect(loadFn).toHaveBeenCalledTimes(1);
      });

      // Second intersection should trigger another load
      simulateIntersection(false);
      simulateIntersection(true);

      await waitFor(() => {
        expect(loadFn).toHaveBeenCalledTimes(2);
      });
    });

    it('should not reload after first load without continuous option', async () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      renderHook(() => useIntersectionLoader(loadFn));

      // First intersection
      simulateIntersection(true);

      await waitFor(() => {
        expect(loadFn).toHaveBeenCalledTimes(1);
      });

      // Second intersection should not trigger another load
      simulateIntersection(false);
      simulateIntersection(true);

      expect(loadFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual controls', () => {
    it('should support manual load trigger', async () => {
      const loadFn = vi.fn().mockResolvedValue('manual _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      await result.current.load();

      await waitFor(() => {
        expect(result.current._data).toBe('manual _data');
        expect(loadFn).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset state correctly', async () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      // Load data first
      simulateIntersection(true);
      await waitFor(() => {
        expect(result.current._data).toBe('test _data');
      });

      // Reset
      result.current.reset();

      expect(result.current._data).toBe(null);
      expect(result.current._error).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isIntersecting).toBe(false);
    });
  });

  describe('Cleanup and memory management', () => {
    it('should disconnect observer on unmount', () => {
      const loadFn = vi.fn().mockResolvedValue('test _data');
      const { unmount } = renderHook(() => useIntersectionLoader(loadFn));

      unmount();

      expect(observerInstance?.disconnect).toHaveBeenCalled();
    });

    it('should prevent state updates after unmount', async () => {
      const loadFn = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('test _data'), 100)),
        );

      const { result, unmount } = renderHook(() => useIntersectionLoader(loadFn));

      // Start loading
      simulateIntersection(true);

      // Unmount before loading completes
      unmount();

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // State should not have been updated after unmount
      expect(result.current._data).toBe(null);
    });

    it('should prevent multiple simultaneous loads', async () => {
      const loadFn = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('test _data'), 100)),
        );

      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      // Trigger multiple loads
      result.current.load();
      result.current.load();
      result.current.load();

      await waitFor(() => {
        expect(loadFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
