import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceCount, useNeedsWorkspaceOnboarding } from '../use-workspace-count';
import { supabase } from '@/lib/supabase';

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

  it('should return workspace count for authenticated user', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as never },
      error: null,
    });

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockReturnValue(fromMock as never);

    // Mock owned workspaces count
    fromMock.eq.mockResolvedValueOnce({
      count: 2,
      error: null,
    });

    // Mock member workspaces count
    fromMock.eq.mockResolvedValueOnce({
      count: 1,
      error: null,
    });

    const { result } = renderHook(() => useWorkspaceCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaceCount).toBe(3); // 2 owned + 1 member
    expect(result.current.hasWorkspaces).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should handle errors gracefully', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as never },
      error: null,
    });

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockReturnValue(fromMock as never);

    // Mock error for owned workspaces
    fromMock.eq.mockRejectedValueOnce(new Error('Database error'));

    const { result } = renderHook(() => useWorkspaceCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaceCount).toBe(0);
    expect(result.current.hasWorkspaces).toBe(false);
    expect(result.current.error).toBe('Database error');
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
      data: { user: mockUser as never },
      error: null,
    });

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockReturnValue(fromMock as never);

    // Mock 0 owned workspaces
    fromMock.eq.mockResolvedValueOnce({
      count: 0,
      error: null,
    });

    // Mock 0 member workspaces
    fromMock.eq.mockResolvedValueOnce({
      count: 0,
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
      data: { user: mockUser as never },
      error: null,
    });

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockReturnValue(fromMock as never);

    // Mock 1 owned workspace
    fromMock.eq.mockResolvedValueOnce({
      count: 1,
      error: null,
    });

    // Mock 0 member workspaces
    fromMock.eq.mockResolvedValueOnce({
      count: 0,
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
      data: { user: mockUser as never },
      error: null,
    });

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockReturnValue(fromMock as never);

    // Mock 0 workspaces
    fromMock.eq.mockResolvedValue({
      count: 0,
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
