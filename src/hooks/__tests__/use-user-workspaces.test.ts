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

    // Mock workspace queries
    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              returns: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }));
    (supabase.from as any).mockImplementation(mockFrom);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should ignore TOKEN_REFRESHED events', async () => {
    const fetchSpy = vi.spyOn(console, 'log');
    
    renderHook(() => useUserWorkspaces());

    // Wait for initial load
    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });

    // Clear the spy to ignore initial logs
    fetchSpy.mockClear();

    // Simulate TOKEN_REFRESHED event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('TOKEN_REFRESHED', {
          user: { id: 'user-123', email: 'test@example.com' },
        });
      }
    });

    // Verify that TOKEN_REFRESHED is explicitly ignored
    expect(fetchSpy).toHaveBeenCalledWith('[Workspace] Ignoring TOKEN_REFRESHED event');
    
    // The fetch should not be triggered again
    const authCalls = (supabase.auth.getUser as any).mock.calls.length;
    
    // Wait a bit to ensure no new fetch is triggered
    await waitFor(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    // Auth.getUser should not have been called again
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(authCalls);
    
    fetchSpy.mockRestore();
  });

  it('should handle SIGNED_IN and SIGNED_OUT events', async () => {
    const fetchSpy = vi.spyOn(console, 'log');
    
    renderHook(() => useUserWorkspaces());

    // Wait for initial load
    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;
    fetchSpy.mockClear();

    // Simulate SIGNED_IN event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', {
          user: { id: 'user-456', email: 'new@example.com' },
        });
      }
    });

    // Verify that SIGNED_IN triggers a refetch
    expect(fetchSpy).toHaveBeenCalledWith('[Workspace] Triggering workspace refetch for auth event: SIGNED_IN');
    
    // Wait for debounced fetch to execute (500ms delay)
    await new Promise(resolve => setTimeout(resolve, 600));

    // Should trigger a new fetch after debounce
    expect((supabase.auth.getUser as any).mock.calls.length).toBeGreaterThan(initialAuthCalls);

    fetchSpy.mockRestore();
  });

  it('should debounce rapid auth state changes', async () => {
    const { result } = renderHook(() => useUserWorkspaces());

    // Wait for initial load
    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;

    // Simulate rapid SIGNED_IN events
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', { user: { id: 'user-1' } });
        authChangeCallback('SIGNED_IN', { user: { id: 'user-2' } });
        authChangeCallback('SIGNED_IN', { user: { id: 'user-3' } });
      }
    });

    // Wait less than debounce delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should not have triggered any new fetches yet
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(initialAuthCalls);

    // Wait past debounce delay
    await new Promise(resolve => setTimeout(resolve, 300)); // Total 600ms

    // Should trigger only one new fetch despite multiple events
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(initialAuthCalls + 1);
  });

  it('should log USER_UPDATED but not refetch', async () => {
    const fetchSpy = vi.spyOn(console, 'log');
    
    renderHook(() => useUserWorkspaces());

    // Wait for initial load
    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;
    fetchSpy.mockClear();

    // Simulate USER_UPDATED event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('USER_UPDATED', {
          user: { id: 'user-123', email: 'test@example.com', user_metadata: { name: 'Updated' } },
        });
      }
    });

    // Verify that USER_UPDATED is logged but doesn't trigger refetch
    expect(fetchSpy).toHaveBeenCalledWith('[Workspace] USER_UPDATED event detected, checking if refetch needed');
    
    // Wait to ensure no new fetch is triggered
    await waitFor(() => new Promise(resolve => setTimeout(resolve, 600)));
    
    // Auth.getUser should not have been called again
    expect((supabase.auth.getUser as any).mock.calls.length).toBe(initialAuthCalls);
    
    fetchSpy.mockRestore();
  });

  it('should handle SIGNED_OUT event', async () => {
    const fetchSpy = vi.spyOn(console, 'log');
    
    renderHook(() => useUserWorkspaces());

    // Wait for initial load
    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });

    const initialAuthCalls = (supabase.auth.getUser as any).mock.calls.length;
    fetchSpy.mockClear();

    // Simulate SIGNED_OUT event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_OUT', null);
      }
    });

    // Verify that SIGNED_OUT triggers a refetch
    expect(fetchSpy).toHaveBeenCalledWith('[Workspace] Triggering workspace refetch for auth event: SIGNED_OUT');
    
    // Wait for debounce timer
    await new Promise(resolve => setTimeout(resolve, 600));

    // Should trigger a new fetch
    expect((supabase.auth.getUser as any).mock.calls.length).toBeGreaterThan(initialAuthCalls);

    fetchSpy.mockRestore();
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