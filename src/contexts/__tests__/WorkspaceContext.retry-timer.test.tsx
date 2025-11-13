/* eslint-disable no-restricted-syntax */
// Integration tests for WorkspaceContext retry mechanism
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { WorkspaceProvider, useWorkspaceContext } from '../WorkspaceContext';
import { MemoryRouter } from 'react-router-dom';

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

describe('WorkspaceContext - Retry Mechanism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function TestComponent() {
    const { workspaces, retry, error } = useWorkspaceContext();
    return (
      <div>
        <div data-testid="workspace-count">{workspaces.length}</div>
        <div data-testid="error">{error || 'no-error'}</div>
        <button onClick={retry} data-testid="retry-button">
          Retry
        </button>
      </div>
    );
  }

  it('should trigger refetch when retry is called', async () => {
    const mockRefetch = vi.fn();

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

    // Click retry button
    act(() => {
      getByTestId('retry-button').click();
    });

    // Fast-forward timers to trigger the retry
    act(() => {
      vi.advanceTimersByTime(1000); // First retry is after 1000ms
    });

    // Verify refetch was called
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff for retry delays', async () => {
    const mockRefetch = vi.fn();

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

    // First retry - 1000ms delay
    act(() => {
      getByTestId('retry-button').click();
      vi.advanceTimersByTime(1000);
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    // Second retry - 2000ms delay
    act(() => {
      getByTestId('retry-button').click();
      vi.advanceTimersByTime(2000);
    });
    expect(mockRefetch).toHaveBeenCalledTimes(2);

    // Third retry - 4000ms delay
    act(() => {
      getByTestId('retry-button').click();
      vi.advanceTimersByTime(4000);
    });
    expect(mockRefetch).toHaveBeenCalledTimes(3);
  });

  it('should handle multiple retry clicks with proper timing', async () => {
    const mockRefetch = vi.fn();

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

    // First click starts a retry with 1000ms delay
    act(() => {
      getByTestId('retry-button').click();
    });

    // Second click cancels first and starts new retry with 2000ms delay
    act(() => {
      getByTestId('retry-button').click();
    });

    // Third click cancels second and starts new retry with 4000ms delay
    act(() => {
      getByTestId('retry-button').click();
    });

    // Advance time but not enough for the third retry (4000ms)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should not have triggered any refetch yet
    expect(mockRefetch).toHaveBeenCalledTimes(0);

    // Advance remaining time to trigger the third retry
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Now the third retry should have fired
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('should cleanup pending retries on unmount', async () => {
    const mockRefetch = vi.fn();

    vi.mocked(useUserWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      error: new Error('Test error'),
      refetch: mockRefetch,
    });

    const { unmount, getByTestId } = render(
      <MemoryRouter>
        <WorkspaceProvider>
          <TestComponent />
        </WorkspaceProvider>
      </MemoryRouter>
    );

    // Schedule a retry
    act(() => {
      getByTestId('retry-button').click();
    });

    // Unmount before the retry fires
    unmount();

    // Fast-forward past when retry would have fired
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Refetch should not have been called since component unmounted
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});
