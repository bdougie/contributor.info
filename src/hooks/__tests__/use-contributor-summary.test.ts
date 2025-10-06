/**
 * Tests for useContributorSummary hook
 * Following bulletproof testing guidelines - synchronous tests only
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useContributorSummary } from '../use-contributor-summary';
import { llmService } from '@/lib/llm/llm-service';
import type { ContributorStats } from '@/lib/types';

// Mock LLM service
vi.mock('@/lib/llm/llm-service', () => ({
  llmService: {
    isAvailable: vi.fn(),
    generateContributorSummary: vi.fn(),
  },
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
});
