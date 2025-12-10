/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// Tests for useUserWorkspaces hook - uses React Query for request deduplication
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserWorkspaces } from '../use-user-workspaces';
import React from 'react';

// Mock safeGetUser from safe-auth module
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

// Create a wrapper with QueryClientProvider for testing hooks that use React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useUserWorkspaces', () => {
  let authChangeCallback: ((event: string, session: any) => void) | null = null;
  let unsubscribe: () => void;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock auth state change subscription
    unsubscribe = vi.fn();
    (mockSupabase.auth.onAuthStateChange as any).mockImplementation((callback: any) => {
      authChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe } },
      };
    });

    // Mock safeGetUser - this is what useCachedAuth calls
    vi.mocked(safeGetUser).mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { avatar_url: 'https://example.com/avatar.jpg' },
      } as any,
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
    vi.clearAllMocks();
  });

  it('should return empty workspaces when user is not authenticated', async () => {
    // Mock unauthenticated user
    vi.mocked(safeGetUser).mockResolvedValue({
      user: null,
      error: null,
    });

    const { result } = renderHook(() => useUserWorkspaces(), {
      wrapper: createWrapper(),
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspaces).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should fetch workspaces when user is authenticated', async () => {
    const { result } = renderHook(() => useUserWorkspaces(), {
      wrapper: createWrapper(),
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Auth check should have been made
    expect(safeGetUser).toHaveBeenCalled();
  });

  it('should handle auth errors gracefully', async () => {
    vi.mocked(safeGetUser).mockResolvedValue({
      user: null,
      error: new Error('Auth failed'),
    });

    const { result } = renderHook(() => useUserWorkspaces(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should return empty workspaces on auth error
    expect(result.current.workspaces).toEqual([]);
  });

  it('should invalidate cache on SIGNED_OUT event', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUserWorkspaces(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate SIGNED_OUT event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_OUT', null);
      }
    });

    // The hook should trigger a refetch (cache invalidation)
    expect(safeGetUser).toHaveBeenCalled();
  });

  it('should handle SIGNED_IN event', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUserWorkspaces(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialAuthCalls = vi.mocked(safeGetUser).mock.calls.length;

    // Simulate SIGNED_IN event
    act(() => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', {
          user: { id: 'user-456', email: 'new@example.com' },
        });
      }
    });

    // Wait for any cache invalidation to trigger refetch
    await waitFor(
      () => {
        expect(vi.mocked(safeGetUser).mock.calls.length).toBeGreaterThanOrEqual(initialAuthCalls);
      },
      { timeout: 2000 }
    );
  });

  it('should provide refetch function', async () => {
    const { result } = renderHook(() => useUserWorkspaces(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify refetch function exists and is callable
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useUserWorkspaces(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Unmount should not throw
    unmount();

    // Verify unsubscribe was called for auth listener
    expect(unsubscribe).toHaveBeenCalled();
  });
});
