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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({ data: [], error: null }),
    } as ReturnType<typeof supabase.from>);
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

    const mockClient = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({ data: [], error: null }),
    };
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

  it('should trigger sync when data is stale', () => {
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

    // Immediate synchronous assertion - sync should be triggered
    expect(syncPullRequestReviewers).toHaveBeenCalledWith(
      'test-owner',
      'test-repo',
      'workspace-123',
      {
        includeClosedPRs: true,
        maxClosedDays: 30,
        updateDatabase: true,
      }
    );
  });
});
