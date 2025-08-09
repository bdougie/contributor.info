import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock dependencies
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn().mockResolvedValue({
    commits: [],
    totalCommits: 0,
    yoloCoders: []
  }),
}));

vi.mock('@/lib/supabase-pr-data-smart-deduped', () => ({
  fetchPRDataSmart: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        title: 'Test PR',
        user: { login: 'user1', avatar_url: 'https://example.com/user1.jpg' },
        state: 'merged',
        merged: true,
        created_at: '2024-01-01T00:00:00Z',
        additions: 100,
        deletions: 50,
      },
    ],
    status: 'success',
    message: 'Data loaded',
  }),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn().mockReturnValue({
    factor: 0.5,
    description: 'Test',
    category: 'balanced',
  }),
}));

vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

vi.mock('@/lib/retry-utils', () => ({
  withRetry: vi.fn(async (fn) => fn()),
}));

// Import the hook after mocks
import { useProgressiveRepoData } from '../../hooks/use-progressive-repo-data';

describe('Progressive Loading - Simple Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock requestIdleCallback
    window.requestIdleCallback = vi.fn((callback) => {
      setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);
      return 1;
    });
    
    window.cancelIdleCallback = vi.fn();
  });

  it('should load data and change stages', async () => {
    const { result } = renderHook(() => 
      useProgressiveRepoData('facebook', 'react', '90d', false)
    );

    // Initial state
    expect(result.current.currentStage).toBe('initial');
    expect(result.current.basicInfo).toBeNull();

    // Wait for the hook to update - use act to handle React updates
    await act(async () => {
      // Give time for async operations
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // After initial load, stage should progress
    expect(result.current.currentStage).not.toBe('initial');
    
    // Stage should be at least critical
    expect(['critical', 'full', 'complete']).toContain(result.current.currentStage);
  });

  it('should handle missing parameters gracefully', () => {
    const { result } = renderHook(() => 
      useProgressiveRepoData(undefined, 'react', '90d', false)
    );

    // Should stay in initial state when owner is missing
    expect(result.current.currentStage).toBe('initial');
    expect(result.current.basicInfo).toBeNull();
    expect(result.current.stats.loading).toBe(true);
  });

  it('should set error state on fetch failure', async () => {
    const { fetchPRDataSmart } = await import('@/lib/supabase-pr-data-smart-deduped');
    const mockFetch = fetchPRDataSmart as ReturnType<typeof vi.fn>;
    
    // Clear the default mock and make all fetch calls fail
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network error'));

    // Use different repo name to avoid cache hit
    const { result } = renderHook(() => 
      useProgressiveRepoData('testorg', 'testrepo', '90d', false)
    );

    // Wait for the hook to try loading
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Should handle error gracefully
    expect(result.current.basicInfo).toBeNull();
    expect(result.current.currentStage).toBe('complete'); // All stages complete, but with errors
    expect(result.current.stageProgress.critical).toBe(true);
    expect(result.current.stageProgress.full).toBe(true);
    expect(result.current.stageProgress.complete).toBe(true);
  });

  describe('Cache hit/miss scenarios', () => {
    it('should use cached data when available', async () => {
      // First render to populate cache
      const { result: firstResult, unmount: firstUnmount } = renderHook(() => 
        useProgressiveRepoData('facebook', 'react', '90d', false)
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const firstBasicInfo = firstResult.current.basicInfo;
      firstUnmount();

      // Second render should use cached data (within 5 minute cache window)
      const { result: secondResult } = renderHook(() => 
        useProgressiveRepoData('facebook', 'react', '90d', false)
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Should have same data from cache
      expect(secondResult.current.basicInfo).toEqual(firstBasicInfo);
      expect(secondResult.current.currentStage).not.toBe('initial');
    });

    it('should generate different cache keys for different parameters', async () => {
      const { fetchPRDataSmart } = await import('@/lib/supabase-pr-data-smart-deduped');
      const mockFetch = fetchPRDataSmart as ReturnType<typeof vi.fn>;
      
      // Clear previous calls
      mockFetch.mockClear();

      // Render with different parameters
      const { result: result1 } = renderHook(() => 
        useProgressiveRepoData('facebook', 'react', '90d', false)
      );
      
      const { result: result2 } = renderHook(() => 
        useProgressiveRepoData('facebook', 'react', '30d', false) // Different time range
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should make separate API calls due to different cache keys
      expect(mockFetch).toHaveBeenCalledWith('facebook', 'react', { timeRange: '90d' });
      expect(mockFetch).toHaveBeenCalledWith('facebook', 'react', { timeRange: '30d' });
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should bypass cache when data is expired', async () => {
      // Mock Date.now to simulate cache expiration
      const originalDateNow = Date.now;
      const mockDateNow = vi.fn();
      global.Date.now = mockDateNow;

      try {
        // First call - populate cache
        mockDateNow.mockReturnValue(1000000); // Initial time
        
        const { result: firstResult, unmount: firstUnmount } = renderHook(() => 
          useProgressiveRepoData('microsoft', 'vscode', '90d', false)
        );

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
        
        firstUnmount();

        // Second call - simulate expired cache (after 5 minutes + 1ms)
        mockDateNow.mockReturnValue(1000000 + (5 * 60 * 1000) + 1);
        
        const { fetchPRDataSmart } = await import('@/lib/supabase-pr-data-smart-deduped');
        const mockFetch = fetchPRDataSmart as ReturnType<typeof vi.fn>;
        mockFetch.mockClear();

        const { result: secondResult } = renderHook(() => 
          useProgressiveRepoData('microsoft', 'vscode', '90d', false)
        );

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Should make fresh API call due to expired cache
        expect(mockFetch).toHaveBeenCalledWith('microsoft', 'vscode', { timeRange: '90d' });
      } finally {
        global.Date.now = originalDateNow;
      }
    });
  });

  describe('AbortController cleanup behavior', () => {
    it('should abort previous requests when parameters change', async () => {
      const abortSpy = vi.fn();
      const originalAbortController = global.AbortController;
      
      // Mock AbortController to track abort calls
      global.AbortController = class MockAbortController {
        signal = { aborted: false };
        abort = abortSpy;
      } as any;

      try {
        const { result, rerender } = renderHook(
          ({ owner }: { owner: string }) => useProgressiveRepoData(owner, 'react', '90d', false),
          { initialProps: { owner: 'facebook' } }
        );

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });

        // Change parameters to trigger new request
        rerender({ owner: 'microsoft' });

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });

        // Should have called abort on previous request
        expect(abortSpy).toHaveBeenCalled();
      } finally {
        global.AbortController = originalAbortController;
      }
    });

    it('should cleanup abort controller on unmount', async () => {
      const abortSpy = vi.fn();
      const originalAbortController = global.AbortController;
      
      // Mock AbortController to track abort calls
      global.AbortController = class MockAbortController {
        signal = { aborted: false };
        abort = abortSpy;
      } as any;

      try {
        const { result, unmount } = renderHook(() => 
          useProgressiveRepoData('facebook', 'react', '90d', false)
        );

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });

        // Unmount component
        unmount();

        // Should have called abort on cleanup
        expect(abortSpy).toHaveBeenCalled();
      } finally {
        global.AbortController = originalAbortController;
      }
    });

    it('should not make enhancement requests after abort', async () => {
      const { fetchDirectCommitsWithDatabaseFallback } = await import('@/lib/supabase-direct-commits');
      const mockFetch = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
      mockFetch.mockClear();

      const { result, unmount } = renderHook(() => 
        useProgressiveRepoData('github', 'docs', '90d', false)
      );

      // Wait for critical and full stages
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Unmount before enhancement stage starts
      unmount();

      // Wait additional time for enhancement stage
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Enhancement data fetch should not have been called after abort
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});