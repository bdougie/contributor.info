import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkspaceIssues, issuesAreEqual } from '../useWorkspaceIssues';
import type { Repository } from '@/components/features/workspace';
import type { Issue } from '@/components/features/workspace/WorkspaceIssuesTable';

// Create mock supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  },
};

// Mock dependencies
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/env', () => ({
  env: {
    GITHUB_TOKEN: 'mock-token',
  },
}));

vi.mock('@/lib/sync-workspace-issues', () => ({
  syncWorkspaceIssuesForRepositories: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rate-limiter', () => ({
  executeWithRateLimit: vi.fn().mockResolvedValue([]),
  graphqlRateLimiter: {},
}));

describe('useWorkspaceIssues', () => {
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default Supabase mock returns empty data immediately
    const defaultMockClient = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ data: [], error: null }),
    };
    // Ensure all chain methods return the mock client itself
    defaultMockClient.select.mockReturnValue(defaultMockClient);
    defaultMockClient.in.mockReturnValue(defaultMockClient);
    defaultMockClient.eq.mockReturnValue(defaultMockClient);
    defaultMockClient.or.mockReturnValue(defaultMockClient);
    defaultMockClient.order.mockReturnValue(defaultMockClient);
    vi.mocked(mockSupabase.from).mockReturnValue(
      defaultMockClient as ReturnType<typeof mockSupabase.from>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() =>
      useWorkspaceIssues({
        repositories: [],
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.issues).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isSyncing).toBe(false);
  });

  it('should expose isSyncing state for background sync indicator', () => {
    const { result } = renderHook(() =>
      useWorkspaceIssues({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    // isSyncing should be available in the return type
    expect(typeof result.current.isSyncing).toBe('boolean');
    expect(result.current.isSyncing).toBe(false);
  });

  it('should return empty issues when repositories are empty', () => {
    const { result } = renderHook(() =>
      useWorkspaceIssues({
        repositories: [],
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    // With empty repositories, should set loading to false and return empty array
    expect(result.current.issues).toEqual([]);
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

    // Create a proper chain mock
    const mockClient = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ data: [], error: null }),
    };
    mockClient.select.mockReturnValue(mockClient);
    mockClient.in.mockReturnValue(mockClient);
    mockClient.eq.mockReturnValue(mockClient);
    mockClient.or.mockReturnValue(mockClient);
    mockClient.order.mockReturnValue(mockClient);
    vi.mocked(mockSupabase.from).mockReturnValue(
      mockClient as ReturnType<typeof mockSupabase.from>
    );

    renderHook(() =>
      useWorkspaceIssues({
        repositories: multipleRepos,
        selectedRepositories: ['repo-1'], // Only select first repo
        workspaceId: 'workspace-123',
        autoSyncOnMount: false,
      })
    );

    // Verify the hook filters to only the selected repository
    expect(mockClient.in).toHaveBeenCalledWith('repository_id', ['repo-1']);
  });

  it('should have a refresh function that can be called', () => {
    const { result } = renderHook(() =>
      useWorkspaceIssues({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    expect(typeof result.current.refresh).toBe('function');
  });

  it('should expose lastSynced and isStale properties', () => {
    const { result } = renderHook(() =>
      useWorkspaceIssues({
        repositories: mockRepositories,
        selectedRepositories: [],
        workspaceId: 'workspace-123',
      })
    );

    // These properties should be available for UI to display sync status
    expect('lastSynced' in result.current).toBe(true);
    expect('isStale' in result.current).toBe(true);
  });

  it.skip('should trigger background sync when data is stale', () => {
    // This test requires async behavior which is forbidden by bulletproof testing guidelines
    // The actual background sync behavior is tested via e2e tests to avoid test hangs
    // See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md
    //
    // Key behavior to verify in e2e:
    // 1. Cached data displays immediately (within 500ms)
    // 2. isSyncing becomes true during background sync
    // 3. Issues update when sync completes
    // 4. lastSynced updates after successful sync
  });

  it.skip('should abort sync on unmount to prevent memory leaks', () => {
    // This test requires async behavior and component lifecycle testing
    // which is prone to hanging in unit tests.
    // Memory leak prevention is verified via e2e tests.
    //
    // Key behavior to verify in e2e:
    // 1. Navigate away during sync
    // 2. No console errors about updating unmounted component
    // 3. AbortController properly cancels in-flight requests
  });
});

describe('issuesAreEqual', () => {
  const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
    id: 'issue-1',
    number: 1,
    title: 'Test Issue',
    state: 'open',
    repository: { name: 'test-repo', owner: 'test-owner', avatar_url: '' },
    author: { username: 'testuser', avatar_url: '' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    comments_count: 0,
    labels: [],
    assignees: [],
    url: 'https://github.com/test-owner/test-repo/issues/1',
    responded_by: null,
    responded_at: null,
    ...overrides,
  });

  it('returns true for identical empty arrays', () => {
    expect(issuesAreEqual([], [])).toBe(true);
  });

  it('returns true for arrays with same issues', () => {
    const issues = [createMockIssue({ id: '1', updated_at: '2024-01-01' })];
    const sameIssues = [createMockIssue({ id: '1', updated_at: '2024-01-01' })];
    expect(issuesAreEqual(issues, sameIssues)).toBe(true);
  });

  it('returns false for different lengths', () => {
    const a = [createMockIssue({ id: '1' })];
    const b: Issue[] = [];
    expect(issuesAreEqual(a, b)).toBe(false);
  });

  it('returns false when id differs', () => {
    const a = [createMockIssue({ id: '1', updated_at: '2024-01-01' })];
    const b = [createMockIssue({ id: '2', updated_at: '2024-01-01' })];
    expect(issuesAreEqual(a, b)).toBe(false);
  });

  it('returns false when updated_at differs', () => {
    const a = [createMockIssue({ id: '1', updated_at: '2024-01-01' })];
    const b = [createMockIssue({ id: '1', updated_at: '2024-01-02' })];
    expect(issuesAreEqual(a, b)).toBe(false);
  });

  it('returns true for multiple issues with same ids and updated_at', () => {
    const a = [
      createMockIssue({ id: '1', updated_at: '2024-01-01' }),
      createMockIssue({ id: '2', updated_at: '2024-01-02' }),
    ];
    const b = [
      createMockIssue({ id: '1', updated_at: '2024-01-01' }),
      createMockIssue({ id: '2', updated_at: '2024-01-02' }),
    ];
    expect(issuesAreEqual(a, b)).toBe(true);
  });

  it('returns false when order differs', () => {
    const a = [
      createMockIssue({ id: '1', updated_at: '2024-01-01' }),
      createMockIssue({ id: '2', updated_at: '2024-01-02' }),
    ];
    const b = [
      createMockIssue({ id: '2', updated_at: '2024-01-02' }),
      createMockIssue({ id: '1', updated_at: '2024-01-01' }),
    ];
    expect(issuesAreEqual(a, b)).toBe(false);
  });
});
