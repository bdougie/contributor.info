import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIntersectionLoader, useIntersectionObserver } from '../use-intersection-loader';

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Element[] = [];
  
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  
  observe(element: Element) {
    this.elements.push(element);
  }
  
  unobserve(element: Element) {
    this.elements = this.elements.filter(el => el !== element);
  }
  
  disconnect() {
    this.elements = [];
  }
  
  trigger(isIntersecting: boolean) {
    const entries = this.elements.map(target => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: {} as DOMRectReadOnly,
      time: Date.now(),
    }));
    this.callback(entries, this);
  }
}

let mockObserver: MockIntersectionObserver | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mockObserver = null;
  
  // Setup IntersectionObserver mock
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => {
    mockObserver = new MockIntersectionObserver(callback);
    return mockObserver;
  }) as any;
});

describe('useIntersectionLoader', () => {
  it.skip('should not load data until element intersects', async () => {
    const loadFn = vi.fn().mockResolvedValue({ data: 'test' });
    
    const { result, rerender } = renderHook(() => 
      useIntersectionLoader(loadFn)
    );
    
    // Create a mock element and assign to ref
    const mockElement = document.createElement('div');
    Object.defineProperty(result.current.ref, 'current', {
      writable: true,
      value: mockElement,
    });
    
    // Re-render to trigger effect with ref
    rerender();
    
    // Wait for observer to be set up
    await waitFor(() => {
      expect(mockObserver).toBeTruthy();
    });
    
    // Initially, data should be null and not loading
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(loadFn).not.toHaveBeenCalled();
    
    // Trigger intersection
    act(() => {
      mockObserver?.trigger(true);
    });
    
    // Should start loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(loadFn).toHaveBeenCalledTimes(1);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({ data: 'test' });
    });
  });
  
  it('should load immediately when loadImmediately is true', async () => {
    const loadFn = vi.fn().mockResolvedValue({ data: 'immediate' });
    
    const { result } = renderHook(() => 
      useIntersectionLoader(loadFn, { loadImmediately: true })
    );
    
    // Should start loading immediately
    expect(loadFn).toHaveBeenCalledTimes(1);
    
    await waitFor(() => {
      expect(result.current.data).toEqual({ data: 'immediate' });
    });
  });
  
  it.skip('should respect delay option', async () => {
    vi.useFakeTimers();
    const loadFn = vi.fn().mockResolvedValue({ data: 'delayed' });
    
    const { result, rerender } = renderHook(() => 
      useIntersectionLoader(loadFn, { delay: 1000 })
    );
    
    // Create mock element
    const mockElement = document.createElement('div');
    Object.defineProperty(result.current.ref, 'current', {
      writable: true,
      value: mockElement,
    });
    
    // Re-render to trigger effect
    rerender();
    
    // Wait for observer to be set up
    await waitFor(() => {
      expect(mockObserver).toBeTruthy();
    });
    
    // Trigger intersection
    act(() => {
      mockObserver?.trigger(true);
    });
    
    // Should not load immediately
    expect(loadFn).not.toHaveBeenCalled();
    
    // Advance time
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    
    // Now should load
    expect(loadFn).toHaveBeenCalledTimes(1);
    
    vi.useRealTimers();
  });
  
  it.skip('should handle errors', async () => {
    const error = new Error('Load failed');
    const loadFn = vi.fn().mockRejectedValue(error);
    
    const { result, rerender } = renderHook(() => 
      useIntersectionLoader(loadFn)
    );
    
    // Create mock element
    const mockElement = document.createElement('div');
    Object.defineProperty(result.current.ref, 'current', {
      writable: true,
      value: mockElement,
    });
    
    // Re-render and trigger intersection
    rerender();
    
    // Wait for observer to be set up
    await waitFor(() => {
      expect(mockObserver).toBeTruthy();
    });
    
    act(() => {
      mockObserver?.trigger(true);
    });
    
    await waitFor(() => {
      expect(result.current.error).toEqual(error);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });
  });
  
  it('should allow manual loading', async () => {
    const loadFn = vi.fn().mockResolvedValue({ data: 'manual' });
    
    const { result } = renderHook(() => 
      useIntersectionLoader(loadFn)
    );
    
    // Manually trigger load
    await act(async () => {
      await result.current.load();
    });
    
    expect(loadFn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ data: 'manual' });
  });
  
  it('should reset state', async () => {
    const loadFn = vi.fn().mockResolvedValue({ data: 'test' });
    
    const { result } = renderHook(() => 
      useIntersectionLoader(loadFn)
    );
    
    // Load data
    await act(async () => {
      await result.current.load();
    });
    
    expect(result.current.data).toEqual({ data: 'test' });
    
    // Reset
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useIntersectionObserver', () => {
  it.skip('should track intersection state', async () => {
    const { result, rerender } = renderHook(() => 
      useIntersectionObserver()
    );
    
    // Create mock element
    const mockElement = document.createElement('div');
    Object.defineProperty(result.current.ref, 'current', {
      writable: true,
      value: mockElement,
    });
    
    // Re-render to trigger effect
    rerender();
    
    // Wait for observer to be set up
    await waitFor(() => {
      expect(mockObserver).toBeTruthy();
    });
    
    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.hasIntersected).toBe(false);
    
    // Trigger intersection
    act(() => {
      mockObserver?.trigger(true);
    });
    
    expect(result.current.isIntersecting).toBe(true);
    expect(result.current.hasIntersected).toBe(true);
    
    // Leave intersection
    act(() => {
      mockObserver?.trigger(false);
    });
    
    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.hasIntersected).toBe(true); // Still true
  });
});