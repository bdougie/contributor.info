import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserWorkspaces } from '../use-user-workspaces';
import { supabase } from '@/lib/supabase';

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('useUserWorkspaces', () => {
  let authChangeCallback: ((event: string, session: any) => void) | null = null;
  let unsubscribe: () => void;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock auth state change subscription
    unsubscribe = vi.fn();
    (supabase.auth.onAuthStateChange as any).mockImplementation((callback: any) => {
      authChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe } },
      };
    });

    // Mock default auth state
    (supabase.auth.getUser as any).mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
      },
      error: null,
    });

    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'test@example.com' },
        },
      },
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
        returns: vi.fn(() => Promise.resolve({ data, error })),
        // Direct promise resolution for simple queries
        then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
        catch: (reject: any) => Promise.resolve({ data, error }).catch(reject),
      });
      
      return createChain();
    });
    (supabase.from as any).mockImplementation(mockFrom);
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
    
    expect(supabase.auth.getUser).toHaveBeenCalled();

    const authCalls = (supabase.auth.getUser as any).mock.calls.length;

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
    
    // Auth.getUser should not have been called again (TOKEN_REFRESHED is ignored)
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(authCalls);
  });

  it('should handle SIGNED_IN event', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    expect(supabase.auth.getUser).toHaveBeenCalled();

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;

    // Simulate SIGNED_IN event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', {
          user: { id: 'user-456', email: 'new@example.com' },
        });
      }
    });

    // Advance timers for debounced fetch to execute (500ms delay)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Should trigger a new fetch after debounce
    expect((supabase.auth.getUser as any).mock.calls.length).toBeGreaterThan(initialAuthCalls);
  });

  it('should debounce rapid auth state changes', async () => {
    const { result } = renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    expect(supabase.auth.getUser).toHaveBeenCalled();

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;

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
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(initialAuthCalls);

    // Advance past debounce delay and run all pending timers
    await act(async () => {
      vi.advanceTimersByTime(300); // Total 600ms
      await vi.runAllTimersAsync();
    });

    // Should trigger only one new fetch despite multiple events
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(initialAuthCalls + 1);
  });

  it('should ignore USER_UPDATED events', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    expect(supabase.auth.getUser).toHaveBeenCalled();

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;

    // Simulate USER_UPDATED event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('USER_UPDATED', {
          user: { id: 'user-123', email: 'test@example.com', user_metadata: { name: 'Updated' } },
        });
      }
    });

    // Advance timers past debounce period to ensure no new fetch is triggered
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    // Auth.getUser should not have been called again (USER_UPDATED is ignored)
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(initialAuthCalls);
  });

  it('should handle SIGNED_OUT event', async () => {
    renderHook(() => useUserWorkspaces());

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    expect(supabase.auth.getUser).toHaveBeenCalled();

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;

    // Simulate SIGNED_OUT event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_OUT', null);
      }
    });

    // Advance timers for debounce to execute
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Should trigger a new fetch
    expect((supabase.auth.getUser as any).mock.calls.length).toBeGreaterThan(initialAuthCalls);
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