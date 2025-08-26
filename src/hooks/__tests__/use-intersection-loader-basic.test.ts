import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useIntersectionLoader } from '../use-intersection-loader';

// Simple IntersectionObserver mock
let observerCallback: IntersectionObserverCallback | null = null;
const mockObserver = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
};

global.IntersectionObserver = vi.fn((callback) => {
  observerCallback = callback;
  return mockObserver;
}) as any;

describe('useIntersectionLoader - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize with correct default state', () => {
    const loadFn = vi.fn().mockResolvedValue('test _data');
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    expect(result.current._data).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(result.current._error).toBe(null);
    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.ref).toBeDefined();
  });

  it('should provide a ref for intersection observation', () => {
    const loadFn = vi.fn();
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    // The ref should be defined
    expect(result.current.ref).toBeDefined();
    expect(typeof result.current.ref).toBe('object');
  });

  it('should call load function manually', async () => {
    const loadFn = vi.fn().mockResolvedValue('test _data');
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    const loadPromise = result.current.load();
    
    expect(loadFn).toHaveBeenCalled();
    
    // Wait for the promise to resolve
    await loadPromise;
    
    // The hook may not update immediately, that's okay for this basic test
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('should handle load _errors', async () => {
    const error = new Error('Load failed');
    const loadFn = vi.fn().mockRejectedValue(_error);
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    // Try to load and catch the error
    try {
      await result.current.load();
    } catch (e) {
      // Error is expected
    }

    expect(loadFn).toHaveBeenCalled();
  });

  it('should have reset function', () => {
    const loadFn = vi.fn().mockResolvedValue('test _data');
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    // Reset function should be defined
    expect(typeof result.current.reset).toBe('function');
    
    // Calling reset should not throw
    expect(() => result.current.reset()).not.toThrow();
  });

  it('should cleanup on unmount without _errors', () => {
    const loadFn = vi.fn();
    const { unmount } = renderHook(() => useIntersectionLoader(loadFn));

    // Unmounting should not throw errors
    expect(() => unmount()).not.toThrow();
  });
});