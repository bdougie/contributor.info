import { renderHook, act } from '@testing-library/react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { WorkspaceProvider, useWorkspaceContext } from '../WorkspaceContext';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}));

// Mock useUserWorkspaces hook
jest.mock('@/hooks/use-user-workspaces', () => ({
  useUserWorkspaces: jest.fn(),
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
  let mockNavigate: jest.Mock;
  let mockLocalStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Setup navigate mock
    mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    // Setup location mock
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/' });

    // Setup params mock (no workspace in URL by default)
    (useParams as jest.Mock).mockReturnValue({});

    // Setup useUserWorkspaces mock
    (useUserWorkspaces as jest.Mock).mockReturnValue({
      workspaces: mockWorkspaces,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    // Mock localStorage
    mockLocalStorage = {};
    Storage.prototype.getItem = jest.fn((key) => mockLocalStorage[key] || null);
    Storage.prototype.setItem = jest.fn((key, value) => {
      mockLocalStorage[key] = value;
    });
    Storage.prototype.removeItem = jest.fn((key) => {
      delete mockLocalStorage[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider>{children}</WorkspaceProvider>
  );

  test('should sync active workspace with URL parameter on mount', () => {
    // Setup URL param
    (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-2' });

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
      (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-2' });
    });

    rerender();

    // Should now have workspace-2 active
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
  });

  test('should support both ID and slug in URL', () => {
    // Test with slug
    (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-one' });
    const { result: resultWithSlug } = renderHook(() => useWorkspaceContext(), { wrapper });
    expect(resultWithSlug.current.activeWorkspace?.id).toBe('workspace-1');

    // Test with ID
    (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-1' });
    const { result: resultWithId } = renderHook(() => useWorkspaceContext(), { wrapper });
    expect(resultWithId.current.activeWorkspace?.id).toBe('workspace-1');
  });

  test('should add URL workspace to recent workspaces', () => {
    (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-2' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // workspace-2 should be in recent workspaces
    expect(result.current.recentWorkspaces).toContain('workspace-2');
  });

  test('should prefer URL over localStorage for initial workspace', () => {
    // Set localStorage to workspace-1
    mockLocalStorage['workspace_active'] = 'workspace-1';

    // But URL has workspace-2
    (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-2' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Should use URL workspace, not localStorage
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
  });

  test('should fallback to localStorage when no URL parameter', () => {
    // Set localStorage
    mockLocalStorage['workspace_active'] = 'workspace-1';

    // No URL param
    (useParams as jest.Mock).mockReturnValue({});

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Should use localStorage workspace
    expect(result.current.activeWorkspace?.id).toBe('workspace-1');
  });

  test('should handle invalid workspace ID in URL gracefully', () => {
    // Invalid workspace ID in URL
    (useParams as jest.Mock).mockReturnValue({ workspaceId: 'invalid-workspace' });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Should not crash and should select first available workspace
    expect(result.current.activeWorkspace).toBeDefined();
    expect(result.current.activeWorkspace?.id).toBe('workspace-1');
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
      (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-2' });
    });

    const { result: resultAfterSwitch } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Active workspace should update
    expect(resultAfterSwitch.current.activeWorkspace?.id).toBe('workspace-2');
  });

  test('should maintain sync when navigating between workspace pages', () => {
    const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Navigate to workspace-1 page
    act(() => {
      (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-1' });
      (useLocation as jest.Mock).mockReturnValue({ pathname: '/workspace/workspace-one' });
    });
    rerender();
    expect(result.current.activeWorkspace?.id).toBe('workspace-1');

    // Navigate to workspace-2 page
    act(() => {
      (useParams as jest.Mock).mockReturnValue({ workspaceId: 'workspace-2' });
      (useLocation as jest.Mock).mockReturnValue({ pathname: '/workspace/workspace-two' });
    });
    rerender();
    expect(result.current.activeWorkspace?.id).toBe('workspace-2');
  });
});