import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserWorkspaces } from '../use-user-workspaces';
import { supabase } from '@/lib/supabase';

// Mock supabase client properly
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
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  const mockSession = { user: mockUser };
  const mockUnsubscribe = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mocks
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockUnsubscribe,
        },
      },
      error: null,
    } as any);
    
    // Default auth mocks
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);
    
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as any);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Authentication Handling', () => {
    it('should handle auth timeout gracefully using fake timers', async () => {
      // Mock getUser to never resolve (simulating a hang)
      vi.mocked(supabase.auth.getUser).mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
      
      // Fast-forward to auth timeout (2 seconds)
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      // Should trigger abort and fall back to session
      await waitFor(() => {
        expect(vi.mocked(supabase.auth.getSession)).toHaveBeenCalled();
      });
    });

    it('should use session as fallback when auth check fails', async () => {
      // Mock auth.getUser to fail
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Auth error'),
      } as any);
      
      // Mock successful session fallback
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      } as any);
      
      // Mock workspace member query
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ workspace_id: 'workspace-1' }],
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Should have used session fallback
      expect(vi.mocked(supabase.auth.getSession)).toHaveBeenCalled();
    });

    it('should return empty workspaces when no user is authenticated', async () => {
      // Mock no user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);
      
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.workspaces).toEqual([]);
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Workspace Data Fetching', () => {
    it('should fetch and enrich workspace data successfully', async () => {
      const mockWorkspaceData = [
        { workspace_id: 'workspace-1' },
        { workspace_id: 'workspace-2' },
      ];
      
      const mockWorkspaces = [
        { 
          id: 'workspace-1', 
          name: 'Workspace 1', 
          slug: 'workspace-1',
          description: 'First workspace',
          owner_id: 'owner-1',
          created_at: new Date().toISOString(),
        },
        { 
          id: 'workspace-2', 
          name: 'Workspace 2', 
          slug: 'workspace-2',
          description: 'Second workspace',
          owner_id: 'owner-2',
          created_at: new Date().toISOString(),
        },
      ];
      
      const mockRepositories = [
        {
          id: 'repo-1',
          is_pinned: true,
          repositories: {
            id: 'repo-1',
            full_name: 'org/repo1',
            name: 'repo1',
            owner: 'org',
            github_pushed_at: new Date().toISOString(),
          },
        },
      ];
      
      // Mock the query chain
      const mockFrom = vi.fn((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockWorkspaceData,
                error: null,
              }),
            }),
          };
        } else if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockWorkspaces,
                error: null,
              }),
            }),
          };
        } else if (table === 'workspace_repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockRepositories,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      });
      
      vi.mocked(supabase.from).mockImplementation(mockFrom);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.workspaces).toHaveLength(2);
        expect(result.current.workspaces[0].name).toBe('Workspace 1');
        expect(result.current.workspaces[1].name).toBe('Workspace 2');
      });
    });

    it('should handle workspace fetching errors properly', async () => {
      // Mock workspace member query to fail
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      });
      
      vi.mocked(supabase.from).mockImplementation(mockFrom);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe('Database error');
        expect(result.current.workspaces).toEqual([]);
      });
    });
  });

  describe('Loading State and Timeouts', () => {
    it('should timeout after 10 seconds using fake timers', async () => {
      // Mock a query that never resolves
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        }),
      });
      
      vi.mocked(supabase.from).mockImplementation(mockFrom);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      // Initially loading
      expect(result.current.loading).toBe(true);
      
      // Fast-forward to loading timeout (10 seconds)
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error?.message).toContain('timeout');
      });
    });

    it('should clean up timers on unmount', async () => {
      const { unmount } = renderHook(() => useUserWorkspaces());
      
      // Unmount should clean up
      unmount();
      
      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Refetch Functionality', () => {
    it('should refetch workspaces when requested', async () => {
      const mockWorkspaceData = [
        { workspace_id: 'workspace-1' },
      ];
      
      const mockFrom = vi.fn((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockWorkspaceData,
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      });
      
      vi.mocked(supabase.from).mockImplementation(mockFrom);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Clear mock counts
      vi.clearAllMocks();
      
      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });
      
      // Should have fetched again
      expect(vi.mocked(supabase.from)).toHaveBeenCalled();
    });
  });

  describe('Auth State Changes', () => {
    it('should refetch when auth state changes', async () => {
      let authCallback: ((event: string, session: any) => void) | null = null;
      
      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
        authCallback = cb;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
          error: null,
        } as any;
      });
      
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      
      vi.mocked(supabase.from).mockImplementation(mockFrom);
      
      const { result } = renderHook(() => useUserWorkspaces());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Clear mock counts
      vi.clearAllMocks();
      
      // Trigger auth state change
      act(() => {
        authCallback?.('SIGNED_IN', mockSession);
      });
      
      await waitFor(() => {
        expect(vi.mocked(supabase.from)).toHaveBeenCalled();
      });
    });
  });
});