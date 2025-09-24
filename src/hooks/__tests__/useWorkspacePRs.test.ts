import { renderHook, waitFor, act } from '@testing-library/react';
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

  const mockPullRequestData = {
    id: 'pr-1',
    github_id: 123,
    number: 1,
    title: 'Test PR',
    state: 'open',
    draft: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    closed_at: null,
    merged_at: null,
    additions: 10,
    deletions: 5,
    changed_files: 2,
    commits: 3,
    html_url: 'https://github.com/test-owner/test-repo/pull/1',
    repository_id: 'repo-1',
    last_synced_at: new Date().toISOString(),
    reviewer_data: {
      requested_reviewers: [],
      reviewers: [
        {
          username: 'reviewer1',
          avatar_url: 'https://example.com/reviewer1.jpg',
          approved: true,
          state: 'APPROVED',
          submitted_at: '2024-01-02T00:00:00Z',
        },
      ],
    },
    repositories: {
      id: 'repo-1',
      name: 'test-repo',
      owner: 'test-owner',
      full_name: 'test-owner/test-repo',
    },
    contributors: {
      username: 'test-author',
      avatar_url: 'https://example.com/author.jpg',
    },
    reviews: [],
  };

  const createMockSupabaseClient = (data: unknown[] = [], error: Error | null = null) => {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data, error }),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Set up default mock implementations
    vi.mocked(syncPullRequestReviewers).mockResolvedValue([]);

    // Default Supabase mock returns empty data
    vi.mocked(supabase.from).mockReturnValue(
      createMockSupabaseClient() as ReturnType<typeof supabase.from>
    );
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

  it('should fetch and transform pull requests from database', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createMockSupabaseClient([mockPullRequestData]) as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pullRequests).toHaveLength(1);
    const pr = result.current.pullRequests[0];
    expect(pr.number).toBe(1);
    expect(pr.title).toBe('Test PR');
    expect(pr.state).toBe('open');
    expect(pr.repository.name).toBe('test-repo');
    expect(pr.author.username).toBe('test-author');
    expect(pr.reviewers).toHaveLength(1);
    expect(pr.reviewers[0].username).toBe('reviewer1');
    expect(pr.reviewers[0].approved).toBe(true);
  });

  it('should handle database fetch errors gracefully', async () => {
    const mockError = new Error('Database error');
    vi.mocked(supabase.from).mockReturnValue(
      createMockSupabaseClient([], mockError) as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch PRs: Database error');
    expect(result.current.pullRequests).toEqual([]);
  });

  it('should filter repositories by selected IDs', async () => {
    const multipleRepos: Repository[] = [
      ...mockRepositories,
      {
        ...mockRepositories[0],
        id: 'repo-2',
        name: 'another-repo',
      },
    ];

    const mockClient = createMockSupabaseClient([]);
    vi.mocked(supabase.from).mockReturnValue(mockClient as ReturnType<typeof supabase.from>);

    renderHook(() =>
      useWorkspacePRs({
        repositories: multipleRepos,
        selectedRepositories: ['repo-1'], // Only select first repo
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    await waitFor(() => {
      expect(mockClient.in).toHaveBeenCalledWith('repository_id', ['repo-1']);
    });
  });

  it('should handle empty repositories gracefully', async () => {
    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: [],
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pullRequests).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(syncPullRequestReviewers).not.toHaveBeenCalled();
  });

  it('should transform PR states correctly', async () => {
    const prStates = [
      { ...mockPullRequestData, id: 'pr-1', merged_at: '2024-01-03T00:00:00Z', state: 'closed' },
      { ...mockPullRequestData, id: 'pr-2', state: 'closed', merged_at: null },
      { ...mockPullRequestData, id: 'pr-3', draft: true, state: 'open' },
      { ...mockPullRequestData, id: 'pr-4', state: 'open', draft: false },
    ];

    vi.mocked(supabase.from).mockReturnValue(
      createMockSupabaseClient(prStates) as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pullRequests[0].state).toBe('merged');
    expect(result.current.pullRequests[1].state).toBe('closed');
    expect(result.current.pullRequests[2].state).toBe('draft');
    expect(result.current.pullRequests[3].state).toBe('open');
  });

  it('should trigger sync when data is stale', async () => {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 2); // 2 hours old

    // Mock for staleness check
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call is staleness check
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ last_synced_at: staleDate.toISOString(), repository_id: 'repo-1' }],
            error: null,
          }),
        } as ReturnType<typeof supabase.from>;
      }
      // Subsequent calls return empty PR list
      return createMockSupabaseClient([]) as ReturnType<typeof supabase.from>;
    });

    renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: true,
        maxStaleMinutes: 60,
      })
    );

    await waitFor(() => {
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

  it('should handle manual refresh', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createMockSupabaseClient([]) as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(syncPullRequestReviewers).not.toHaveBeenCalled();

    // Trigger manual refresh
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
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

  it('should combine reviewer data from multiple sources', async () => {
    const mockPRWithMultipleReviewers = {
      ...mockPullRequestData,
      reviewer_data: {
        requested_reviewers: [
          { username: 'requested1', avatar_url: 'https://example.com/requested1.jpg' },
        ],
        reviewers: [
          {
            username: 'reviewer1',
            avatar_url: 'https://example.com/reviewer1.jpg',
            approved: true,
            state: 'APPROVED',
            submitted_at: '2024-01-02T00:00:00Z',
          },
        ],
      },
      reviews: [
        {
          contributors: {
            username: 'reviewer2',
            avatar_url: 'https://example.com/reviewer2.jpg',
          },
          state: 'COMMENTED',
          submitted_at: '2024-01-03T00:00:00Z',
        },
        {
          contributors: {
            username: 'reviewer1',
            avatar_url: 'https://example.com/reviewer1.jpg',
          },
          state: 'APPROVED',
          submitted_at: '2024-01-04T00:00:00Z',
        },
      ],
    };

    vi.mocked(supabase.from).mockReturnValue(
      createMockSupabaseClient([mockPRWithMultipleReviewers]) as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() =>
      useWorkspacePRs({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const pr = result.current.pullRequests[0];
    // Should have combined reviewers, deduped by username
    expect(pr.reviewers).toHaveLength(2);

    const reviewer1 = pr.reviewers.find((r) => r.username === 'reviewer1');
    const reviewer2 = pr.reviewers.find((r) => r.username === 'reviewer2');

    expect(reviewer1?.approved).toBe(true); // Latest state from reviews
    expect(reviewer2?.state).toBe('COMMENTED');

    expect(pr.requested_reviewers).toHaveLength(1);
    expect(pr.requested_reviewers[0].username).toBe('requested1');
  });
});
