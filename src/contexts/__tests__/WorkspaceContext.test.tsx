import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { WorkspaceProvider, useWorkspaceContext } from '../WorkspaceContext';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import { WORKSPACE_TIMEOUTS } from '@/lib/workspace-config';

// Mock the useUserWorkspaces hook properly
vi.mock('@/hooks/use-user-workspaces');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('WorkspaceContext', () => {
  const mockRefetch = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Setup default mock implementation
    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <BrowserRouter>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </BrowserRouter>
  );

  describe('Loading and Timeout Behavior', () => {
    it('should handle loading timeout with real context', async () => {
      // Mock loading state that doesn't resolve
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: [],
        loading: true, // Stays loading
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);
      
      // Fast-forward time to trigger timeout
      act(() => {
        vi.advanceTimersByTime(WORKSPACE_TIMEOUTS.CONTEXT);
      });
      
      // After timeout, should show timeout error
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toContain('timeout');
      });
    });

    it('should clear timeout when loading completes successfully', async () => {
      const mockWorkspaces = [
        { 
          id: 'workspace-1', 
          name: 'Test Workspace', 
          slug: 'test-workspace',
          repository_count: 2,
          created_at: new Date().toISOString(),
        },
      ];
      
      // Start with loading
      const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      expect(result.current.isLoading).toBe(false);
      
      // Update mock to show data loaded
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: mockWorkspaces,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });
      
      // Force re-render with new data
      rerender();
      
      await waitFor(() => {
        expect(result.current.workspaces).toEqual(mockWorkspaces);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Workspace Auto-Selection', () => {
    it('should auto-select first workspace using real context', async () => {
      const mockWorkspaces = [
        { 
          id: 'workspace-1', 
          name: 'First Workspace', 
          slug: 'first-workspace',
          repository_count: 2,
          created_at: new Date().toISOString(),
        },
        { 
          id: 'workspace-2', 
          name: 'Second Workspace', 
          slug: 'second-workspace',
          repository_count: 3,
          created_at: new Date().toISOString(),
        },
      ];
      
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: mockWorkspaces,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.activeWorkspace).toBeDefined();
        expect(result.current.activeWorkspace?.id).toBe('workspace-1');
        expect(result.current.activeWorkspace?.name).toBe('First Workspace');
      });
    });

    it('should maintain selected workspace when switching', async () => {
      const mockWorkspaces = [
        { 
          id: 'workspace-1', 
          name: 'First Workspace', 
          slug: 'first-workspace',
          repository_count: 2,
          created_at: new Date().toISOString(),
        },
        { 
          id: 'workspace-2', 
          name: 'Second Workspace', 
          slug: 'second-workspace',
          repository_count: 3,
          created_at: new Date().toISOString(),
        },
      ];
      
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: mockWorkspaces,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      // Switch to second workspace
      await act(async () => {
        await result.current.switchWorkspace('workspace-2');
      });
      
      await waitFor(() => {
        expect(result.current.activeWorkspace?.id).toBe('workspace-2');
        expect(result.current.activeWorkspace?.name).toBe('Second Workspace');
      });
      
      // Verify it's in recent workspaces
      expect(result.current.recentWorkspaces).toContain('workspace-2');
    });

    it('should find workspace by slug or ID', async () => {
      const mockWorkspaces = [
        { 
          id: 'workspace-uuid', 
          name: 'Test Workspace', 
          slug: 'test-slug',
          repository_count: 2,
          created_at: new Date().toISOString(),
        },
      ];
      
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: mockWorkspaces,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      // Find by ID
      const byId = result.current.findWorkspace('workspace-uuid');
      expect(byId?.id).toBe('workspace-uuid');
      
      // Find by slug
      const bySlug = result.current.findWorkspace('test-slug');
      expect(bySlug?.id).toBe('workspace-uuid');
      
      // Non-existent workspace
      const notFound = result.current.findWorkspace('non-existent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle workspace loading errors gracefully', async () => {
      const mockError = new Error('Failed to load workspaces');
      
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: [],
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.error).toBe(mockError.message);
        expect(result.current.workspaces).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle switch workspace errors', async () => {
      const mockWorkspaces = [
        { 
          id: 'workspace-1', 
          name: 'Test Workspace', 
          slug: 'test-workspace',
          repository_count: 2,
          created_at: new Date().toISOString(),
        },
      ];
      
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: mockWorkspaces,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      // Try to switch to non-existent workspace
      await act(async () => {
        await result.current.switchWorkspace('non-existent');
      });
      
      await waitFor(() => {
        expect(result.current.error).toContain('not found');
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should retry on failure with proper limits', async () => {
      vi.mocked(useUserWorkspaces).mockReturnValue({
        workspaces: [],
        loading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
      
      // Initial error state
      expect(result.current.error).toContain('Network error');
      
      // Retry
      act(() => {
        result.current.retry();
      });
      
      expect(mockRefetch).toHaveBeenCalledTimes(1);
      
      // Retry multiple times to test limit
      for (let i = 0; i < WORKSPACE_TIMEOUTS.MAX_RETRIES + 1; i++) {
        act(() => {
          result.current.retry();
        });
      }
      
      // Should stop retrying after max attempts
      expect(mockRefetch).toHaveBeenCalledTimes(WORKSPACE_TIMEOUTS.MAX_RETRIES + 1);
    });
  });
});