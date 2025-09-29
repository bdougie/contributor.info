import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncPullRequestReviewers } from '../sync-pr-reviewers';

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock the github-api-adapter to prevent real API calls
vi.mock('@/lib/github-api-adapter', () => ({
  getGitHubAPIAdapter: vi.fn(() => ({
    fetchPullRequestsWithReviewers: vi.fn().mockResolvedValue([]),
  })),
}));

import { supabase } from '@/lib/supabase';

describe('syncPullRequestReviewers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully sync PR reviewers with default options', async () => {
    const mockPRData = [
      {
        github_id: 123,
        number: 1,
        title: 'Test PR',
        state: 'open',
        draft: false,
        repository_owner: 'testowner',
        repository_name: 'testrepo',
        author: {
          username: 'testuser',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        requested_reviewers: [],
        reviewers: [
          {
            username: 'reviewer1',
            avatar_url: 'https://example.com/reviewer1.jpg',
            approved: true,
            state: 'APPROVED',
            submitted_at: '2024-01-01T00:00:00Z',
          },
        ],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        closed_at: null,
        merged_at: null,
      },
    ];

    const mockResponse = {
      data: {
        success: true,
        prs: mockPRData,
        openCount: 1,
        closedCount: 0,
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    const result = await syncPullRequestReviewers('testowner', 'testrepo', 'workspace-123');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-pr-reviewers', {
      body: {
        owner: 'testowner',
        repo: 'testrepo',
        workspace_id: 'workspace-123',
        include_closed: true,
        max_closed_days: 30,
        update_database: true,
      },
    });

    expect(result).toEqual(mockPRData);
    expect(console.log).toHaveBeenCalledWith(
      'Syncing PR reviewers for %s/%s',
      'testowner',
      'testrepo',
      {
        includeClosedPRs: true,
        maxClosedDays: 30,
        useLocalBackoff: false,
      }
    );
    expect(console.log).toHaveBeenCalledWith(
      'Successfully synced %d PRs (%d open, %d closed)',
      1,
      1,
      0
    );
  });

  it('should handle custom sync options', async () => {
    const mockResponse = {
      data: {
        success: true,
        prs: [],
        openCount: 0,
        closedCount: 0,
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    const result = await syncPullRequestReviewers('owner', 'repo', 'workspace-456', {
      includeClosedPRs: false,
      maxClosedDays: 7,
      updateDatabase: false,
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-pr-reviewers', {
      body: {
        owner: 'owner',
        repo: 'repo',
        workspace_id: 'workspace-456',
        include_closed: false,
        max_closed_days: 7,
        update_database: false,
      },
    });

    expect(result).toEqual([]);
  });

  it('should handle edge function errors gracefully', async () => {
    const mockError = new Error('Edge function error');
    const mockResponse = {
      data: null,
      error: mockError,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    const result = await syncPullRequestReviewers('owner', 'repo');

    expect(console.error).toHaveBeenCalledWith(
      'Error syncing PR reviewers via edge function:',
      mockError
    );
    expect(result).toEqual([]); // Should return empty array on error
  });

  it('should handle unsuccessful sync response', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'GitHub token not configured',
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    const result = await syncPullRequestReviewers('owner', 'repo');

    expect(console.error).toHaveBeenCalledWith('Sync failed:', 'GitHub token not configured');
    expect(result).toEqual([]);
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(networkError);

    const result = await syncPullRequestReviewers('owner', 'repo');

    expect(console.error).toHaveBeenCalledWith('Failed to sync PR reviewers:', networkError);
    expect(result).toEqual([]);
  });

  it('should handle large PR datasets', async () => {
    const largePRDataset = Array.from({ length: 100 }, (_, i) => ({
      github_id: i,
      number: i + 1,
      title: `PR ${i + 1}`,
      state: i % 2 === 0 ? 'open' : 'closed',
      draft: false,
      repository_owner: 'owner',
      repository_name: 'repo',
      author: {
        username: `user${i}`,
        avatar_url: `https://example.com/user${i}.jpg`,
      },
      requested_reviewers: [],
      reviewers: [],
      created_at: new Date(2024, 0, i + 1).toISOString(),
      updated_at: new Date(2024, 0, i + 2).toISOString(),
      closed_at: i % 2 === 1 ? new Date(2024, 0, i + 3).toISOString() : null,
      merged_at: null,
    }));

    const mockResponse = {
      data: {
        success: true,
        prs: largePRDataset,
        openCount: 50,
        closedCount: 50,
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    const result = await syncPullRequestReviewers('owner', 'repo', 'workspace-789');

    expect(result).toHaveLength(100);
    expect(console.log).toHaveBeenCalledWith(
      'Successfully synced %d PRs (%d open, %d closed)',
      100,
      50,
      50
    );
  });

  it('should handle missing workspace ID', async () => {
    const mockResponse = {
      data: {
        success: true,
        prs: [],
        openCount: 0,
        closedCount: 0,
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    await syncPullRequestReviewers('owner', 'repo'); // No workspace ID

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-pr-reviewers', {
      body: {
        owner: 'owner',
        repo: 'repo',
        workspace_id: undefined,
        include_closed: true,
        max_closed_days: 30,
        update_database: true,
      },
    });
  });

  it('should handle PR data with team reviewers', async () => {
    const mockPRWithTeams = [
      {
        github_id: 456,
        number: 2,
        title: 'PR with team reviewers',
        state: 'open',
        draft: false,
        repository_owner: 'owner',
        repository_name: 'repo',
        author: {
          username: 'author',
          avatar_url: 'https://example.com/author.jpg',
        },
        requested_reviewers: [
          {
            username: 'team:backend',
            avatar_url: '',
          },
          {
            username: 'individual-reviewer',
            avatar_url: 'https://example.com/reviewer.jpg',
          },
        ],
        reviewers: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        closed_at: null,
        merged_at: null,
      },
    ];

    const mockResponse = {
      data: {
        success: true,
        prs: mockPRWithTeams,
        openCount: 1,
        closedCount: 0,
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse);

    const result = await syncPullRequestReviewers('owner', 'repo');

    expect(result).toEqual(mockPRWithTeams);
    expect(result[0].requested_reviewers).toHaveLength(2);
    expect(result[0].requested_reviewers[0].username).toBe('team:backend');
  });
});
