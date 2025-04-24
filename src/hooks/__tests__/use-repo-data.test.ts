import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useRepoData } from '../use-repo-data';
import { fetchPullRequests, fetchDirectCommits } from '@/lib/github';
import { calculateLotteryFactor } from '@/lib/utils';
import type { PullRequest } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/github', () => ({
  fetchPullRequests: vi.fn(),
  fetchDirectCommits: vi.fn()
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn()
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
        avatar_url: 'https://example.com/testuser.png'
      }
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
        avatar_url: 'https://example.com/testuser.png'
      }
    }
  ];

  const mockDirectCommits = {
    hasYoloCoders: true,
    yoloCoderStats: [
      {
        login: 'yolocoder',
        avatar_url: 'https://example.com/yolocoder.png',
        directCommits: 15,
        totalPushedCommits: 20
      }
    ]
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
        percentage: 80
      }
    ],
    riskLevel: 'High' as const
  };

  const mockTimeRange = "30";

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock return values
    vi.mocked(fetchPullRequests).mockResolvedValue(mockPullRequests);
    vi.mocked(fetchDirectCommits).mockResolvedValue({
      hasYoloCoders: mockDirectCommits.hasYoloCoders,
      yoloCoderStats: mockDirectCommits.yoloCoderStats,
      directCommits: [] // Adding required property for the interface
    });
    vi.mocked(calculateLotteryFactor).mockReturnValue(mockLotteryFactor);
  });

  afterEach(() => {
    cleanup();
  });

  it('should fetch repository data on mount', async () => {
    const { result } = renderHook(() => 
      useRepoData('testorg', 'testrepo', mockTimeRange, false)
    );
    
    // Initial state
    expect(result.current.stats.loading).toBe(true);
    expect(result.current.stats.error).toBe(null);
    
    // Wait for data to be fetched
    await vi.waitFor(() => {
      expect(result.current.stats.loading).toBe(false);
    });
    
    // Verify API calls
    expect(fetchPullRequests).toHaveBeenCalledWith('testorg', 'testrepo', mockTimeRange);
    expect(fetchDirectCommits).toHaveBeenCalledWith('testorg', 'testrepo', mockTimeRange);
    expect(calculateLotteryFactor).toHaveBeenCalledWith(mockPullRequests, mockTimeRange, false);
    
    // Check final state
    expect(result.current.stats.pullRequests).toEqual(mockPullRequests);
    expect(result.current.lotteryFactor).toEqual(mockLotteryFactor);
    expect(result.current.directCommitsData).toEqual({
      hasYoloCoders: mockDirectCommits.hasYoloCoders,
      yoloCoderStats: mockDirectCommits.yoloCoderStats
    });
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch data';
    vi.mocked(fetchPullRequests).mockRejectedValue(new Error(errorMessage));
    
    const { result } = renderHook(() => 
      useRepoData('testorg', 'testrepo', mockTimeRange, false)
    );
    
    // Wait for the error to be processed
    await vi.waitFor(() => {
      expect(result.current.stats.loading).toBe(false);
    });
    
    // Check error state
    expect(result.current.stats.error).toBe(errorMessage);
  });

  it('should not fetch data if owner or repo is undefined', () => {
    renderHook(() => useRepoData(undefined, 'testrepo', mockTimeRange, false));
    renderHook(() => useRepoData('testorg', undefined, mockTimeRange, false));
    
    expect(fetchPullRequests).not.toHaveBeenCalled();
    expect(fetchDirectCommits).not.toHaveBeenCalled();
  });

  it('should refetch data when inputs change', async () => {
    const { result, rerender } = renderHook(
      (props) => useRepoData(props.owner, props.repo, props.timeRange, props.includeBots),
      {
        initialProps: {
          owner: 'testorg',
          repo: 'testrepo',
          timeRange: mockTimeRange,
          includeBots: false
        }
      }
    );
    
    // Wait for initial fetch
    await vi.waitFor(() => {
      expect(result.current.stats.loading).toBe(false);
    });
    
    // Verify initial call
    expect(fetchPullRequests).toHaveBeenCalledWith('testorg', 'testrepo', mockTimeRange);
    
    // Reset mocks for next test
    vi.clearAllMocks();
    
    // Update owner
    rerender({
      owner: 'neworg',
      repo: 'testrepo',
      timeRange: mockTimeRange,
      includeBots: false
    });
    
    // Wait for refetch - need longer timeout
    await vi.waitFor(() => {
      expect(fetchPullRequests).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    expect(fetchPullRequests).toHaveBeenCalledWith('neworg', 'testrepo', mockTimeRange);
    
    // Reset mocks for next test
    vi.clearAllMocks();
    
    // Update repo
    rerender({
      owner: 'neworg',
      repo: 'newrepo',
      timeRange: mockTimeRange,
      includeBots: false
    });
    
    // Wait for refetch
    await vi.waitFor(() => {
      expect(fetchPullRequests).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    expect(fetchPullRequests).toHaveBeenCalledWith('neworg', 'newrepo', mockTimeRange);
    
    // Reset mocks for next test
    vi.clearAllMocks();
    
    // Update time range
    const newTimeRange = "60";
    rerender({
      owner: 'neworg',
      repo: 'newrepo',
      timeRange: newTimeRange,
      includeBots: false
    });
    
    // Wait for refetch
    await vi.waitFor(() => {
      expect(fetchPullRequests).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    expect(fetchPullRequests).toHaveBeenCalledWith('neworg', 'newrepo', newTimeRange);
    
    // Reset mocks for next test
    vi.clearAllMocks();
    
    // Update includeBots
    rerender({
      owner: 'neworg',
      repo: 'newrepo',
      timeRange: newTimeRange,
      includeBots: true
    });
    
    // First ensure that fetchPullRequests is called
    await vi.waitFor(() => {
      expect(fetchPullRequests).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Then wait for calculateLotteryFactor to be called with the new includeBots value
    await vi.waitFor(() => {
      expect(calculateLotteryFactor).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        true
      );
    }, { timeout: 3000 });
  });
});