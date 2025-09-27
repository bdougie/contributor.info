import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceCount, useNeedsWorkspaceOnboarding } from '../use-workspace-count';
import { supabase } from '@/lib/supabase';

// Type for mock user
type MockUser = {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: Record<string, unknown>;
  last_sign_in_at?: string;
};

// Types for mock Supabase query chains
type MockEqChain = {
  eq: ReturnType<typeof vi.fn>;
};

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  not?: ReturnType<typeof vi.fn>;
};

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('useWorkspaceCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 workspaces when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useWorkspaceCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaceCount).toBe(0);
    expect(result.current.hasWorkspaces).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return workspace count for authenticated user using RPC', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as MockUser },
      error: null,
    });

    // Mock successful RPC call
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 3,
      error: null,
    });

    const { result } = renderHook(() => useWorkspaceCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaceCount).toBe(3);
    expect(result.current.hasWorkspaces).toBe(true);
    expect(result.current.error).toBe(null);
    expect(supabase.rpc).toHaveBeenCalledWith('get_user_workspace_count', {
      p_user_id: 'user-123',
    });
  });

  it('should fallback to separate queries when RPC function fails', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as MockUser },
      error: null,
    });

    // Mock RPC function failure
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: new Error('Function not found'),
    });

    // Mock fallback queries with proper chaining
    vi.mocked(supabase.from).mockImplementation((table: string): MockQueryBuilder => {
      if (table === 'workspaces') {
        const mockEq1 = vi.fn().mockImplementation(
          (): MockEqChain => ({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'ws-1' }, { id: 'ws-2' }],
              error: null,
            }),
          })
        );
        return {
          select: vi.fn().mockReturnThis(),
          eq: mockEq1,
        };
      } else if (table === 'workspace_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [{ workspace_id: 'ws-3' }],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn(),
        eq: vi.fn(),
      };
    });

    const { result } = renderHook(() => useWorkspaceCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaceCount).toBe(3); // 2 owned + 1 member
    expect(result.current.hasWorkspaces).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should handle RPC errors gracefully', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as MockUser },
      error: null,
    });

    // Mock RPC function failure that can't fallback
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: new Error('Database connection error'),
    });

    // Mock fallback also failing
    vi.mocked(supabase.from).mockImplementation((): MockQueryBuilder => {
      const mockEq1 = vi.fn().mockImplementation(
        (): MockEqChain => ({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection error'),
          }),
        })
      );
      return {
        select: vi.fn().mockReturnThis(),
        eq: mockEq1,
      };
    });

    const { result } = renderHook(() => useWorkspaceCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaceCount).toBe(0);
    expect(result.current.hasWorkspaces).toBe(false);
    expect(result.current.error).toBe('Database connection error');
  });
});

describe('useNeedsWorkspaceOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useNeedsWorkspaceOnboarding());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsOnboarding).toBe(false);
  });

  it('should return true when authenticated user has no workspaces', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as MockUser },
      error: null,
    });

    // Mock RPC returning 0 workspaces
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 0,
      error: null,
    });

    const { result } = renderHook(() => useNeedsWorkspaceOnboarding());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsOnboarding).toBe(true);
  });

  it('should return false when authenticated user has workspaces', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as MockUser },
      error: null,
    });

    // Mock RPC returning 1 or more workspaces
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 1,
      error: null,
    });

    const { result } = renderHook(() => useNeedsWorkspaceOnboarding());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsOnboarding).toBe(false);
  });

  it('should react to auth state changes', async () => {
    let authChangeCallback: ((event: string, session: unknown) => void) | null = null;

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authChangeCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    // Initially not authenticated
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result, rerender } = renderHook(() => useNeedsWorkspaceOnboarding());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsOnboarding).toBe(false);

    // Simulate sign in
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as MockUser },
      error: null,
    });

    // Mock RPC returning 0 workspaces for signed-in user
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 0,
      error: null,
    });

    // Trigger auth state change
    if (authChangeCallback) {
      authChangeCallback('SIGNED_IN', { user: mockUser });
    }

    rerender();

    await waitFor(() => {
      expect(result.current.needsOnboarding).toBe(true);
    });
  });
});
