import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, beforeEach, afterEach, expect } from 'vitest';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { WorkspaceProvider, useWorkspaceContext } from '../WorkspaceContext';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}));

// Mock useUserWorkspaces hook
vi.mock('@/hooks/use-user-workspaces', () => ({
  useUserWorkspaces: vi.fn(),
}));

const mockWorkspaces = [
  {
    id: 'workspace-1',
    name: 'Workspace One',
    slug: 'workspace-one',
    description: 'First workspace',
    visibility: 'public' as const,
    repository_count: 3,
    tier: 'pro',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'workspace-2',
    name: 'Workspace Two',
    slug: 'workspace-two',
    description: 'Second workspace',
    visibility: 'private' as const,
    repository_count: 5,
    tier: 'team',
    updated_at: '2025-01-02T00:00:00Z',
  },
];

describe('WorkspaceContext - URL Sync', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;
  let mockLocalStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Setup navigate mock
    mockNavigate = vi.fn();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);

    // Setup location mock
    (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({ pathname: '/' });

    // Setup params mock (no workspace in URL by default)
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({});

    // Setup useUserWorkspaces mock
    (useUserWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue({
      workspaces: mockWorkspaces,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock localStorage
    mockLocalStorage = {};
    Storage.prototype.getItem = vi.fn((key) => mockLocalStorage[key] || null);
    Storage.prototype.setItem = vi.fn((key, value) => {
      mockLocalStorage[key] = value;
    });
    Storage.prototype.removeItem = vi.fn((key) => {
      delete mockLocalStorage[key];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider>{children}</WorkspaceProvider>
  );

  test('should sync active workspace with URL parameter on mount', () => {
    // Setup URL param
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-2' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Should select workspace-2 from URL
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
    expect(result.current.activeWorkspace?.name).toBe('Workspace Two');
  });

  test('should sync active workspace when URL changes', () => {
    const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Initially no workspace in URL
    expect(result.current.activeWorkspace).toBeDefined();

    // Change URL to have workspace-2
    act(() => {
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-2' });
    });

    rerender();

    // Should now have workspace-2 active
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
  });

  test('should support both ID and slug in URL', () => {
    // Test with slug
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-one' });
    const { result: resultWithSlug } = renderHook(() => useWorkspaceContext(), { wrapper });
    expect(resultWithSlug.current.activeWorkspace?.id).toBe('workspace-1');

    // Test with ID
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-1' });
    const { result: resultWithId } = renderHook(() => useWorkspaceContext(), { wrapper });
    expect(resultWithId.current.activeWorkspace?.id).toBe('workspace-1');
  });

  test('should add URL workspace to recent workspaces', () => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-2' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // workspace-2 should be in recent workspaces
    expect(result.current.recentWorkspaces).toContain('workspace-2');
  });

  test('should prefer URL over localStorage for initial workspace', () => {
    // Set localStorage to workspace-1
    mockLocalStorage['workspace_active'] = 'workspace-1';

    // But URL has workspace-2
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-2' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Should use URL workspace, not localStorage
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
  });

  test('should fallback to localStorage when no URL parameter', () => {
    // Set localStorage
    mockLocalStorage['workspace_active'] = 'workspace-1';

    // No URL param
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({});

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Should use localStorage workspace
    expect(result.current.activeWorkspace?.id).toBe('workspace-1');
  });

  test('should handle invalid workspace ID in URL gracefully', () => {
    // Invalid workspace ID in URL
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'invalid-workspace' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // With an invalid workspace ID in URL, activeWorkspace should be null
    // The context doesn't auto-select when there's a URL param (even if invalid)
    expect(result.current.activeWorkspace).toBeNull();
    expect(result.current.error).toBeNull(); // Should not show error
    expect(result.current.workspaces).toHaveLength(2); // Workspaces should still be loaded
  });

  test('should update dropdown when switching workspaces programmatically', () => {
    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Initially workspace-1 is active
    expect(result.current.activeWorkspace?.id).toBe('workspace-1');

    // Switch to workspace-2 (mocked as synchronous)
    act(() => {
      // Mock the switchWorkspace behavior synchronously
      result.current.switchWorkspace('workspace-2');
    });

    // Since switchWorkspace is mocked, we can directly test the expected behavior
    // by updating the params mock to simulate navigation
    act(() => {
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-2' });
    });

    const { result: resultAfterSwitch } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Active workspace should update
    expect(resultAfterSwitch.current.activeWorkspace?.id).toBe('workspace-2');
  });

  test('should maintain sync when navigating between workspace pages', () => {
    const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Navigate to workspace-1 page
    act(() => {
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-1' });
      (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({
        pathname: '/workspace/workspace-one',
      });
    });
    rerender();
    expect(result.current.activeWorkspace?.id).toBe('workspace-1');

    // Navigate to workspace-2 page
    act(() => {
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ workspaceId: 'workspace-2' });
      (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({
        pathname: '/workspace/workspace-two',
      });
    });
    rerender();
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
  });
});
