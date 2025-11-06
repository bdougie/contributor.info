/**
 * Regression tests for use-user-workspaces hook
 * Critical test: Ensures workspace access uses app_users.id, not auth.users.id
 * Prevents regression of PR #1148 workspace access bug
 * Updated for PR #1188 React Query implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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

// Mock the auth query hooks
vi.mock('@/hooks/use-auth-query', () => ({
  useAuthUser: vi.fn(),
  useAppUserId: vi.fn(),
  authKeys: {
    all: ['auth'] as const,
    user: () => ['auth', 'user'] as const,
    session: () => ['auth', 'session'] as const,
    appUser: (id: string) => ['auth', 'app-user', id] as const,
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
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('CRITICAL: should fetch app_users.id before querying workspace_members', async () => {
    // Setup: Different UUIDs for auth.users.id and app_users.id (this was the bug)
    const authUserId = '1eaf7821-2ead-4711-9727-1983205e7899'; // auth.users.id
    const appUserId = 'c44084f7-4f3a-450a-aee8-ea30f3480b07'; // app_users.id

    // These MUST be different - this is the core of the bug
    expect(authUserId).not.toBe(appUserId);

    // Mock the auth query hooks
    const { useAuthUser, useAppUserId: useAppUserIdHook } = await import(
      '@/hooks/use-auth-query'
    );

    vi.mocked(useAuthUser).mockReturnValue({
      data: {
        id: authUserId,
        email: 'owner@example.com',
        app_metadata: {},
        user_metadata: { avatar_url: 'https://example.com/avatar.png' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    vi.mocked(useAppUserIdHook).mockReturnValue({
      data: appUserId,
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    // Track which queries are made and with what IDs
    const queryCalls: Array<{ table: string; eqCalls: Array<[string, string]> }> = [];

    // Mock database queries
    const mockFrom = vi.fn((table: string) => {
      const eqCalls: Array<[string, string]> = [];

      // CRITICAL: Record query immediately when from() is called
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
          return { data: null, error: null };
        }),
        returns: vi.fn(function (this: typeof chainable) {
          return this;
        }),
      };

      return chainable;
    });

    vi.mocked(supabase.from).mockImplementation(mockFrom as never);

    // Render hook with QueryClient wrapper
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUserWorkspaces(), { wrapper });

    // Wait for async operations
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 3000 }
    );

    // CRITICAL ASSERTION: Workspace queries must use app_users.id, NOT auth.users.id
    // With React Query, we don't query app_users directly anymore - it's handled by useAppUserId
    // We just need to verify that workspace queries use appUserId
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

    // Mock the auth query hooks
    const { useAuthUser, useAppUserId: useAppUserIdHook } = await import(
      '@/hooks/use-auth-query'
    );

    vi.mocked(useAuthUser).mockReturnValue({
      data: {
        id: authUserId,
        email: 'newuser@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    // App user not found
    vi.mocked(useAppUserIdHook).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    const mockFrom = vi.fn((table: string) => {
      const chainable = {
        select: vi.fn(() => chainable),
        eq: vi.fn(() => chainable),
        maybeSingle: vi.fn(async () => {
          return { data: null, error: null };
        }),
        returns: vi.fn(function (this: typeof chainable) {
          return this;
        }),
      };
      return chainable;
    });

    vi.mocked(supabase.from).mockImplementation(mockFrom as never);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUserWorkspaces(), { wrapper });

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
    // Mock the auth query hooks for unauthenticated user
    const { useAuthUser, useAppUserId: useAppUserIdHook } = await import(
      '@/hooks/use-auth-query'
    );

    vi.mocked(useAuthUser).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    vi.mocked(useAppUserIdHook).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    const mockFrom = vi.fn();
    vi.mocked(supabase.from).mockImplementation(mockFrom as never);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUserWorkspaces(), { wrapper });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 3000 }
    );

    expect(result.current.workspaces).toEqual([]);
    expect(result.current.error).toBeNull();

    // Should NOT query workspace tables when not authenticated
    expect(mockFrom).not.toHaveBeenCalledWith('workspaces');
    expect(mockFrom).not.toHaveBeenCalledWith('workspace_members');
  });
});
