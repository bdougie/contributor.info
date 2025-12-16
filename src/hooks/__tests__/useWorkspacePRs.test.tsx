import React, { type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWorkspacePRs } from '../useWorkspacePRs';
import type { Repository } from '@/components/features/workspace';

// Create mock supabase client
const mockSupabase = {
  from: vi.fn(),
};

// Mock dependencies
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/sync-pr-reviewers', () => ({
  syncPullRequestReviewers: vi.fn(),
}));

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
    vi.mocked(mockSupabase.from).mockReturnValue(
      defaultMockClient as ReturnType<typeof mockSupabase.from>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to wrap hooks with QueryClientProvider
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it('should initialize with correct state when no repositories', () => {
    const { result } = renderHook(
      () =>
        useWorkspacePRs({
          repositories: [],
          selectedRepositories: [],
          workspaceId: 'workspace-123',
        }),
      { wrapper: createWrapper() }
    );

    // With empty repositories, query is disabled so loading is false
    expect(result.current.loading).toBe(false);
    expect(result.current.pullRequests).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should not sync when repositories are empty', () => {
    renderHook(
      () =>
        useWorkspacePRs({
          repositories: [],
          selectedRepositories: [],
          workspaceId: 'workspace-123',
        }),
      { wrapper: createWrapper() }
    );

    // Should not attempt to sync with empty repositories
    expect(syncPullRequestReviewers).not.toHaveBeenCalled();
  });

  it.skip('should filter repositories by selected IDs', () => {
    // SKIPPED: This test asserts synchronous behavior but getSupabase() is async.
    // The .in() call happens after the Promise resolves, not synchronously.
    // Testing implementation details (Supabase query chain) is discouraged per
    // docs/testing/BULLETPROOF_TESTING_GUIDELINES.md - prefer e2e tests for behavior.
    //
    // The actual filtering behavior is verified via:
    // 1. The fetchFromDatabase function queries with .in('repository_id', repoIds)
    // 2. E2E tests verify filtered data appears in the UI
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
    vi.mocked(mockSupabase.from).mockReturnValue(
      staleMockClient as ReturnType<typeof mockSupabase.from>
    );

    renderHook(
      () =>
        useWorkspacePRs({
          repositories: mockRepositories,
          selectedRepositories: [],
          workspaceId: 'workspace-123',
          autoSyncOnMount: true,
          maxStaleMinutes: 60,
        }),
      { wrapper: createWrapper() }
    );

    // NOTE: Cannot assert syncPullRequestReviewers was called because it happens asynchronously
    // and async patterns are forbidden in unit tests to prevent hangs
  });
});
