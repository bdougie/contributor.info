import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkspacePRs } from '../useWorkspacePRs';
import type { Repository } from '@/components/features/workspace';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/sync-pr-reviewers', () => ({
  syncPullRequestReviewers: vi.fn(),
}));

import { supabase } from '@/lib/supabase';
import { syncPullRequestReviewers } from '@/lib/sync-pr-reviewers';

describe('useWorkspacePRs', () => {
  const mockRepositories: Repository[] = [
    {
      id: 'repo-1',
      name: 'test-repo',
      owner: 'test-owner',
      full_name: 'test-owner/test-repo',
      description: 'Test repository',
      is_private: false,
      stars: 100,
      openIssues: 5,
      defaultBranch: 'main',
      language: 'TypeScript',
      forks: 10,
      watchers: 20,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      workspace_id: 'workspace-123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Set up default mock implementations - return immediately
    vi.mocked(syncPullRequestReviewers).mockReturnValue(Promise.resolve([]));

    // Default Supabase mock returns empty data immediately
    const defaultMockClient = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({ data: [], error: null }),
    };
    // Ensure all chain methods return the mock client itself
    defaultMockClient.select.mockReturnValue(defaultMockClient);
    defaultMockClient.in.mockReturnValue(defaultMockClient);
    vi.mocked(supabase.from).mockReturnValue(defaultMockClient as ReturnType<typeof supabase.from>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: [],
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.pullRequests).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should not sync when repositories are empty', () => {
    renderHook(() =>
      useWorkspacePRs({
        repositories: [],
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    // Should not attempt to sync with empty repositories
    expect(syncPullRequestReviewers).not.toHaveBeenCalled();
  });

  it('should filter repositories by selected IDs', () => {
    const multipleRepos: Repository[] = [
      ...mockRepositories,
      {
        ...mockRepositories[0],
        id: 'repo-2',
        name: 'another-repo',
      },
    ];

    // Create a proper chain mock that returns the same instance for chaining
    const mockClient = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({ data: [], error: null }),
    };
    // Ensure all chain methods return the mock client itself
    mockClient.select.mockReturnValue(mockClient);
    mockClient.in.mockReturnValue(mockClient);
    vi.mocked(supabase.from).mockReturnValue(mockClient as ReturnType<typeof supabase.from>);

    renderHook(() =>
      useWorkspacePRs({
        repositories: multipleRepos,
        selectedRepositories: ['repo-1'], // Only select first repo
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    // Immediate synchronous assertion - no waiting
    expect(mockClient.in).toHaveBeenCalledWith('repository_id', ['repo-1']);
  });

  it.skip('should trigger sync when data is stale', () => {
    // This test requires async behavior which is forbidden by bulletproof testing guidelines
    // The actual sync behavior is tested via e2e tests to avoid test hangs
    // See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md

    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 2); // 2 hours old

    // Mock for staleness check - return stale data immediately
    const staleMockClient = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        data: [{ last_synced_at: staleDate.toISOString(), repository_id: 'repo-1' }],
        error: null,
      }),
    };
    // Ensure all chain methods return the mock client itself
    staleMockClient.select.mockReturnValue(staleMockClient);
    staleMockClient.in.mockReturnValue(staleMockClient);
    vi.mocked(supabase.from).mockReturnValue(staleMockClient as ReturnType<typeof supabase.from>);

    renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: true,
        maxStaleMinutes: 60,
      })
    );

    // NOTE: Cannot assert syncPullRequestReviewers was called because it happens asynchronously
    // and async patterns are forbidden in unit tests to prevent hangs
  });
});
