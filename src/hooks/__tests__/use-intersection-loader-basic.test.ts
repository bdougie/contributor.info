import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useIntersectionLoader, useIntersectionObserver } from '../use-intersection-loader';

// Simple IntersectionObserver mock
let observerCallback: IntersectionObserverCallback | null = null;
let observerOptions: IntersectionObserverInit | null = null;
const mockObserver = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
};

global.IntersectionObserver = vi.fn((callback, options) => {
  observerCallback = callback;
  observerOptions = options || null;
  return mockObserver;
}) as unknown as typeof IntersectionObserver;

describe('useIntersectionLoader - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
    observerOptions = null;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const loadFn = vi.fn().mockResolvedValue('test data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(result.current.data).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.isIntersecting).toBe(false);
      expect(result.current.ref).toBeDefined();
    });

    it('should provide a ref for intersection observation', () => {
      const loadFn = vi.fn();
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      // The ref should be defined
      expect(result.current.ref).toBeDefined();
      expect(typeof result.current.ref).toBe('object');
      expect(result.current.ref).toHaveProperty('current');
    });

    it('should provide load and reset functions', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(typeof result.current.load).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Return Value Structure', () => {
    it('should return all expected properties', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(result.current).toHaveProperty('ref');
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isIntersecting');
      expect(result.current).toHaveProperty('load');
      expect(result.current).toHaveProperty('reset');
    });

    it('should have correctly typed properties', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(result.current.data).toBe(null);
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(result.current.error).toBe(null);
      expect(typeof result.current.isIntersecting).toBe('boolean');
    });
  });

  describe('Options Handling', () => {
    it('should use default IntersectionObserver options', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      renderHook(() => useIntersectionLoader(loadFn));

      // IntersectionObserver should be created with defaults
      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    it('should accept custom IntersectionObserver options', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const options = {
        root: null,
        rootMargin: '100px',
        threshold: 0.5,
      };

      renderHook(() => useIntersectionLoader(loadFn, options));

      // The observer should be configured with custom options
      expect(global.IntersectionObserver).toHaveBeenCalled();
      expect(observerOptions?.rootMargin).toBe('100px');
      expect(observerOptions?.threshold).toBe(0.5);
    });

    it('should accept loadImmediately option', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn, { loadImmediately: true }));

      // Hook should initialize properly with loadImmediately
      expect(result.current.ref).toBeDefined();
    });

    it('should accept continuous option', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn, { continuous: true }));

      // Hook should initialize properly with continuous
      expect(result.current.ref).toBeDefined();
    });

    it('should accept delay option', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn, { delay: 1000 }));

      // Hook should initialize properly with delay
      expect(result.current.ref).toBeDefined();
    });
  });

  describe('Reset Function', () => {
    it('should have reset function defined', () => {
      const loadFn = vi.fn().mockResolvedValue('test data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(typeof result.current.reset).toBe('function');
    });

    it('should not throw when calling reset', () => {
      const loadFn = vi.fn().mockResolvedValue('test data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(() => {
        act(() => {
          result.current.reset();
        });
      }).not.toThrow();
    });

    it('should reset state to initial values', () => {
      const loadFn = vi.fn().mockResolvedValue('test data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isIntersecting).toBe(false);
    });
  });

  describe('Load Function', () => {
    it('should have load function defined', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      expect(typeof result.current.load).toBe('function');
    });

    it('should call the load function when load is invoked', () => {
      const loadFn = vi.fn().mockResolvedValue('test data');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      act(() => {
        result.current.load();
      });

      expect(loadFn).toHaveBeenCalled();
    });

    it('should return a promise from load', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { result } = renderHook(() => useIntersectionLoader(loadFn));

      const loadResult = result.current.load();

      expect(loadResult).toBeInstanceOf(Promise);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount without errors', () => {
      const loadFn = vi.fn();
      const { unmount } = renderHook(() => useIntersectionLoader(loadFn));

      expect(() => unmount()).not.toThrow();
    });

    it('should disconnect observer on unmount', () => {
      const loadFn = vi.fn().mockResolvedValue('test');
      const { unmount } = renderHook(() => useIntersectionLoader(loadFn));

      unmount();

      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('Type Generics', () => {
    it('should work with string data type', () => {
      const loadFn = vi.fn().mockResolvedValue('string data');
      const { result } = renderHook(() => useIntersectionLoader<string>(loadFn));

      expect(result.current.data).toBe(null);
    });

    it('should work with object data type', () => {
      interface TestData {
        id: number;
        name: string;
      }
      const loadFn = vi.fn().mockResolvedValue({ id: 1, name: 'test' });
      const { result } = renderHook(() => useIntersectionLoader<TestData>(loadFn));

      expect(result.current.data).toBe(null);
    });

    it('should work with array data type', () => {
      const loadFn = vi.fn().mockResolvedValue([1, 2, 3]);
      const { result } = renderHook(() => useIntersectionLoader<number[]>(loadFn));

      expect(result.current.data).toBe(null);
    });
  });
});

describe('useIntersectionObserver - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
    observerOptions = null;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useIntersectionObserver());

      expect(result.current.ref).toBeDefined();
      expect(result.current.isIntersecting).toBe(false);
      expect(result.current.hasIntersected).toBe(false);
    });

    it('should provide a ref object', () => {
      const { result } = renderHook(() => useIntersectionObserver());

      expect(result.current.ref).toBeDefined();
      expect(typeof result.current.ref).toBe('object');
      expect(result.current.ref).toHaveProperty('current');
    });
  });

  describe('Return Value Structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useIntersectionObserver());

      expect(result.current).toHaveProperty('ref');
      expect(result.current).toHaveProperty('isIntersecting');
      expect(result.current).toHaveProperty('hasIntersected');
    });

    it('should have correctly typed boolean properties', () => {
      const { result } = renderHook(() => useIntersectionObserver());

      expect(typeof result.current.isIntersecting).toBe('boolean');
      expect(typeof result.current.hasIntersected).toBe('boolean');
    });
  });

  describe('Options Handling', () => {
    it('should work without options', () => {
      const { result } = renderHook(() => useIntersectionObserver());

      expect(result.current.ref).toBeDefined();
    });

    it('should accept custom options', () => {
      const options = {
        root: null,
        rootMargin: '50px',
        threshold: 0.25,
      };

      const { result } = renderHook(() => useIntersectionObserver(options));

      expect(result.current.ref).toBeDefined();
      expect(observerOptions?.rootMargin).toBe('50px');
      expect(observerOptions?.threshold).toBe(0.25);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount without errors', () => {
      const { unmount } = renderHook(() => useIntersectionObserver());

      expect(() => unmount()).not.toThrow();
    });

    it('should disconnect observer on unmount', () => {
      const { unmount } = renderHook(() => useIntersectionObserver());

      unmount();

      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });
});
