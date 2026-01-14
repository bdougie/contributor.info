import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

// Minimal mocking - only what's absolutely necessary
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn(),
}));

vi.mock('@/lib/supabase-pr-data-smart-deduped', () => ({
  fetchPRDataSmart: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn(),
}));

vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

vi.mock('@/lib/retry-utils', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

import { useProgressiveRepoData, useDataStageReady } from '../use-progressive-repo-data';
import type { ProgressiveDataState, LoadingStage } from '../use-progressive-repo-data';
import { setupBasicMocks, cleanupMocks, mockPRData } from './test-utils';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart-deduped';
import { calculateLotteryFactor } from '@/lib/utils';

describe('useProgressiveRepoData - Basic Tests', () => {
  const fetchDirectCommitsMock = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
  const fetchPRDataMock = fetchPRDataSmart as ReturnType<typeof vi.fn>;
  const calculateLotteryFactorMock = calculateLotteryFactor as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupBasicMocks();
    vi.clearAllMocks();

    // Set up default mock return values
    fetchDirectCommitsMock.mockResolvedValue({ commits: [], totalCommits: 0 });
    fetchPRDataMock.mockResolvedValue({
      data: mockPRData,
      status: 'success',
      message: 'Data loaded',
    });
    calculateLotteryFactorMock.mockReturnValue({
      factor: 0.5,
      description: 'Test',
      category: 'balanced',
    });
  });

  afterEach(() => {
    cleanup();
    cleanupMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      expect(result.current.basicInfo).toBe(null);
      expect(result.current.stats.loading).toBe(true);
      expect(result.current.stats.error).toBe(null);
      expect(result.current.stats.pullRequests).toEqual([]);
      expect(result.current.currentStage).toBe('initial');
    });

    it('should not start loading without owner', () => {
      const { result } = renderHook(() => useProgressiveRepoData(undefined, 'repo', '90d', false));

      // When no owner, loading should be true initially but no API calls
      expect(result.current.currentStage).toBe('initial');
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });

    it('should not start loading without repo', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', undefined, '90d', false));

      // When no repo, loading should be true initially but no API calls
      expect(result.current.currentStage).toBe('initial');
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });

    it('should not start loading with empty owner', () => {
      const { result } = renderHook(() => useProgressiveRepoData('', 'repo', '90d', false));

      expect(result.current.currentStage).toBe('initial');
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });

    it('should not start loading with empty repo', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', '', '90d', false));

      expect(result.current.currentStage).toBe('initial');
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });
  });

  describe('Data Status', () => {
    it('should initialize with pending status', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      expect(result.current.dataStatus.status).toBe('pending');
    });

    it('should have initial stage progress as false except critical which starts', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      // Initial and critical may be true since loading starts immediately
      // Other stages should be false
      expect(result.current.stageProgress.full).toBe(false);
      expect(result.current.stageProgress.enhancement).toBe(false);
      expect(result.current.stageProgress.complete).toBe(false);
    });

    it('should have dataStatus with message field as optional', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      // message is optional
      expect(result.current.dataStatus.message).toBeUndefined();
    });
  });

  describe('Return Value Structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      // Check all expected properties exist
      expect(result.current).toHaveProperty('basicInfo');
      expect(result.current).toHaveProperty('stats');
      expect(result.current).toHaveProperty('lotteryFactor');
      expect(result.current).toHaveProperty('directCommitsData');
      expect(result.current).toHaveProperty('historicalTrends');
      expect(result.current).toHaveProperty('currentStage');
      expect(result.current).toHaveProperty('stageProgress');
      expect(result.current).toHaveProperty('dataStatus');
    });

    it('should have correct stats structure', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      expect(result.current.stats).toHaveProperty('pullRequests');
      expect(result.current.stats).toHaveProperty('loading');
      expect(result.current.stats).toHaveProperty('error');
      expect(Array.isArray(result.current.stats.pullRequests)).toBe(true);
      expect(typeof result.current.stats.loading).toBe('boolean');
    });

    it('should have correct stageProgress structure', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      const stages: LoadingStage[] = ['initial', 'critical', 'full', 'enhancement', 'complete'];
      stages.forEach((stage) => {
        expect(result.current.stageProgress).toHaveProperty(stage);
        expect(typeof result.current.stageProgress[stage]).toBe('boolean');
      });
    });

    it('should have dataStatus with correct structure', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      expect(result.current.dataStatus).toHaveProperty('status');
      expect(['success', 'pending', 'no_data', 'partial_data', 'large_repository_protected']).toContain(
        result.current.dataStatus.status
      );
    });
  });

  describe('Parameter Handling', () => {
    it('should accept all valid time ranges', () => {
      const timeRanges = ['30d', '90d', '1y', 'all'] as const;

      timeRanges.forEach((timeRange) => {
        const { result, unmount } = renderHook(() =>
          useProgressiveRepoData('owner', 'repo', timeRange, false)
        );

        // Should initialize without errors
        expect(result.current.currentStage).toBe('initial');
        unmount();
      });
    });

    it('should accept includeBots as true', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', true));

      expect(result.current.currentStage).toBe('initial');
    });

    it('should accept includeBots as false', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      expect(result.current.currentStage).toBe('initial');
    });
  });

  describe('Hook Identity', () => {
    it('should maintain stable reference across renders with same props', () => {
      const { result, rerender } = renderHook(
        ({ owner, repo, timeRange, includeBots }) =>
          useProgressiveRepoData(owner, repo, timeRange, includeBots),
        { initialProps: { owner: 'owner', repo: 'repo', timeRange: '90d' as const, includeBots: false } }
      );

      const initialStageProgress = result.current.stageProgress;

      // Rerender with same props
      rerender({ owner: 'owner', repo: 'repo', timeRange: '90d' as const, includeBots: false });

      // stageProgress should still have the same structure
      expect(Object.keys(result.current.stageProgress)).toEqual(Object.keys(initialStageProgress));
    });
  });

  describe('Type Safety', () => {
    it('should correctly type basicInfo as null initially', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      const basicInfo = result.current.basicInfo;
      expect(basicInfo).toBeNull();
    });

    it('should correctly type lotteryFactor as null initially', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      const lotteryFactor = result.current.lotteryFactor;
      expect(lotteryFactor).toBeNull();
    });

    it('should correctly type directCommitsData as null initially', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      const directCommitsData = result.current.directCommitsData;
      expect(directCommitsData).toBeNull();
    });

    it('should correctly type historicalTrends as null', () => {
      const { result } = renderHook(() => useProgressiveRepoData('owner', 'repo', '90d', false));

      const historicalTrends = result.current.historicalTrends;
      expect(historicalTrends).toBeNull();
    });
  });
});

describe('useDataStageReady', () => {
  it('should return false for incomplete stages', () => {
    const mockData: ProgressiveDataState = {
      basicInfo: null,
      stats: { pullRequests: [], loading: true, error: null },
      lotteryFactor: null,
      directCommitsData: null,
      historicalTrends: null,
      currentStage: 'initial',
      stageProgress: {
        initial: true,
        critical: false,
        full: false,
        enhancement: false,
        complete: false,
      },
      dataStatus: { status: 'pending' },
    };

    expect(useDataStageReady(mockData, 'critical')).toBe(false);
    expect(useDataStageReady(mockData, 'full')).toBe(false);
    expect(useDataStageReady(mockData, 'enhancement')).toBe(false);
    expect(useDataStageReady(mockData, 'complete')).toBe(false);
  });

  it('should return true for completed stages', () => {
    const mockData: ProgressiveDataState = {
      basicInfo: { prCount: 10, contributorCount: 5, topContributors: [] },
      stats: { pullRequests: [], loading: false, error: null },
      lotteryFactor: null,
      directCommitsData: null,
      historicalTrends: null,
      currentStage: 'complete',
      stageProgress: {
        initial: true,
        critical: true,
        full: true,
        enhancement: true,
        complete: true,
      },
      dataStatus: { status: 'success' },
    };

    expect(useDataStageReady(mockData, 'initial')).toBe(true);
    expect(useDataStageReady(mockData, 'critical')).toBe(true);
    expect(useDataStageReady(mockData, 'full')).toBe(true);
    expect(useDataStageReady(mockData, 'enhancement')).toBe(true);
    expect(useDataStageReady(mockData, 'complete')).toBe(true);
  });

  it('should handle partial progress', () => {
    const mockData: ProgressiveDataState = {
      basicInfo: { prCount: 10, contributorCount: 5, topContributors: [] },
      stats: { pullRequests: [], loading: true, error: null },
      lotteryFactor: null,
      directCommitsData: null,
      historicalTrends: null,
      currentStage: 'full',
      stageProgress: {
        initial: true,
        critical: true,
        full: false,
        enhancement: false,
        complete: false,
      },
      dataStatus: { status: 'pending' },
    };

    expect(useDataStageReady(mockData, 'initial')).toBe(true);
    expect(useDataStageReady(mockData, 'critical')).toBe(true);
    expect(useDataStageReady(mockData, 'full')).toBe(false);
  });
});
