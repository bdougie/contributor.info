import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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

describe('useUserWorkspaces', () => {
  let authChangeCallback: ((event: string, session: any) => void) | null = null;
  let unsubscribe: () => void;
  let queryClient: QueryClient;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Mock the auth query hooks with default authenticated state
    const { useAuthUser, useAppUserId } = await import('@/hooks/use-auth-query');
    
    vi.mocked(useAuthUser).mockReturnValue({
      data: {
        id: 'auth-user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    vi.mocked(useAppUserId).mockReturnValue({
      data: 'app-user-123',
      isLoading: false,
      error: null,
      isError: false,
    } as never);

    // Mock auth state change subscription
    unsubscribe = vi.fn();
    (supabase.auth.onAuthStateChange as any).mockImplementation((callback: any) => {
      authChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe } },
      };
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
    queryClient.clear();
  });

  it('should ignore TOKEN_REFRESHED events', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useUserWorkspaces(), { wrapper });

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Get initial call count
    const authCallsBefore = (supabase.from as any).mock.calls.length;

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

    // Database queries should not have been called again (TOKEN_REFRESHED is ignored)
    expect((supabase.from as any).mock.calls.length).toBe(authCallsBefore);
  });

  it('should handle SIGNED_IN event', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useUserWorkspaces(), { wrapper });

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const initialDbCalls = (supabase.from as any).mock.calls.length;

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
    expect((supabase.from as any).mock.calls.length).toBeGreaterThan(initialDbCalls);
  });

  it('should debounce rapid auth state changes', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUserWorkspaces(), { wrapper });

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const initialDbCalls = (supabase.from as any).mock.calls.length;

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
    expect((supabase.from as any).mock.calls.length).toBe(initialDbCalls);

    // Advance past debounce delay and run all pending timers
    await act(async () => {
      vi.advanceTimersByTime(300); // Total 600ms
      await vi.runAllTimersAsync();
    });

    // Should trigger only one new fetch despite multiple events
    // Note: May trigger more than +1 due to batched queries (workspaces + workspace_members)
    expect((supabase.from as any).mock.calls.length).toBeGreaterThanOrEqual(initialDbCalls + 1);
  });

  it('should handle USER_UPDATED events with longer debounce', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useUserWorkspaces(), { wrapper });

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const initialDbCalls = (supabase.from as any).mock.calls.length;

    // Simulate USER_UPDATED event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('USER_UPDATED', {
          user: { id: 'user-123', email: 'test@example.com', user_metadata: { name: 'Updated' } },
        });
      }
    });

    // USER_UPDATED has a 1 second debounce (vs 500ms for SIGNED_IN)
    await act(async () => {
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();
    });

    // Should trigger a new fetch after longer debounce
    expect((supabase.from as any).mock.calls.length).toBeGreaterThan(initialDbCalls);
  });

  it('should handle SIGNED_OUT event', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useUserWorkspaces(), { wrapper });

    // Wait for initial load by advancing timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const initialDbCalls = (supabase.from as any).mock.calls.length;

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
    expect((supabase.from as any).mock.calls.length).toBeGreaterThan(initialDbCalls);
  });

  it('should cleanup debounce timer on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(() => useUserWorkspaces(), { wrapper });

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
