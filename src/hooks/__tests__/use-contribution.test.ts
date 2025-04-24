import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useContribution } from '../use-contribution';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';
import type { PullRequest } from '@/lib/types';

// Create a spy on the ContributionAnalyzer
vi.mock('@/lib/contribution-analyzer', () => {
  return {
    ContributionAnalyzer: {
      resetCounts: vi.fn(),
      analyze: vi.fn(),
      getDistribution: vi.fn(),
      getCounts: vi.fn(),
    }
  };
});

describe('useContribution', () => {
  // Helper function to create mock pull requests
  const createMockPR = (id: number, additions: number, deletions: number, title = 'Test PR'): PullRequest => ({
    id,
    number: id,
    title,
    state: 'closed',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-04-02T10:00:00Z',
    merged_at: '2025-04-02T10:00:00Z',
    additions,
    deletions,
    repository_owner: 'testowner',
    repository_name: 'testrepo',
    user: {
      id: 1001,
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
    }
  });

  // Create some test data
  const mockPRs: PullRequest[] = [
    createMockPR(1, 100, 20, 'Feature PR'),
    createMockPR(2, 20, 100, 'Refinement PR'),
    createMockPR(3, 50, 50, 'Refactoring PR'),
    createMockPR(4, 10, 5, 'Small Fix PR')
  ];

  // Default mock returns
  const mockDistribution = {
    refinement: 25,
    newStuff: 25, 
    refactoring: 25,
    maintenance: 25
  };

  const mockCounts = {
    refinement: 1,
    newStuff: 1,
    refactoring: 1,
    maintenance: 1
  };

  beforeEach(() => {
    // Reset and setup mocks before each test
    vi.clearAllMocks();
    
    // Set up mock return values
    vi.mocked(ContributionAnalyzer.getDistribution).mockReturnValue(mockDistribution);
    vi.mocked(ContributionAnalyzer.getCounts).mockReturnValue(mockCounts);
  });

  // Add cleanup after each test
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useContribution([]));
    
    // Ensure all state updates are processed
    act(() => {});
    
    expect(result.current.distribution).toBeNull();
    expect(result.current.quadrantCounts).toEqual({
      refinement: 0,
      newStuff: 0,
      refactoring: 0,
      maintenance: 0
    });
    expect(result.current.getTotalContributions()).toBe(0);
  });

  it('should not analyze when pullRequests is empty', () => {
    renderHook(() => useContribution([]));
    
    // Ensure all state updates are processed
    act(() => {});
    
    expect(ContributionAnalyzer.resetCounts).not.toHaveBeenCalled();
    expect(ContributionAnalyzer.analyze).not.toHaveBeenCalled();
    expect(ContributionAnalyzer.getDistribution).not.toHaveBeenCalled();
    expect(ContributionAnalyzer.getCounts).not.toHaveBeenCalled();
  });

  it('should analyze PRs and update state', () => {
    const { result } = renderHook(() => useContribution(mockPRs));
    
    // Ensure all state updates are processed
    act(() => {});
    
    // Verify ContributionAnalyzer methods were called
    expect(ContributionAnalyzer.resetCounts).toHaveBeenCalledTimes(1);
    expect(ContributionAnalyzer.analyze).toHaveBeenCalledTimes(mockPRs.length);
    expect(ContributionAnalyzer.getDistribution).toHaveBeenCalledTimes(1);
    expect(ContributionAnalyzer.getCounts).toHaveBeenCalledTimes(1);
    
    // Verify the state was updated
    expect(result.current.distribution).toEqual(mockDistribution);
    expect(result.current.quadrantCounts).toEqual(mockCounts);
  });

  it('should calculate total contributions correctly', () => {
    const { result } = renderHook(() => useContribution(mockPRs));
    
    // Ensure all state updates are processed
    act(() => {});
    
    // The total should be the sum of all counts (1+1+1+1=4)
    expect(result.current.getTotalContributions()).toBe(4);
  });

  it('should reanalyze when pullRequests changes', () => {
    const { rerender } = renderHook(({ pullRequests }) => useContribution(pullRequests), {
      initialProps: { pullRequests: mockPRs }
    });
    
    // Ensure all state updates are processed
    act(() => {});
    
    // First render should have analyzed
    expect(ContributionAnalyzer.resetCounts).toHaveBeenCalledTimes(1);
    expect(ContributionAnalyzer.analyze).toHaveBeenCalledTimes(mockPRs.length);
    
    // Change the PRs
    const newMockPRs = [
      createMockPR(5, 200, 10, 'New Feature PR'),
      createMockPR(6, 10, 200, 'Major Cleanup PR')
    ];
    
    // Rerender with new PRs
    act(() => {
      rerender({ pullRequests: newMockPRs });
    });
    
    // Verify ContributionAnalyzer methods were called again
    expect(ContributionAnalyzer.resetCounts).toHaveBeenCalledTimes(2);
    expect(ContributionAnalyzer.analyze).toHaveBeenCalledTimes(mockPRs.length + newMockPRs.length);
  });

  it('should analyze each PR individually', () => {
    renderHook(() => useContribution(mockPRs));
    
    // Ensure all state updates are processed
    act(() => {});
    
    // Verify each PR was analyzed
    mockPRs.forEach(pr => {
      expect(ContributionAnalyzer.analyze).toHaveBeenCalledWith(pr);
    });
  });
});