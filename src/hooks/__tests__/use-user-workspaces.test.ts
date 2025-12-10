/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Tests for useUserWorkspaces hook - requires async patterns for React hook testing
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserWorkspaces } from '../use-user-workspaces';
// Mock safeGetUser from safe-auth module (which is what use-user-workspaces actually uses)
vi.mock('@/lib/auth/safe-auth', () => ({
  safeGetUser: vi.fn(),
}));

// Create mock supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn(),
};

// Mock the supabase-lazy module with getSupabase
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock logger to prevent console output during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import the mocked function to configure it in tests
import { safeGetUser } from '@/lib/auth/safe-auth';

describe('useUserWorkspaces', () => {
  let authChangeCallback: ((event: string, session: any) => void) | null = null;
  let unsubscribe: () => void;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock auth state change subscription
    unsubscribe = vi.fn();
    (mockSupabase.auth.onAuthStateChange as any).mockImplementation((callback: any) => {
      authChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe } },
      };
    });

    // Mock safeGetUser - this is what use-user-workspaces actually calls
    vi.mocked(safeGetUser).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' } as any,
      error: null,
    });

    // Mock workspace queries with proper chain
    const mockFrom = vi.fn((table: string) => {
      // Base chain object that all queries return
      const createChain = (data: any = [], error: any = null) => ({
        select: vi.fn(() => createChain(data, error)),
        eq: vi.fn(() => createChain(data, error)),
        in: vi.fn(() => createChain(data, error)),
        order: vi.fn(() => createChain(data, error)),
        limit: vi.fn(() => createChain(data, error)),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: table === 'app_users' ? { id: 'app-user-123' } : null,
            error: null,
          })
        ),
        returns: vi.fn(() => Promise.resolve({ data, error })),
        // Direct promise resolution for simple queries
        then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
        catch: (reject: any) => Promise.resolve({ data, error }).catch(reject),
      });

      return createChain();
    });
    (mockSupabase.from as any).mockImplementation(mockFrom);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should ignore TOKEN_REFRESHED events', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(safeGetUser).toHaveBeenCalled();

    const authCalls = vi.mocked(safeGetUser).mock.calls.length;

    // Simulate TOKEN_REFRESHED event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('TOKEN_REFRESHED', {
          user: { id: 'user-123', email: 'test@example.com' },
        });
      }
    });

    // Advance timers to ensure debounce doesn't trigger
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // safeGetUser should not have been called again (TOKEN_REFRESHED is ignored)
    expect(vi.mocked(safeGetUser).mock.calls.length).toBe(authCalls);
  });

  it('should handle SIGNED_IN event', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(safeGetUser).toHaveBeenCalled();

    const initialAuthCalls = vi.mocked(safeGetUser).mock.calls.length;

    // Simulate SIGNED_IN event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', {
          user: { id: 'user-456', email: 'new@example.com' },
        });
      }
    });

    // Advance timers for debounced fetch to execute (500ms delay)
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();
    });

    // Should trigger a new fetch after debounce
    expect(vi.mocked(safeGetUser).mock.calls.length).toBeGreaterThan(initialAuthCalls);
  });

  it('should debounce rapid auth state changes', async () => {
    const { result } = renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(safeGetUser).toHaveBeenCalled();

    const initialAuthCalls = vi.mocked(safeGetUser).mock.calls.length;

    // Simulate rapid SIGNED_IN events
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', { user: { id: 'user-1' } });
        authChangeCallback('SIGNED_IN', { user: { id: 'user-2' } });
        authChangeCallback('SIGNED_IN', { user: { id: 'user-3' } });
      }
    });

    // Advance timers less than debounce delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should not have triggered any new fetches yet
    expect(vi.mocked(safeGetUser).mock.calls.length).toBe(initialAuthCalls);

    // Advance past debounce delay and run all pending timers
    await act(async () => {
      vi.advanceTimersByTime(300); // Total 600ms
      await vi.runAllTimersAsync();
    });

    // Should trigger only one new fetch despite multiple events
    expect(vi.mocked(safeGetUser).mock.calls.length).toBe(initialAuthCalls + 1);
  });

  it('should ignore USER_UPDATED events for auth refetch', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(safeGetUser).toHaveBeenCalled();

    const initialAuthCalls = vi.mocked(safeGetUser).mock.calls.length;

    // Simulate USER_UPDATED event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('USER_UPDATED', {
          user: { id: 'user-123', email: 'test@example.com', user_metadata: { name: 'Updated' } },
        });
      }
    });

    // Advance timers past the short debounce period (500ms) but less than USER_UPDATED debounce (1000ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // safeGetUser should not have been called again yet (USER_UPDATED has 1 second debounce)
    expect(vi.mocked(safeGetUser).mock.calls.length).toBe(initialAuthCalls);
  });

  it('should handle SIGNED_OUT event', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(safeGetUser).toHaveBeenCalled();

    const initialAuthCalls = vi.mocked(safeGetUser).mock.calls.length;

    // Simulate SIGNED_OUT event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_OUT', null);
      }
    });

    // Advance timers for debounce to execute
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();
    });

    // Should trigger a new fetch
    expect(vi.mocked(safeGetUser).mock.calls.length).toBeGreaterThan(initialAuthCalls);
  });

  it('should cleanup debounce timer on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useUserWorkspaces());

    // Trigger a debounced fetch
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', { user: { id: 'user-789' } });
      }
    });

    // Unmount before debounce completes
    unmount();

    // Verify that clearTimeout was called (for debounce timer cleanup)
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
