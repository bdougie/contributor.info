import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMyWork } from '../use-my-work';
import { supabase } from '@/lib/supabase';
import type { PostgrestFilterBuilder } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock useCurrentUser hook
vi.mock('../use-current-user', () => ({
  useCurrentUser: () => ({
    user: {
      id: 'test-user-id',
      user_metadata: {
        user_name: 'testuser',
      },
    },
  }),
}));

describe('useMyWork - responded_by filter', () => {
  const workspaceId = 'test-workspace-id';
  const mockContributor = {
    id: 'contributor-id',
    avatar_url: 'https://example.com/avatar.jpg',
  };

  const mockWorkspaceRepos = [{ repository_id: 'repo-1' }, { repository_id: 'repo-2' }];

  // Helper to create a mock query builder with synchronous resolution
  const createMockQueryBuilder = (returnData: unknown) => {
    const builder: Partial<PostgrestFilterBuilder<unknown, unknown, unknown>> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      // Return resolved promise synchronously for testing
      maybeSingle: vi.fn(() => Promise.resolve({ data: returnData, error: null })),
    };
    return builder as PostgrestFilterBuilder<unknown, unknown, unknown>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call .is() with responded_by null for issues', () => {
    const mockIssues = [
      {
        id: 'issue-1',
        number: 101,
        title: 'Open Issue Not Responded',
        state: 'open',
        updated_at: '2025-01-15T10:00:00Z',
        assignees: [{ login: 'testuser', avatar_url: 'avatar.jpg', id: 1 }],
        repository_id: 'repo-1',
        author_id: 123,
        repositories: { full_name: 'owner/repo', owner: 'owner', name: 'repo' },
      },
    ];

    // Setup mocks
    const contributorBuilder = createMockQueryBuilder(mockContributor);
    const workspaceReposBuilder = createMockQueryBuilder(mockWorkspaceRepos);
    const issuesBuilder = createMockQueryBuilder(mockIssues);
    const prsBuilder = createMockQueryBuilder([]);
    const discussionsBuilder = createMockQueryBuilder([]);

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'contributors') return contributorBuilder as never;
      if (table === 'workspace_repositories') return workspaceReposBuilder as never;
      if (table === 'issues') return issuesBuilder as never;
      if (table === 'pull_requests') return prsBuilder as never;
      if (table === 'discussions') return discussionsBuilder as never;
      throw new Error(`Unexpected table: ${table}`);
    });

    // Render hook - will trigger queries synchronously
    renderHook(() => useMyWork(workspaceId, 1, 10));

    // Verify issues query called .is('responded_by', null)
    expect(issuesBuilder.is).toHaveBeenCalledWith('responded_by', null);
  });

  it('should call .is() with responded_by null for discussions', () => {
    const mockDiscussions = [
      {
        id: 'discussion-1',
        number: 201,
        title: 'Unanswered Discussion Not Responded',
        updated_at: '2025-01-15T11:00:00Z',
        is_answered: false,
        repository_id: 'repo-1',
        author_login: 'author1',
        author_id: 456,
        repositories: { full_name: 'owner/repo', owner: 'owner', name: 'repo' },
      },
    ];

    // Setup mocks
    const contributorBuilder = createMockQueryBuilder(mockContributor);
    const workspaceReposBuilder = createMockQueryBuilder(mockWorkspaceRepos);
    const authorsBuilder = createMockQueryBuilder([
      { username: 'author1', avatar_url: 'avatar1.jpg' },
    ]);
    const issuesBuilder = createMockQueryBuilder([]);
    const prsBuilder = createMockQueryBuilder([]);
    const discussionsBuilder = createMockQueryBuilder(mockDiscussions);

    let contributorCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'contributors') {
        contributorCallCount++;
        // First call for current user, second for discussion authors
        if (contributorCallCount === 1) return contributorBuilder as never;
        return authorsBuilder as never;
      }
      if (table === 'workspace_repositories') return workspaceReposBuilder as never;
      if (table === 'issues') return issuesBuilder as never;
      if (table === 'pull_requests') return prsBuilder as never;
      if (table === 'discussions') return discussionsBuilder as never;
      throw new Error(`Unexpected table: ${table}`);
    });

    // Render hook
    renderHook(() => useMyWork(workspaceId, 1, 10));

    // Verify discussions query called .is('responded_by', null)
    expect(discussionsBuilder.is).toHaveBeenCalledWith('responded_by', null);
  });

  it('should filter for state=open in issues query', () => {
    const mockIssues = [
      {
        id: 'issue-1',
        number: 101,
        title: 'Open Issue',
        state: 'open',
        updated_at: '2025-01-15T10:00:00Z',
        assignees: [{ login: 'testuser', avatar_url: 'avatar.jpg', id: 1 }],
        repository_id: 'repo-1',
        author_id: 123,
        repositories: { full_name: 'owner/repo', owner: 'owner', name: 'repo' },
      },
    ];

    const contributorBuilder = createMockQueryBuilder(mockContributor);
    const workspaceReposBuilder = createMockQueryBuilder(mockWorkspaceRepos);
    const issuesBuilder = createMockQueryBuilder(mockIssues);
    const prsBuilder = createMockQueryBuilder([]);
    const discussionsBuilder = createMockQueryBuilder([]);

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'contributors') return contributorBuilder as never;
      if (table === 'workspace_repositories') return workspaceReposBuilder as never;
      if (table === 'issues') return issuesBuilder as never;
      if (table === 'pull_requests') return prsBuilder as never;
      if (table === 'discussions') return discussionsBuilder as never;
      throw new Error(`Unexpected table: ${table}`);
    });

    renderHook(() => useMyWork(workspaceId, 1, 10));

    // Verify issues query filters for state='open' AND responded_by IS NULL
    expect(issuesBuilder.eq).toHaveBeenCalledWith('state', 'open');
    expect(issuesBuilder.is).toHaveBeenCalledWith('responded_by', null);
  });

  it('should filter for is_answered=false in discussions query', () => {
    const mockDiscussions = [
      {
        id: 'discussion-1',
        number: 201,
        title: 'Unanswered Discussion',
        updated_at: '2025-01-15T11:00:00Z',
        is_answered: false,
        repository_id: 'repo-1',
        author_login: 'author1',
        author_id: 456,
        repositories: { full_name: 'owner/repo', owner: 'owner', name: 'repo' },
      },
    ];

    const contributorBuilder = createMockQueryBuilder(mockContributor);
    const workspaceReposBuilder = createMockQueryBuilder(mockWorkspaceRepos);
    const authorsBuilder = createMockQueryBuilder([
      { username: 'author1', avatar_url: 'avatar1.jpg' },
    ]);
    const issuesBuilder = createMockQueryBuilder([]);
    const prsBuilder = createMockQueryBuilder([]);
    const discussionsBuilder = createMockQueryBuilder(mockDiscussions);

    let contributorCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'contributors') {
        contributorCallCount++;
        if (contributorCallCount === 1) return contributorBuilder as never;
        return authorsBuilder as never;
      }
      if (table === 'workspace_repositories') return workspaceReposBuilder as never;
      if (table === 'issues') return issuesBuilder as never;
      if (table === 'pull_requests') return prsBuilder as never;
      if (table === 'discussions') return discussionsBuilder as never;
      throw new Error(`Unexpected table: ${table}`);
    });

    renderHook(() => useMyWork(workspaceId, 1, 10));

    // Verify discussions query filters for is_answered=false AND responded_by IS NULL
    expect(discussionsBuilder.eq).toHaveBeenCalledWith('is_answered', false);
    expect(discussionsBuilder.is).toHaveBeenCalledWith('responded_by', null);
  });

  it('should not call supabase.from when workspaceId is undefined', () => {
    renderHook(() => useMyWork(undefined, 1, 10));

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
