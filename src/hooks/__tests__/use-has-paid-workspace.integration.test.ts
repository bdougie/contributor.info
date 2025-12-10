import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHasPaidWorkspace } from '../use-has-paid-workspace';
import type { User, AuthChangeEvent } from '@supabase/supabase-js';

// Mock types
type MockAuthSubscription = {
  unsubscribe: () => void;
};

// Create mock supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn(),
};

// Mock Supabase-lazy
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('useHasPaidWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for auth state change listener
    const mockSubscription: MockAuthSubscription = {
      unsubscribe: vi.fn(),
    };

    vi.mocked(mockSupabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: mockSubscription,
      },
      error: null,
    } as unknown as ReturnType<typeof mockSupabase.auth.onAuthStateChange>);
  });

  it('should return false when user is not authenticated', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as unknown as ReturnType<typeof mockSupabase.auth.getUser> extends Promise<infer T>
      ? T
      : never);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(false);
  });

  it('should return true when user owns a pro workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;
    const mockAppUserId = 'app-user-123';

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // Mock app_users query first
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: mockAppUserId },
        error: null,
      }),
    };

    // Mock workspaces query second
    const workspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'pro' }],
        error: null,
      }),
    };

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(workspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('app_users');
    expect(mockSupabase.from).toHaveBeenCalledWith('workspaces');
  });

  it('should return true when user owns a team workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;
    const mockAppUserId = 'app-user-123';

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // Mock app_users query first
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: mockAppUserId },
        error: null,
      }),
    };

    // Mock workspaces query second
    const workspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'team' }],
        error: null,
      }),
    };

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(workspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
  });

  it('should return true when user owns an enterprise workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;
    const mockAppUserId = 'app-user-123';

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // Mock app_users query first
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: mockAppUserId },
        error: null,
      }),
    };

    // Mock workspaces query second
    const workspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'enterprise' }],
        error: null,
      }),
    };

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(workspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
  });

  it('should return false when user owns only free workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;
    const mockAppUserId = 'app-user-123';

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // First call for app_users lookup
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: mockAppUserId },
        error: null,
      }),
    };

    // Second call for owned workspaces - returns empty
    const ownedWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    // Third call for member workspaces - returns empty
    const memberWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(ownedWorkspacesMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(memberWorkspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(false);
  });

  it('should return true when user is member of a paid workspace', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;
    const mockAppUserId = 'app-user-123';

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // First call for app_users lookup
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: mockAppUserId },
        error: null,
      }),
    };

    // Second call for owned workspaces - returns empty
    const ownedWorkspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    // Third call for member workspaces - returns paid workspace
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

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(ownedWorkspacesMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(memberWorkspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPaidWorkspace).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('app_users');
    expect(mockSupabase.from).toHaveBeenCalledWith('workspace_members');
  });

  it('should handle errors gracefully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as Partial<User>;

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // Mock app_users query to throw error
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error('Database error')),
    };

    vi.mocked(mockSupabase.from).mockReturnValue(
      appUsersMock as unknown as ReturnType<typeof mockSupabase.from>
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
    const mockAppUserId = 'app-user-123';
    let authCallback: ((event: AuthChangeEvent) => void) | null = null;

    // Capture the auth state change callback
    vi.mocked(mockSupabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback as unknown as (event: AuthChangeEvent) => void;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
        error: null,
      } as unknown as ReturnType<typeof mockSupabase.auth.onAuthStateChange>;
    });

    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.getUser>>);

    // Mock app_users query
    const appUsersMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: mockAppUserId },
        error: null,
      }),
    };

    // Mock workspaces query
    const workspacesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'workspace-1', tier: 'pro' }],
        error: null,
      }),
    };

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(workspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    const { result } = renderHook(() => useHasPaidWorkspace());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear mock calls
    vi.mocked(mockSupabase.auth.getUser).mockClear();
    vi.mocked(mockSupabase.from).mockClear();

    // Reset mocks for second call after auth state change
    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(appUsersMock as unknown as ReturnType<typeof mockSupabase.from>)
      .mockReturnValueOnce(workspacesMock as unknown as ReturnType<typeof mockSupabase.from>);

    // Trigger auth state change
    if (authCallback) {
      authCallback('SIGNED_IN' as AuthChangeEvent);
    }

    await waitFor(() => {
      // Verify that getUser was called again after auth state change
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });
  });
});
