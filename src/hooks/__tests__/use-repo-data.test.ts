import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useRepoData } from '../use-repo-data';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataWithFallback } from '@/lib/supabase-pr-data';
import { calculateLotteryFactor } from '@/lib/utils';
import type { PullRequest } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/supabase-pr-data', () => ({
  fetchPRDataWithFallback: vi.fn(),
}));

vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn(),
}));

describe('useRepoData', () => {
  // Mock data
  const mockPullRequests: PullRequest[] = [
    {
      id: 1,
      number: 101,
      title: 'Fix login issue',
      state: 'closed',
      created_at: '2023-01-10T10:00:00Z',
      updated_at: '2023-01-11T11:00:00Z',
      merged_at: '2023-01-11T12:00:00Z',
      additions: 20,
      deletions: 5,
      repository_owner: 'testorg',
      repository_name: 'testrepo',
      user: {
        id: 123,
        login: 'testuser',
        avatar_url: 'https://example.com/testuser.png',
      },
    },
    {
      id: 2,
      number: 102,
      title: 'Add new feature',
      state: 'closed',
      created_at: '2023-01-15T09:00:00Z',
      updated_at: '2023-01-16T10:00:00Z',
      merged_at: '2023-01-16T11:00:00Z',
      additions: 150,
      deletions: 10,
      repository_owner: 'testorg',
      repository_name: 'testrepo',
      user: {
        id: 123,
        login: 'testuser',
        avatar_url: 'https://example.com/testuser.png',
      },
    },
  ];

  const mockDirectCommits = {
    hasYoloCoders: true,
    yoloCoderStats: [
      {
        login: 'yolocoder',
        avatar_url: 'https://example.com/yolocoder.png',
        directCommits: 15,
        totalCommits: 20,
        directCommitPercentage: 75,
      },
    ],
  };

  const mockLotteryFactor = {
    topContributorsCount: 1,
    totalContributors: 2,
    topContributorsPercentage: 80,
    contributors: [
      {
        login: 'testuser',
        avatar_url: 'https://example.com/testuser.png',
        pullRequests: 2,
        percentage: 80,
      },
    ],
    riskLevel: 'High' as const,
  };

  const mockTimeRange = '30';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock return values
    vi.mocked(fetchPRDataWithFallback).mockResolvedValue({
      data: mockPullRequests,
      status: 'success',
    });
    vi.mocked(fetchDirectCommitsWithDatabaseFallback).mockResolvedValue({
      hasYoloCoders: mockDirectCommits.hasYoloCoders,
      yoloCoderStats: mockDirectCommits.yoloCoderStats,
    });
    vi.mocked(calculateLotteryFactor).mockReturnValue(mockLotteryFactor);
  });

  afterEach(() => {
    cleanup();
  });

  it('should fetch repository data on mount', () => {
    const { result } = renderHook(() => useRepoData('testorg', 'testrepo', mockTimeRange, false));

    // Initial state
    expect(result.current.stats.loading).toBe(true);
    expect(result.current.stats.error).toBe(null);

    // Verify API calls were triggered by the effect
    expect(fetchPRDataWithFallback).toHaveBeenCalledWith('testorg', 'testrepo', mockTimeRange);
    expect(fetchDirectCommitsWithDatabaseFallback).toHaveBeenCalledWith(
      'testorg',
      'testrepo',
      mockTimeRange
    );
  });

  it('should handle API errors', () => {
    const errorMessage = 'Failed to fetch data';
    vi.mocked(fetchPRDataWithFallback).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useRepoData('testorg', 'testrepo', mockTimeRange, false));

    // Verify the erroring call was triggered
    expect(fetchPRDataWithFallback).toHaveBeenCalledWith('testorg', 'testrepo', mockTimeRange);
    expect(result.current.stats.loading).toBe(true);
  });

  it('should not fetch data if owner or repo is undefined', () => {
    renderHook(() => useRepoData(undefined, 'testrepo', mockTimeRange, false));
    renderHook(() => useRepoData('testorg', undefined, mockTimeRange, false));

    expect(fetchPRDataWithFallback).not.toHaveBeenCalled();
    expect(fetchDirectCommitsWithDatabaseFallback).not.toHaveBeenCalled();
  });

  it('should refetch data when inputs change', () => {
    const { rerender } = renderHook(
      (props) => useRepoData(props.owner, props.repo, props.timeRange, props.includeBots),
      {
        initialProps: {
          owner: 'testorg',
          repo: 'testrepo',
          timeRange: mockTimeRange,
          includeBots: false,
        },
      }
    );

    // Verify initial call
    expect(fetchPRDataWithFallback).toHaveBeenCalledWith('testorg', 'testrepo', mockTimeRange);

    // Reset mocks for next test
    vi.clearAllMocks();

    // Update owner
    rerender({
      owner: 'neworg',
      repo: 'testrepo',
      timeRange: mockTimeRange,
      includeBots: false,
    });

    expect(fetchPRDataWithFallback).toHaveBeenCalledWith('neworg', 'testrepo', mockTimeRange);

    // Reset mocks for next test
    vi.clearAllMocks();

    // Update repo
    rerender({
      owner: 'neworg',
      repo: 'newrepo',
      timeRange: mockTimeRange,
      includeBots: false,
    });

    expect(fetchPRDataWithFallback).toHaveBeenCalledWith('neworg', 'newrepo', mockTimeRange);

    // Reset mocks for next test
    vi.clearAllMocks();

    // Update time range
    const newTimeRange = '60';
    rerender({
      owner: 'neworg',
      repo: 'newrepo',
      timeRange: newTimeRange,
      includeBots: false,
    });

    expect(fetchPRDataWithFallback).toHaveBeenCalledWith('neworg', 'newrepo', newTimeRange);

    // Reset mocks for next test
    vi.clearAllMocks();

    // Update includeBots
    rerender({
      owner: 'neworg',
      repo: 'newrepo',
      timeRange: newTimeRange,
      includeBots: true,
    });

    expect(fetchPRDataWithFallback).toHaveBeenCalled();
  });
});
