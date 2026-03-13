import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useIntersectionLoader } from '../use-intersection-loader';

// Simple IntersectionObserver mock
const mockObserver = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
};

global.IntersectionObserver = vi.fn(() => mockObserver) as unknown as typeof IntersectionObserver;

describe('useIntersectionLoader - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

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
  });

  it('should call load function manually', () => {
    const loadFn = vi.fn().mockResolvedValue('test data');
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    result.current.load();

    expect(loadFn).toHaveBeenCalled();
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('should handle load errors', () => {
    const error = new Error('Load failed');
    const loadFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    // Call load - the rejected promise is handled internally by the hook
    result.current.load();

    expect(loadFn).toHaveBeenCalled();
  });

  it('should have reset function', () => {
    const loadFn = vi.fn().mockResolvedValue('test data');
    const { result } = renderHook(() => useIntersectionLoader(loadFn));

    // Reset function should be defined
    expect(typeof result.current.reset).toBe('function');

    // Calling reset should not throw
    expect(() => result.current.reset()).not.toThrow();
  });

  it('should cleanup on unmount without errors', () => {
    const loadFn = vi.fn();
    const { unmount } = renderHook(() => useIntersectionLoader(loadFn));

    // Unmounting should not throw errors
    expect(() => unmount()).not.toThrow();
  });
});
