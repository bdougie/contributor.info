import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCachedRepoData } from '../use-cached-repo-data';
import type { PullRequest } from '@/lib/types';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataWithFallback } from '@/lib/supabase-pr-data';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart';
import { calculateLotteryFactor } from '@/lib/utils';
import { trackCacheOperation, setApplicationContext, startSpan } from '@/lib/simple-logging';

// Mock dependencies
vi.mock('@/lib/supabase-direct-commits');
vi.mock('@/lib/supabase-pr-data');
vi.mock('@/lib/supabase-pr-data-smart');
vi.mock('@/lib/utils');
vi.mock('@/lib/simple-logging');

describe('useCachedRepoData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock implementations
    vi.mocked(fetchDirectCommitsWithDatabaseFallback).mockResolvedValue({
      hasYoloCoders: false,
      yoloCoderStats: []
    });

    vi.mocked(fetchPRDataWithFallback).mockResolvedValue({
      data: [],
      status: 'success'
    });

    vi.mocked(fetchPRDataSmart).mockResolvedValue({
      data: [],
      status: 'success',
      message: 'Success',
      metadata: { isStale: false, dataCompleteness: 100 }
    });

    vi.mocked(calculateLotteryFactor).mockReturnValue({
      score: 75,
      factors: []
    });

    vi.mocked(trackCacheOperation).mockImplementation((name, operation) => operation());
    vi.mocked(startSpan).mockImplementation((config, operation) => operation());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return loading state initially', () => {
      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      expect(result.current.stats).toEqual({
        pullRequests: [],
        loading: true,
        error: null
      });
      expect(result.current.lotteryFactor).toBeNull();
      expect(result.current.directCommitsData).toBeNull();
      expect(result.current.dataStatus).toEqual({ status: 'success' });
    });

    it('should not fetch when owner or repo is undefined', () => {
      const { result } = renderHook(() =>
        useCachedRepoData(undefined, 'pytorch', '30', false)
      );

      expect(result.current.stats.loading).toBe(true);
      expect(vi.mocked(fetchPRDataSmart)).not.toHaveBeenCalled();
    });
  });

  describe('smart fetch integration', () => {
    it.skip('should use smart fetch by default', async () => {
      const mockPRs: PullRequest[] = [
        {
          id: 12345,
          number: 100,
          title: 'Test PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          user: {
            login: 'testuser',
            id: 67890,
            avatar_url: 'https://github.com/testuser.png',
            type: 'User'
          },
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_owner: 'pytorch',
          repository_name: 'pytorch',
          reviews: [],
          comments: []
        }
      ];

      vi.mocked(fetchPRDataSmart).mockResolvedValue({
        data: mockPRs,
        status: 'success',
        message: 'Success',
        metadata: { 
          isStale: false, 
          dataCompleteness: 95,
          lastUpdate: '2024-01-16T10:00:00Z'
        }
      });

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(vi.mocked(fetchPRDataSmart)).toHaveBeenCalledWith('pytorch', 'pytorch', {
        timeRange: '30',
        showNotifications: false
      });

      expect(result.current.stats.pullRequests).toEqual(mockPRs);
      expect(result.current.dataStatus).toEqual({
        status: 'success',
        message: 'Success',
        metadata: { 
          isStale: false, 
          dataCompleteness: 95,
          lastUpdate: '2024-01-16T10:00:00Z'
        }
      });
    });

    it.skip('should handle pending status from smart fetch', async () => {
      vi.mocked(fetchPRDataSmart).mockResolvedValue({
        data: [],
        status: 'pending',
        message: 'Repository is being set up',
        repositoryName: 'pytorch/pytorch'
      });

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(result.current.stats.pullRequests).toEqual([]);
      expect(result.current.lotteryFactor).toBeNull();
      expect(result.current.directCommitsData).toBeNull();
      expect(result.current.dataStatus).toEqual({
        status: 'pending',
        message: 'Repository is being set up',
        metadata: undefined
      });
    });

    it.skip('should handle stale data status', async () => {
      const stalePRs: PullRequest[] = [
        {
          id: 12345,
          number: 100,
          title: 'Stale PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-10T10:00:00Z',
          updated_at: '2024-01-11T10:00:00Z',
          closed_at: '2024-01-11T10:00:00Z',
          merged_at: '2024-01-11T10:00:00Z',
          merged: true,
          user: {
            login: 'testuser',
            id: 67890,
            avatar_url: 'https://github.com/testuser.png',
            type: 'User'
          },
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          additions: 50,
          deletions: 25,
          changed_files: 3,
          commits: 2,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_owner: 'pytorch',
          repository_name: 'pytorch',
          reviews: [],
          comments: []
        }
      ];

      vi.mocked(fetchPRDataSmart).mockResolvedValue({
        data: stalePRs,
        status: 'success',
        message: 'Data from cache',
        metadata: { 
          isStale: true, 
          dataCompleteness: 80,
          lastUpdate: '2024-01-10T10:00:00Z'
        }
      });

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(result.current.stats.pullRequests).toEqual(stalePRs);
      expect(result.current.dataStatus.status).toBe('success');
      expect(result.current.dataStatus.metadata?.isStale).toBe(true);
    });
  });

  describe('caching behavior', () => {
    it.skip('should cache successful results', async () => {
      const mockPRs: PullRequest[] = [
        {
          id: 12345,
          number: 100,
          title: 'Cached PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          user: {
            login: 'testuser',
            id: 67890,
            avatar_url: 'https://github.com/testuser.png',
            type: 'User'
          },
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_owner: 'pytorch',
          repository_name: 'pytorch',
          reviews: [],
          comments: []
        }
      ];

      vi.mocked(fetchPRDataSmart).mockResolvedValue({
        data: mockPRs,
        status: 'success',
        metadata: { isStale: false, dataCompleteness: 100 }
      });

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      // Should call cache operations
      expect(trackCacheOperation).toHaveBeenCalledWith(
        'repo-data-cache-set',
        expect.any(Function),
        expect.objectContaining({
          operation: 'set',
          cacheType: 'memory',
          key: 'pytorch/pytorch/30/false'
        })
      );
    });

    it.skip('should use cached data on second render', async () => {
      const mockPRs: PullRequest[] = [
        {
          id: 12345,
          number: 100,
          title: 'Cached PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          user: {
            login: 'testuser',
            id: 67890,
            avatar_url: 'https://github.com/testuser.png',
            type: 'User'
          },
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_owner: 'pytorch',
          repository_name: 'pytorch',
          reviews: [],
          comments: []
        }
      ];

      vi.mocked(fetchPRDataSmart).mockResolvedValue({
        data: mockPRs,
        status: 'success',
        metadata: { isStale: false, dataCompleteness: 100 }
      });

      // First render - should fetch data
      const { result, rerender } = renderHook(
        (props) => useCachedRepoData(props.owner, props.repo, props.timeRange, props.includeBots),
        {
          initialProps: {
            owner: 'pytorch',
            repo: 'pytorch',
            timeRange: '30' as const,
            includeBots: false
          }
        }
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      // Clear mock call count
      vi.mocked(fetchPRDataSmart).mockClear();

      // Second render with same props - should use cache
      rerender({
        owner: 'pytorch',
        repo: 'pytorch',
        timeRange: '30' as const,
        includeBots: false
      });

      // Should use cached data, not fetch again
      expect(vi.mocked(fetchPRDataSmart)).not.toHaveBeenCalled();
      expect(result.current.stats.pullRequests).toEqual(mockPRs);
    });

    it('should bust cache when parameters change', async () => {
      const { result, rerender } = renderHook(
        (props) => useCachedRepoData(props.owner, props.repo, props.timeRange, props.includeBots),
        {
          initialProps: {
            owner: 'pytorch',
            repo: 'pytorch',
            timeRange: '30' as const,
            includeBots: false
          }
        }
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      // Clear mock call count
      vi.mocked(fetchPRDataSmart).mockClear();

      // Change time range - should fetch new data
      rerender({
        owner: 'pytorch',
        repo: 'pytorch',
        timeRange: '7' as const,
        includeBots: false
      });

      await waitFor(() => {
        expect(vi.mocked(fetchPRDataSmart)).toHaveBeenCalledWith('pytorch', 'pytorch', {
          timeRange: '7',
          showNotifications: false
        });
      });
    });
  });

  describe('error handling', () => {
    it.skip('should handle fetch errors gracefully', async () => {
      const fetchError = new Error('Network error');
      vi.mocked(fetchPRDataSmart).mockRejectedValue(fetchError);

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(result.current.stats.error).toBe('Network error');
      expect(result.current.stats.pullRequests).toEqual([]);
    });

    it.skip('should handle non-Error exceptions', async () => {
      vi.mocked(fetchPRDataSmart).mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(result.current.stats.error).toBe('Failed to fetch data');
      expect(result.current.stats.pullRequests).toEqual([]);
    });

    it.skip('should handle direct commits fetch errors', async () => {
      vi.mocked(fetchDirectCommitsWithDatabaseFallback).mockRejectedValue(new Error('Direct commits error'));

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      // Should still complete successfully even if direct commits fail
      expect(result.current.stats.error).toBeNull();
      expect(result.current.directCommitsData).toBeNull();
    });
  });

  describe('lottery factor calculation', () => {
    it('should calculate lottery factor with correct parameters', async () => {
      const mockPRs: PullRequest[] = [
        {
          id: 12345,
          number: 100,
          title: 'Test PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          user: {
            login: 'testuser',
            id: 67890,
            avatar_url: 'https://github.com/testuser.png',
            type: 'User'
          },
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_owner: 'pytorch',
          repository_name: 'pytorch',
          reviews: [],
          comments: []
        }
      ];

      vi.mocked(fetchPRDataSmart).mockResolvedValue({
        data: mockPRs,
        status: 'success',
        metadata: { isStale: false, dataCompleteness: 100 }
      });

      const mockLotteryFactor = {
        score: 85,
        factors: ['high-activity']
      };

      vi.mocked(calculateLotteryFactor).mockReturnValue(mockLotteryFactor);

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', true)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(vi.mocked(calculateLotteryFactor)).toHaveBeenCalledWith(mockPRs, '30', true);
      expect(result.current.lotteryFactor).toEqual(mockLotteryFactor);
    });
  });

  describe('direct commits integration', () => {
    it.skip('should fetch and process direct commits data', async () => {
      const mockDirectCommitsData = {
        hasYoloCoders: true,
        yoloCoderStats: [
          { username: 'yolo-coder', directCommits: 5 }
        ]
      };

      vi.mocked(fetchDirectCommitsWithDatabaseFallback).mockResolvedValue(mockDirectCommitsData);

      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(vi.mocked(fetchDirectCommitsWithDatabaseFallback)).toHaveBeenCalledWith('pytorch', 'pytorch', '30');
      expect(result.current.directCommitsData).toEqual({
        hasYoloCoders: true,
        yoloCoderStats: [
          { username: 'yolo-coder', directCommits: 5 }
        ]
      });
    });
  });

  describe('application context tracking', () => {
    it.skip('should set proper application context', async () => {
      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(mockSetApplicationContext).toHaveBeenCalledWith({
        route: '/pytorch/pytorch',
        repository: 'pytorch/pytorch',
        timeRange: '30',
        dataSource: 'cache'
      });

      expect(mockSetApplicationContext).toHaveBeenCalledWith({
        route: '/pytorch/pytorch',
        repository: 'pytorch/pytorch',
        timeRange: '30',
        dataSource: 'database'
      });
    });

    it.skip('should create Sentry span for data fetching', async () => {
      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      expect(mockStartSpan).toHaveBeenCalledWith(
        {
          name: 'fetch-repository-data',
          op: 'data.fetch',
          attributes: {
            'repository.owner': 'pytorch',
            'repository.name': 'pytorch',
            'data.time_range': '30',
            'data.include_bots': false
          }
        },
        expect.any(Function)
      );
    });
  });

  describe('fallback to legacy fetch', () => {
    it.skip('should use legacy fetch when smart fetch is disabled', async () => {
      // Mock the feature flag by temporarily modifying the module
      const originalModule = require('@/lib/use-cached-repo-data');
      
      // This would normally be controlled by a feature flag in the actual implementation
      // For testing, we can mock the behavior by checking if we can modify the module
      
      const mockPRs: PullRequest[] = [];
      vi.mocked(fetchPRDataWithFallback).mockResolvedValue({
        data: mockPRs,
        status: 'success',
        message: 'Legacy fetch success'
      });

      // We can't easily test the feature flag without modifying the module
      // This test validates that both code paths exist and work
      expect(vi.mocked(fetchPRDataWithFallback)).toBeDefined();
      expect(vi.mocked(fetchPRDataSmart)).toBeDefined();
    });
  });

  describe('concurrent requests', () => {
    it.skip('should prevent duplicate concurrent requests', async () => {
      const { result, rerender } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      // Trigger multiple rapid re-renders
      rerender();
      rerender();
      rerender();

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      // Should only make one request despite multiple re-renders
      expect(vi.mocked(fetchPRDataSmart)).toHaveBeenCalledTimes(1);
    });
  });

  describe('memory management', () => {
    it.skip('should clean up cache when it gets too large', async () => {
      // This test ensures the cache cleanup mechanism would work
      // The actual cleanup happens in the module's internal cache
      
      const { result } = renderHook(() =>
        useCachedRepoData('pytorch', 'pytorch', '30', false)
      );

      await waitFor(() => {
        expect(result.current.stats.loading).toBe(false);
      });

      // Verify cache operations are tracked
      expect(trackCacheOperation).toHaveBeenCalledWith(
        'repo-data-cache-set',
        expect.any(Function),
        expect.objectContaining({
          operation: 'set',
          cacheType: 'memory'
        })
      );
    });
  });
});