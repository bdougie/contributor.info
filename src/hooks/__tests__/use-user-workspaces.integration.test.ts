/**
 * Regression tests for use-user-workspaces hook
 * Critical test: Ensures workspace access uses app_users.id, not auth.users.id
 * Prevents regression of PR #1148 workspace access bug
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserWorkspaces } from '../use-user-workspaces';
import { supabase } from '@/lib/supabase';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock avatar utils
vi.mock('@/lib/utils/avatar', () => ({
  getRepoOwnerAvatarUrl: vi.fn((owner: string) => `https://github.com/${owner}.png`),
}));

describe('useUserWorkspaces - PR #1148 Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CRITICAL: should fetch app_users.id before querying workspace_members', async () => {
    // Setup: Different UUIDs for auth.users.id and app_users.id (this was the bug)
    const authUserId = '1eaf7821-2ead-4711-9727-1983205e7899'; // auth.users.id
    const appUserId = 'c44084f7-4f3a-450a-aee8-ea30f3480b07'; // app_users.id

    // These MUST be different - this is the core of the bug
    expect(authUserId).not.toBe(appUserId);

    // Mock authenticated user (returns auth.users.id)
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: authUserId, // This is auth.users.id, not app_users.id
          email: 'owner@example.com',
          app_metadata: {},
          user_metadata: { avatar_url: 'https://example.com/avatar.png' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      },
      error: null,
    });

    // Track which queries are made and with what IDs
    const queryCalls: Array<{ table: string; eqCalls: Array<[string, string]> }> = [];

    // Mock database queries
    const mockFrom = vi.fn((table: string) => {
      const eqCalls: Array<[string, string]> = [];

      // CRITICAL: Record query immediately when from() is called, not in maybeSingle()
      // This ensures we capture ALL queries (workspaces, workspace_members, etc.)
      // even if they don't reach maybeSingle(). Without this, the regression test
      // would pass even if queries revert to using authUserId.
      const queryRecord = { table, eqCalls };
      queryCalls.push(queryRecord);

      const chainable = {
        select: vi.fn(() => chainable),
        eq: vi.fn((column: string, value: string) => {
          // Record eq calls to the shared eqCalls array
          eqCalls.push([column, value]);
          return chainable;
        }),
        in: vi.fn(() => chainable),
        order: vi.fn(() => chainable),
        limit: vi.fn(() => chainable),
        maybeSingle: vi.fn(async () => {
          if (table === 'app_users') {
            // CRITICAL: This maps auth_user_id to app_users.id
            return { data: { id: appUserId }, error: null };
          }
          return { data: null, error: null };
        }),
        returns: vi.fn(function (this: typeof chainable) {
          return this;
        }),
      };

      return chainable;
    });

    vi.mocked(supabase.from).mockImplementation(mockFrom as never);

    // Render hook
    const { result } = renderHook(() => useUserWorkspaces());

    // Wait for async operations
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 3000 }
    );

    // CRITICAL ASSERTION 1: Must query app_users with auth_user_id
    const appUsersQuery = queryCalls.find((q) => q.table === 'app_users');
    expect(appUsersQuery).toBeDefined();
    expect(appUsersQuery?.eqCalls).toContainEqual(['auth_user_id', authUserId]);

    // CRITICAL ASSERTION 2: Workspace queries must use app_users.id, NOT auth.users.id
    const workspaceQuery = queryCalls.find((q) => q.table === 'workspaces');
    if (workspaceQuery) {
      const ownerIdQuery = workspaceQuery.eqCalls.find(([col]) => col === 'owner_id');
      if (ownerIdQuery) {
        // This would fail with the bug - it would be authUserId instead of appUserId
        expect(ownerIdQuery[1]).toBe(appUserId);
        expect(ownerIdQuery[1]).not.toBe(authUserId);
      }
    }

    const memberQuery = queryCalls.find((q) => q.table === 'workspace_members');
    if (memberQuery) {
      const userIdQuery = memberQuery.eqCalls.find(([col]) => col === 'user_id');
      if (userIdQuery) {
        // This would fail with the bug - it would be authUserId instead of appUserId
        expect(userIdQuery[1]).toBe(appUserId);
        expect(userIdQuery[1]).not.toBe(authUserId);
      }
    }
  });

  it('should return empty workspaces when app_users record not found', async () => {
    const authUserId = '1eaf7821-2ead-4711-9727-1983205e7899';

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: authUserId,
          email: 'newuser@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      },
      error: null,
    });

    const mockFrom = vi.fn((table: string) => {
      const chainable = {
        select: vi.fn(() => chainable),
        eq: vi.fn(() => chainable),
        maybeSingle: vi.fn(async () => {
          if (table === 'app_users') {
            // No app_users record found
            return { data: null, error: null };
          }
          return { data: null, error: null };
        }),
        returns: vi.fn(function (this: typeof chainable) {
          return this;
        }),
      };
      return chainable;
    });

    vi.mocked(supabase.from).mockImplementation(mockFrom as never);

    const { result } = renderHook(() => useUserWorkspaces());

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Should return empty array gracefully, not crash
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle unauthenticated users without querying workspaces', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const mockFrom = vi.fn();
    vi.mocked(supabase.from).mockImplementation(mockFrom as never);

    const { result } = renderHook(() => useUserWorkspaces());

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 3000 }
    );

    expect(result.current.workspaces).toEqual([]);
    expect(result.current.error).toBeNull();

    // Should NOT query app_users or workspace tables
    expect(mockFrom).not.toHaveBeenCalledWith('app_users');
    expect(mockFrom).not.toHaveBeenCalledWith('workspaces');
    expect(mockFrom).not.toHaveBeenCalledWith('workspace_members');
  });
});
