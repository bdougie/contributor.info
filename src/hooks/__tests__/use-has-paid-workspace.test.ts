import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHasPaidWorkspace } from '../use-has-paid-workspace';
import { supabase } from '@/lib/supabase';
import type { User, AuthChangeEvent } from '@supabase/supabase-js';

// Mock types
type MockAuthSubscription = {
  unsubscribe: () => void;
};

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('useHasPaidWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for auth state change listener
    const mockSubscription: MockAuthSubscription = {
      unsubscribe: vi.fn(),
    };

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: mockSubscription,
      },
      error: null,
    } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>);
  });

  it('should return false when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as unknown as ReturnType<typeof supabase.auth.getUser> extends Promise<infer T> ? T : never);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(false);
  });

  it('should return true when user owns a pro workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'pro' }],
        error: null,
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(
      fromMock as unknown as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('workspaces');
  });

  it('should return true when user owns a team workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'team' }],
        error: null,
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(
      fromMock as unknown as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
  });

  it('should return true when user owns an enterprise workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'enterprise' }],
        error: null,
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(
      fromMock as unknown as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
  });

  it('should return false when user owns only free workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    // First call for owned workspaces - returns empty
    const ownedWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    // Second call for member workspaces - returns empty
    const memberWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(ownedWorkspacesMock as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(memberWorkspacesMock as unknown as ReturnType<typeof supabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(false);
  });

  it('should return true when user is member of a paid workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    // First call for owned workspaces - returns empty
    const ownedWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    // Second call for member workspaces - returns paid workspace
    const memberWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            workspace_id: 'workspace-2',
            workspaces: { id: 'workspace-2', tier: 'pro', is_active: true },
          },
        ],
        error: null,
      }),
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(ownedWorkspacesMock as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(memberWorkspacesMock as unknown as ReturnType<typeof supabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('workspace_members');
  });

  it('should handle errors gracefully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockRejectedValue(new Error('Database error')),
    };

    vi.mocked(supabase.from).mockReturnValue(
      fromMock as unknown as ReturnType<typeof supabase.from>
    );

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error checking paid workspace access:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should refetch on auth state change', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;
    let authCallback: ((event: AuthChangeEvent) => void) | null = null;

    // Capture the auth state change callback
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback as unknown as (event: AuthChangeEvent) => void;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
        error: null,
      } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>;
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'pro' }],
        error: null,
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(
      fromMock as unknown as ReturnType<typeof supabase.from>
    );

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear mock calls
    vi.mocked(supabase.auth.getUser).mockClear();

    // Trigger auth state change
    if (authCallback) {
      authCallback('SIGNED_IN' as AuthChangeEvent);
    }

    await waitFor(() => {
      // Verify that getUser was called again after auth state change
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });
  });
});
