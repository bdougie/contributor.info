/* eslint-disable no-restricted-syntax */
// Integration tests for WorkspaceContext retry timer cleanup - requires async patterns
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { WorkspaceProvider, useWorkspaceContext } from '../WorkspaceContext';
import { MemoryRouter } from 'react-router-dom';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

// Mock dependencies
vi.mock('@/hooks/use-user-workspaces', () => ({
  useUserWorkspaces: vi.fn(),
}));

vi.mock('@/lib/workspace-utils', () => ({
  generateWorkspaceSlug: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
  getWorkspaceUrl: vi.fn((workspace: { slug: string }) => `/workspace/${workspace.slug}`),
}));

vi.mock('@/lib/error-logging', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

import { useUserWorkspaces } from '@/hooks/use-user-workspaces';

describe('WorkspaceContext - Retry Timer Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockWorkspace: WorkspacePreviewData = {
    id: 'ws-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    description: 'Test description',
    owner: {
      id: 'user-1',
      avatar_url: 'https://example.com/avatar.jpg',
      display_name: 'Test User',
    },
    repository_count: 5,
    member_count: 3,
    repositories: [],
    created_at: new Date().toISOString(),
  };

  function TestComponent() {
    const { workspaces, retry } = useWorkspaceContext();
    return (
      <div>
        <div data-testid="workspace-count">{workspaces.length}</div>
        <button onClick={retry} data-testid="retry-button">
          Retry
        </button>
      </div>
    );
  }

  it('should clear retry timeout when component unmounts', async () => {
    const mockRefetch = vi.fn();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      error: new Error('Test error'),
      refetch: mockRefetch,
    });

    const { unmount } = render(
      <MemoryRouter>
        <WorkspaceProvider>
          <TestComponent />
        </WorkspaceProvider>
      </MemoryRouter>
    );

    // Unmount the component
    unmount();

    // Verify clearTimeout was called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should clear retry timeout when data loads successfully', async () => {
    const mockRefetch = vi.fn();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    // Start with empty workspaces
    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { rerender } = render(
      <MemoryRouter>
        <WorkspaceProvider>
          <TestComponent />
        </WorkspaceProvider>
      </MemoryRouter>
    );

    // Simulate successful data load
    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [mockWorkspace],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    rerender(
      <MemoryRouter>
        <WorkspaceProvider>
          <TestComponent />
        </WorkspaceProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Verify clearTimeout was called when data loaded
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    clearTimeoutSpy.mockRestore();
  });

  it('should schedule retry with exponential backoff delay', async () => {
    const mockRefetch = vi.fn();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      error: new Error('Test error'),
      refetch: mockRefetch,
    });

    const { getByTestId } = render(
      <MemoryRouter>
        <WorkspaceProvider>
          <TestComponent />
        </WorkspaceProvider>
      </MemoryRouter>
    );

    // Click retry button - should schedule setTimeout
    getByTestId('retry-button').click();

    await waitFor(() => {
      // Verify setTimeout was called (for the retry delay)
      expect(setTimeoutSpy).toHaveBeenCalled();
      // First retry should use 1000ms delay
      const lastCall = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1];
      expect(lastCall[1]).toBe(1000);
    });

    setTimeoutSpy.mockRestore();
  });

  it('should clear existing retry timeout before scheduling new retry', async () => {
    const mockRefetch = vi.fn();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      error: new Error('Test error'),
      refetch: mockRefetch,
    });

    const { getByTestId } = render(
      <MemoryRouter>
        <WorkspaceProvider>
          <TestComponent />
        </WorkspaceProvider>
      </MemoryRouter>
    );

    // Click retry button first time
    getByTestId('retry-button').click();
    const firstClearCount = clearTimeoutSpy.mock.calls.length;

    // Wait a bit to ensure setTimeout is called
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Click retry button second time - should clear the previous timeout
    getByTestId('retry-button').click();

    await waitFor(() => {
      // Verify clearTimeout was called again
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(firstClearCount);
    });

    clearTimeoutSpy.mockRestore();
  });
});
