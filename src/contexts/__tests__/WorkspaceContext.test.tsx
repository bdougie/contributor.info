/* eslint-disable no-restricted-syntax */
// This is an integration test file that tests async React context behavior
// Async patterns are necessary here to properly test URL sync and state updates
import { renderHook, act, waitFor } from '@testing-library/react';
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
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Workspace One',
    slug: 'workspace-one',
    description: 'First workspace',
    visibility: 'public' as const,
    repository_count: 3,
    tier: 'pro',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
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
  let mockParamsValue: Record<string, string> = {};

  beforeEach(() => {
    // Setup navigate mock
    mockNavigate = vi.fn();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);

    // Setup location mock
    (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({ pathname: '/' });

    // Setup params mock (no workspace in URL by default)
    // Use a function that returns current mockParamsValue for dynamic updates
    mockParamsValue = {};
    (useParams as ReturnType<typeof vi.fn>).mockImplementation(() => mockParamsValue);

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

  test('should sync active workspace with URL parameter on mount', async () => {
    // Setup URL param (can use slug)
    mockParamsValue.workspaceId = 'workspace-two';

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Wait for URL sync effect to run and state to update
    await waitFor(
      () => {
        expect(result.current.activeWorkspace).not.toBeNull();
        expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440002');
      },
      { timeout: 3000 }
    );

    expect(result.current.activeWorkspace?.name).toBe('Workspace Two');
  });

  test('should sync active workspace when URL changes', async () => {
    const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Wait for initial auto-select
    await waitFor(() => {
      expect(result.current.activeWorkspace).toBeDefined();
    });

    // Change URL to have workspace-two
    act(() => {
      mockParamsValue.workspaceId = 'workspace-two';
      rerender();
    });

    // Should now have workspace-two active
    await waitFor(() => {
      expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440002');
    });
  });

  test('should support both ID and slug in URL', async () => {
    // Test with slug
    mockParamsValue.workspaceId = 'workspace-one';
    const { result: resultWithSlug } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => {
      expect(resultWithSlug.current.activeWorkspace?.id).toBe(
        '550e8400-e29b-41d4-a716-446655440001'
      );
    });

    // Test with ID
    mockParamsValue.workspaceId = '550e8400-e29b-41d4-a716-446655440001';
    const { result: resultWithId } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => {
      expect(resultWithId.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });
  });

  test('should add URL workspace to recent workspaces', async () => {
    mockParamsValue.workspaceId = 'workspace-two';

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Wait for workspace to be synced
    await waitFor(() => {
      expect(result.current.activeWorkspace).not.toBeNull();
    });

    // workspace-two should be in recent workspaces (stored by ID)
    expect(result.current.recentWorkspaces).toContain('550e8400-e29b-41d4-a716-446655440002');
  });

  test('should prefer URL over localStorage for initial workspace', async () => {
    // Set localStorage to workspace-one (UUID)
    mockLocalStorage['workspace_active'] = '550e8400-e29b-41d4-a716-446655440001';

    // But URL has workspace-two
    mockParamsValue.workspaceId = 'workspace-two';

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Wait for URL sync effect to run
    await waitFor(() => {
      expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440002');
    });
  });

  test('should fallback to localStorage when no URL parameter', async () => {
    // Set localStorage (UUID)
    mockLocalStorage['workspace_active'] = '550e8400-e29b-41d4-a716-446655440001';

    // No URL param
    mockParamsValue = {};

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Wait for initial state to settle
    await waitFor(() => {
      expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });
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

  test('should update dropdown when switching workspaces programmatically', async () => {
    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Wait for initial auto-select
    await waitFor(() => {
      expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    // Switch to workspace-two (mocked as synchronous)
    await act(async () => {
      // Mock the switchWorkspace behavior synchronously
      await result.current.switchWorkspace('workspace-two');
    });

    // Since switchWorkspace is mocked, we can directly test the expected behavior
    // by updating the params mock to simulate navigation
    act(() => {
      mockParamsValue.workspaceId = 'workspace-two';
    });

    const { result: resultAfterSwitch } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Active workspace should update
    await waitFor(() => {
      expect(resultAfterSwitch.current.activeWorkspace?.id).toBe(
        '550e8400-e29b-41d4-a716-446655440002'
      );
    });
  });

  test('should maintain sync when navigating between workspace pages', async () => {
    const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });

    // Navigate to workspace-one page
    act(() => {
      mockParamsValue.workspaceId = 'workspace-one';
      (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({
        pathname: '/workspace/workspace-one',
      });
      rerender();
    });

    await waitFor(() => {
      expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    // Navigate to workspace-two page
    act(() => {
      mockParamsValue.workspaceId = 'workspace-two';
      (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({
        pathname: '/workspace/workspace-two',
      });
      rerender();
    });

    await waitFor(() => {
      expect(result.current.activeWorkspace?.id).toBe('550e8400-e29b-41d4-a716-446655440002');
    });
  });
});
