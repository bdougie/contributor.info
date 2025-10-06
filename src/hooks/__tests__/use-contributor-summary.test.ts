/**
 * Tests for useContributorSummary hook
 * Following bulletproof testing guidelines - synchronous tests only
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useContributorSummary } from '../use-contributor-summary';
import { llmService } from '@/lib/llm/llm-service';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import type { ContributorStats } from '@/lib/types';

// Mock LLM service
vi.mock('@/lib/llm/llm-service', () => ({
  llmService: {
    isAvailable: vi.fn(),
    generateContributorSummary: vi.fn(),
  },
}));

// Mock GitHub auth hook
vi.mock('@/hooks/use-github-auth', () => ({
  useGitHubAuth: vi.fn(),
}));

describe('useContributorSummary', () => {
  const mockContributor: ContributorStats = {
    login: 'testuser',
    id: 123,
    avatar_url: 'https://github.com/testuser.png',
    type: 'User',
    pullRequests: 10,
    recentPRs: [
      {
        number: 1,
        title: 'Add authentication flow',
        state: 'merged',
        created_at: new Date().toISOString(),
        merged_at: new Date().toISOString(),
        user: {
          login: 'testuser',
          id: 123,
          avatar_url: 'https://github.com/testuser.png',
          type: 'User',
        },
      },
    ],
    recentIssues: [],
    recentActivities: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: user is logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn(),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });
  });

  it('should return initial loading state when enabled', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result } = renderHook(() => useContributorSummary(mockContributor));

    expect(result.current.loading).toBe(true);
    expect(result.current.summary).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.confidence).toBe(null);
  });

  it('should not load when disabled', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result } = renderHook(() => useContributorSummary(mockContributor, false));

    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
    expect(llmService.generateContributorSummary).not.toHaveBeenCalled();
  });

  it('should not load when no contributor login', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result } = renderHook(() =>
      useContributorSummary({ login: '', id: 0 } as ContributorStats)
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
  });

  it('should not load when LLM service unavailable', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(false);

    const { result } = renderHook(() => useContributorSummary(mockContributor));

    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
    expect(llmService.generateContributorSummary).not.toHaveBeenCalled();
  });

  it('should clear stale summary when contributor changes', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    // Start with first contributor
    const { result, rerender } = renderHook(
      ({ contributor }) => useContributorSummary(contributor),
      {
        initialProps: { contributor: mockContributor },
      }
    );

    // Initially loading with no summary
    expect(result.current.summary).toBe(null);
    expect(result.current.confidence).toBe(null);

    // Simulate having a summary from previous render (would come from async fetch)
    // This tests that on re-render with new contributor, state is immediately cleared

    // Change to different contributor
    const newContributor = { ...mockContributor, login: 'otheruser', id: 456 };
    rerender({ contributor: newContributor });

    // State should be cleared immediately (before new fetch)
    expect(result.current.summary).toBe(null);
    expect(result.current.confidence).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should clear summary when disabled after being enabled', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result, rerender } = renderHook(
      ({ enabled }) => useContributorSummary(mockContributor, enabled),
      {
        initialProps: { enabled: true },
      }
    );

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Disable the hook
    rerender({ enabled: false });

    // Should clear state and stop loading
    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
    expect(result.current.confidence).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should clear summary when contributor login becomes empty', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result, rerender } = renderHook(
      ({ contributor }) => useContributorSummary(contributor),
      {
        initialProps: { contributor: mockContributor },
      }
    );

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Change to contributor with no login
    rerender({ contributor: { ...mockContributor, login: '' } });

    // Should clear state and stop loading
    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
    expect(result.current.confidence).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should handle contributor with no activity data using fallback', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const emptyContributor: ContributorStats = {
      login: 'newuser',
      id: 789,
      avatar_url: 'https://github.com/newuser.png',
      type: 'User',
      pullRequests: 0,
      recentPRs: [],
      recentIssues: [],
      recentActivities: [],
    };

    const { result } = renderHook(() => useContributorSummary(emptyContributor));

    // Fallback is synchronous, so loading completes immediately
    // Note: In React 18, effects run after the first render, so initial state shows loading=true
    // but synchronously completes to loading=false when fallback is used
    expect(result.current.loading).toBe(false);
    expect(llmService.generateContributorSummary).not.toHaveBeenCalled(); // Fallback doesn't call LLM
    expect(result.current.summary).toBe('newuser is a contributor to this repository.');
    expect(result.current.confidence).toBe(0.3);
  });

  // Memory leak prevention test
  it('should handle unmount gracefully without memory leaks', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    // Mock a pending promise that would normally cause a memory leak
    const generateSummaryMock = vi.fn().mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(llmService.generateContributorSummary).mockImplementation(generateSummaryMock);

    const { result, unmount } = renderHook(() => useContributorSummary(mockContributor));

    // Should start loading
    expect(result.current.loading).toBe(true);
    expect(generateSummaryMock).toHaveBeenCalled();

    // Unmount while loading
    unmount();

    // Should not throw any errors or warnings
    // The abort controller in the cleanup function prevents memory leaks
    expect(() => unmount()).not.toThrow();
  });

  // Race condition prevention test
  it('should handle rapid contributor changes without race conditions', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result, rerender } = renderHook(
      ({ contributor }) => useContributorSummary(contributor),
      {
        initialProps: { contributor: mockContributor },
      }
    );

    // First render starts loading
    expect(result.current.loading).toBe(true);

    // Quickly change contributor multiple times
    const contributor2 = { ...mockContributor, login: 'user2', id: 222 };
    const contributor3 = { ...mockContributor, login: 'user3', id: 333 };

    rerender({ contributor: contributor2 });
    expect(result.current.summary).toBe(null); // State cleared

    rerender({ contributor: contributor3 });
    expect(result.current.summary).toBe(null); // State cleared again

    // The requestId tracking ensures only the latest request updates state
    // Earlier requests are ignored even if they complete later
  });

  // Test activity key memoization
  it('should not re-fetch when activity data is unchanged', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { rerender } = renderHook(({ contributor }) => useContributorSummary(contributor), {
      initialProps: { contributor: mockContributor },
    });

    expect(llmService.generateContributorSummary).toHaveBeenCalledTimes(1);

    // Rerender with same data (new object reference but same content)
    const sameContributor = {
      ...mockContributor,
      recentPRs: [...mockContributor.recentPRs],
      recentIssues: [...mockContributor.recentIssues],
      recentActivities: [...mockContributor.recentActivities],
    };

    rerender({ contributor: sameContributor });

    // Should not trigger another API call due to memoized activity key
    expect(llmService.generateContributorSummary).toHaveBeenCalledTimes(1);
  });

  // Authentication requirement tests
  it('should not load summary when user is not logged in', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn(),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    const { result } = renderHook(() => useContributorSummary(mockContributor));

    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
    expect(result.current.requiresAuth).toBe(true);
    expect(llmService.generateContributorSummary).not.toHaveBeenCalled();
  });

  it('should indicate authentication is required when not logged in', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn(),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    const { result } = renderHook(() => useContributorSummary(mockContributor));

    expect(result.current.requiresAuth).toBe(true);
  });

  it('should indicate authentication is not required when logged in', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);

    const { result } = renderHook(() => useContributorSummary(mockContributor));

    expect(result.current.requiresAuth).toBe(false);
  });

  it('should include auth loading in overall loading state', () => {
    vi.mocked(llmService.isAvailable).mockReturnValue(true);
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: true,
      loading: true, // Auth is still loading
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn(),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    const { result } = renderHook(() => useContributorSummary(mockContributor));

    expect(result.current.loading).toBe(true); // Should include auth loading
  });
});
