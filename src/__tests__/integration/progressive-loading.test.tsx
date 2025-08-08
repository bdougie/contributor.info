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
});