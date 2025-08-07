import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useProgressiveRepoData } from '../use-progressive-repo-data';

// Mock the dependencies
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn(),
}));

vi.mock('@/lib/supabase-pr-data-smart', () => ({
  fetchPRDataSmart: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn(),
}));

vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart';
import { calculateLotteryFactor } from '@/lib/utils';

// Mock requestIdleCallback
const mockRequestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
  setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);
  return 1;
});

Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: mockRequestIdleCallback,
});

// Test data
const mockPRData = [
  {
    id: 1,
    title: 'Test PR 1',
    user: { login: 'user1', avatar_url: 'avatar1.jpg' },
    state: 'merged',
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Test PR 2', 
    user: { login: 'user2', avatar_url: 'avatar2.jpg' },
    state: 'open',
    created_at: '2023-01-02T00:00:00Z',
  },
  {
    id: 3,
    title: 'Test PR 3',
    user: { login: 'user1', avatar_url: 'avatar1.jpg' },
    state: 'closed',
    created_at: '2023-01-03T00:00:00Z',
  },
];

const mockDirectCommitsData = {
  commits: [
    { sha: 'abc123', message: 'Test commit', author: 'user1' },
  ],
  totalCommits: 1,
};

const mockLotteryFactor = {
  factor: 0.75,
  description: 'High lottery factor',
  category: 'balanced' as const,
};

describe('useProgressiveRepoData', () => {
  const fetchDirectCommitsMock = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
  const fetchPRDataMock = fetchPRDataSmart as ReturnType<typeof vi.fn>;
  const calculateLotteryFactorMock = calculateLotteryFactor as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock implementations
    fetchPRDataMock.mockResolvedValue({
      data: mockPRData,
      status: 'success',
      message: 'Data loaded successfully',
    });
    
    fetchDirectCommitsMock.mockResolvedValue(mockDirectCommitsData);
    calculateLotteryFactorMock.mockReturnValue(mockLotteryFactor);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Initial state', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      expect(result.current.basicInfo).toBe(null);
      expect(result.current.stats.loading).toBe(true);
      expect(result.current.stats.error).toBe(null);
      expect(result.current.stats.pullRequests).toEqual([]);
      expect(result.current.lotteryFactor).toBe(null);
      expect(result.current.directCommitsData).toBe(null);
      expect(result.current.historicalTrends).toBe(null);
      expect(result.current.currentStage).toBe('initial');
      expect(result.current.dataStatus.status).toBe('pending');
      
      // All stage progress should be false initially
      Object.values(result.current.stageProgress).forEach(progress => {
        expect(progress).toBe(false);
      });
    });

    it('should not start loading without owner or repo', () => {
      renderHook(() => useProgressiveRepoData(undefined, 'repo', '90d', false));
      
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });
  });

  describe('Stage 1: Critical data loading', () => {
    it('should load critical data first', async () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.currentStage).toBe('critical');
        expect(result.current.stageProgress.critical).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.basicInfo).toBeDefined();
        expect(result.current.basicInfo?.prCount).toBe(3);
        expect(result.current.basicInfo?.contributorCount).toBe(2);
        expect(result.current.basicInfo?.topContributors).toHaveLength(2);
        expect(result.current.basicInfo?.topContributors[0]).toEqual({
          login: 'user1',
          avatar_url: 'avatar1.jpg',
          contributions: 2,
        });
      });

      expect(fetchPRDataMock).toHaveBeenCalledWith('owner', 'repo', {
        timeRange: '90d'
      });
    });

    it('should handle critical data loading errors', async () => {
      fetchPRDataMock.mockResolvedValueOnce({
        data: null,
        status: 'error',
        message: 'Repository not found',
      });

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.basicInfo).toBe(null);
      });
    });
  });

  describe('Stage 2: Full data loading', () => {
    it('should progress to full data loading after critical', async () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Wait for critical stage
      await waitFor(() => {
        expect(result.current.stageProgress.critical).toBe(true);
      });

      // Wait for full stage
      await waitFor(() => {
        expect(result.current.currentStage).toBe('full');
        expect(result.current.stageProgress.full).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
        expect(result.current.stats.pullRequests).toEqual(mockPRData);
        expect(result.current.lotteryFactor).toEqual(mockLotteryFactor);
        expect(result.current.dataStatus.status).toBe('success');
      });

      expect(calculateLotteryFactorMock).toHaveBeenCalledWith(mockPRData);
    });

    it('should handle full data loading errors', async () => {
      fetchPRDataMock
        .mockResolvedValueOnce({ // First call for critical stage
          data: mockPRData,
          status: 'success',
        })
        .mockResolvedValueOnce({ // Second call for full stage
          data: null,
          status: 'error',
          message: 'Database connection failed',
        });

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.stageProgress.full).toBe(true);
        expect(result.current.stats.loading).toBe(false);
        expect(result.current.stats.error).toBe('Database connection failed');
        expect(result.current.dataStatus.status).toBe('no_data');
        expect(result.current.dataStatus.message).toBe('Database connection failed');
      });
    });

    it('should not calculate lottery factor for empty data', async () => {
      fetchPRDataMock.mockResolvedValue({
        data: [],
        status: 'success',
      });

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.stageProgress.full).toBe(true);
        expect(result.current.lotteryFactor).toBe(null);
      });

      expect(calculateLotteryFactorMock).not.toHaveBeenCalled();
    });
  });

  describe('Stage 3: Enhancement data loading', () => {
    it('should load enhancement data in background using requestIdleCallback', async () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Wait for full stage to complete
      await waitFor(() => {
        expect(result.current.stageProgress.full).toBe(true);
      });

      // Wait for enhancement stage
      await waitFor(() => {
        expect(result.current.currentStage).toBe('enhancement');
        expect(result.current.stageProgress.enhancement).toBe(true);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.currentStage).toBe('complete');
        expect(result.current.stageProgress.complete).toBe(true);
        expect(result.current.directCommitsData).toEqual(mockDirectCommitsData);
        expect(result.current.historicalTrends).toBe(null);
      });

      expect(fetchDirectCommitsMock).toHaveBeenCalledWith('owner', 'repo', '90d');
      expect(mockRequestIdleCallback).toHaveBeenCalled();
    });

    it('should use setTimeout fallback when requestIdleCallback is not available', async () => {
      const originalRequestIdleCallback = window.requestIdleCallback;
      delete (window as any).requestIdleCallback;

      vi.useFakeTimers();

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Wait for full stage
      await waitFor(() => {
        expect(result.current.stageProgress.full).toBe(true);
      });

      // Advance timers to trigger fallback
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(result.current.stageProgress.enhancement).toBe(true);
      });

      vi.useRealTimers();
      window.requestIdleCallback = originalRequestIdleCallback;
    });

    it('should handle enhancement data loading errors gracefully', async () => {
      fetchDirectCommitsMock.mockRejectedValue(new Error('API rate limit exceeded'));

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Wait for full stage
      await waitFor(() => {
        expect(result.current.stageProgress.full).toBe(true);
      });

      // Enhancement stage should still complete even with errors
      await waitFor(() => {
        expect(result.current.stageProgress.enhancement).toBe(true);
        expect(result.current.directCommitsData).toBe(null);
      });
    });
  });

  describe('Abort and cleanup', () => {
    it('should abort previous request when parameters change', async () => {
      const { result, rerender } = renderHook(
        ({ owner, repo }) => useProgressiveRepoData(owner, repo, '90d', false),
        { initialProps: { owner: 'owner1', repo: 'repo1' } }
      );

      // Wait for initial loading to start
      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledTimes(2); // Critical + Full stages
      });

      // Change parameters
      rerender({ owner: 'owner2', repo: 'repo2' });

      // Should abort previous and start new request
      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledWith('owner2', 'repo2', {
          timeRange: '90d'
        });
      });
    });

    it('should prevent loading when component unmounts', async () => {
      const { result, unmount } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Start loading
      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalled();
      });

      // Unmount before completion
      unmount();

      // Enhancement stage should not execute after unmount
      expect(fetchDirectCommitsMock).not.toHaveBeenCalled();
    });
  });

  describe('Caching behavior', () => {
    it('should use cached data when available and fresh', async () => {
      // First render to populate cache
      const { unmount: unmount1 } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledTimes(2);
      });

      unmount1();

      // Second render should use cache
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.stageProgress.critical).toBe(true);
      });

      // Should not make additional API calls for cached data
      expect(fetchPRDataMock).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after expiration', async () => {
      vi.useFakeTimers();

      // First render
      const { unmount: unmount1 } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledTimes(2);
      });

      unmount1();

      // Advance time beyond cache duration (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Second render should not use expired cache
      renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledTimes(4); // 2 more calls
      });

      vi.useRealTimers();
    });
  });

  describe('Error scenarios', () => {
    it('should handle network errors during any stage', async () => {
      const networkError = new Error('Network connection failed');
      fetchPRDataMock.mockRejectedValue(networkError);

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Should not crash and should maintain initial state
      await waitFor(() => {
        expect(result.current.basicInfo).toBe(null);
        expect(result.current.stats.loading).toBe(true);
      });
    });

    it('should handle malformed response data', async () => {
      fetchPRDataMock.mockResolvedValue({
        data: null,
        status: 'partial_data',
        message: 'Some data may be missing',
      });

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.dataStatus.status).toBe('no_data');
        expect(result.current.dataStatus.message).toBe('Some data may be missing');
      });
    });
  });

  describe('Different time ranges and options', () => {
    it('should handle different time ranges', async () => {
      const { rerender } = renderHook(
        ({ timeRange }) => useProgressiveRepoData('owner', 'repo', timeRange, false),
        { initialProps: { timeRange: '30d' as const } }
      );

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledWith('owner', 'repo', {
          timeRange: '30d'
        });
      });

      rerender({ timeRange: '1y' as const });

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledWith('owner', 'repo', {
          timeRange: '1y'
        });
      });
    });

    it('should handle includeBots parameter changes', async () => {
      const { rerender } = renderHook(
        ({ includeBots }) => useProgressiveRepoData('owner', 'repo', '90d', includeBots),
        { initialProps: { includeBots: false } }
      );

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalled();
      });

      rerender({ includeBots: true });

      await waitFor(() => {
        expect(fetchPRDataMock).toHaveBeenCalledTimes(4); // New requests for changed parameter
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty repository data gracefully', async () => {
      fetchPRDataMock.mockResolvedValue({
        data: [],
        status: 'success',
        message: 'No pull requests found',
      });

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.basicInfo?.prCount).toBe(0);
        expect(result.current.basicInfo?.contributorCount).toBe(0);
        expect(result.current.basicInfo?.topContributors).toHaveLength(0);
      });
    });

    it('should handle PRs with missing user data', async () => {
      const prDataWithMissingUser = [
        { id: 1, title: 'Test PR', user: null, state: 'open' },
        { id: 2, title: 'Test PR 2', user: { login: 'user1', avatar_url: 'avatar.jpg' }, state: 'merged' },
      ];

      fetchPRDataMock.mockResolvedValue({
        data: prDataWithMissingUser,
        status: 'success',
      });

      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      await waitFor(() => {
        expect(result.current.basicInfo?.contributorCount).toBe(1);
        expect(result.current.basicInfo?.topContributors).toHaveLength(1);
      });
    });
  });
});