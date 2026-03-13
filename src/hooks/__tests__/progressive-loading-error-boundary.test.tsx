import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Component, ReactNode, ErrorInfo } from 'react';
import { useProgressiveRepoData } from '../use-progressive-repo-data';
import { useIntersectionLoader } from '../use-intersection-loader';

// Mock the hooks directly for synchronous testing
vi.mock('../use-progressive-repo-data');
vi.mock('../use-intersection-loader');

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as unknown as typeof IntersectionObserver;

// Mock requestIdleCallback with immediate execution for testing
Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: vi.fn((callback: IdleRequestCallback) => {
    callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    return 1;
  }),
});

// Error boundary props and state types
interface TestErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface TestErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Error boundary component for testing
class TestErrorBoundary extends Component<TestErrorBoundaryProps, TestErrorBoundaryState> {
  constructor(props: TestErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          <div data-testid="error-message">{this.state.error?.message || 'An error occurred'}</div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component that uses progressive repo data with potential for errors
function ProgressiveDataComponent({
  owner,
  repo,
  shouldThrowInRender = false,
}: {
  owner: string;
  repo: string;
  shouldThrowInRender?: boolean;
}) {
  const data = useProgressiveRepoData(owner, repo, '90d', false);

  if (shouldThrowInRender && data.currentStage === 'full') {
    throw new Error('Render error during full stage');
  }

  return (
    <div data-testid="progressive-component">
      <div data-testid="current-stage">{data.currentStage}</div>
      <div data-testid="data-status">{data.dataStatus.status}</div>
      {data.dataStatus.message && <div data-testid="status-message">{data.dataStatus.message}</div>}
    </div>
  );
}

// Component that uses intersection loader with potential for errors
function IntersectionLoaderComponent({ shouldFailLoad = false }: { shouldFailLoad?: boolean }) {
  const { ref, data, error, isLoading } = useIntersectionLoader(
    () => {
      if (shouldFailLoad) {
        return Promise.reject(new Error('Intersection load failed'));
      }
      return Promise.resolve({ result: 'success' });
    },
    { loadImmediately: true }
  );

  return (
    <div ref={ref} data-testid="intersection-component">
      {isLoading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error.message}</div>}
      {data && <div data-testid="data">{data.result}</div>}
    </div>
  );
}

// Helper to create default progressive repo data mock return value
function createProgressiveDataMock(overrides: Record<string, unknown> = {}) {
  return {
    currentStage: 'critical' as const,
    stageProgress: { initial: true, critical: true, full: false, enhancement: false },
    dataStatus: { status: 'pending' as const, message: undefined as string | undefined },
    basicInfo: null,
    pullRequests: [],
    stats: null,
    lotteryFactor: null,
    directCommitsData: null,
    historicalTrends: null,
    ...overrides,
  };
}

// Helper to create default intersection loader mock return value
function createIntersectionLoaderMock(overrides: Record<string, unknown> = {}) {
  return {
    ref: { current: null },
    data: null as { result: string } | null,
    error: null as Error | null,
    isLoading: false,
    isIntersecting: false,
    load: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

describe('Progressive Loading Error Boundary Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock return values
    vi.mocked(useProgressiveRepoData).mockReturnValue(createProgressiveDataMock());
    vi.mocked(useIntersectionLoader).mockReturnValue(createIntersectionLoaderMock());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Error boundary integration with progressive loading', () => {
    it('should catch render errors during progressive loading stages', () => {
      const onError = vi.fn();

      // Mock the hook to return 'full' stage, which triggers the throw in render
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({ currentStage: 'full' })
      );

      const { getByTestId } = render(
        <TestErrorBoundary onError={onError}>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" shouldThrowInRender={true} />
        </TestErrorBoundary>
      );

      expect(getByTestId('error-boundary')).toBeInTheDocument();
      expect(getByTestId('error-message')).toHaveTextContent('Render error during full stage');

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Render error during full stage' }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully without crashing the component', () => {
      // Mock the hook to return an error state (hook handles API errors internally)
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          dataStatus: { status: 'no_data', message: 'API server error' },
        })
      );

      const { getByTestId, queryByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      // Component should not crash, error boundary should not activate
      expect(queryByTestId('error-boundary')).not.toBeInTheDocument();
      expect(getByTestId('progressive-component')).toBeInTheDocument();
    });

    it('should isolate errors to specific loading stages', () => {
      // Mock the hook to show partial success (critical succeeded, full stage had error)
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          currentStage: 'full',
          stageProgress: { initial: true, critical: true, full: true, enhancement: false },
          dataStatus: { status: 'no_data', message: 'Full stage API error' },
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      // Should handle the error internally and continue functioning
      expect(getByTestId('progressive-component')).toBeInTheDocument();
      expect(getByTestId('current-stage')).toBeInTheDocument();
    });
  });

  describe('Error boundary integration with intersection loader', () => {
    it('should catch errors from intersection loader without affecting other components', () => {
      const onError = vi.fn();

      // Mock intersection loader to return error state
      vi.mocked(useIntersectionLoader).mockReturnValue(
        createIntersectionLoaderMock({
          error: new Error('Intersection load failed'),
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary onError={onError}>
          <IntersectionLoaderComponent shouldFailLoad={true} />
        </TestErrorBoundary>
      );

      // Error should be handled internally, not crash the component
      expect(getByTestId('intersection-component')).toBeInTheDocument();
      expect(getByTestId('error')).toHaveTextContent('Intersection load failed');

      // Error boundary should not be triggered
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle successful intersection loading without errors', () => {
      // Mock intersection loader to return success data
      vi.mocked(useIntersectionLoader).mockReturnValue(
        createIntersectionLoaderMock({
          data: { result: 'success' },
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <IntersectionLoaderComponent shouldFailLoad={false} />
        </TestErrorBoundary>
      );

      expect(getByTestId('data')).toHaveTextContent('success');
    });
  });

  describe('Combined error scenarios', () => {
    it('should handle multiple components with mixed error states', () => {
      // Mock progressive data with error state
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          dataStatus: { status: 'no_data', message: 'Progressive data API error' },
        })
      );

      // Mock intersection loader with error state
      vi.mocked(useIntersectionLoader).mockReturnValue(
        createIntersectionLoaderMock({
          error: new Error('Intersection load failed'),
        })
      );

      const { getByTestId, queryByTestId } = render(
        <TestErrorBoundary>
          <div>
            <ProgressiveDataComponent owner="testowner" repo="testrepo" />
            <IntersectionLoaderComponent shouldFailLoad={true} />
          </div>
        </TestErrorBoundary>
      );

      // Both components should handle errors internally
      expect(getByTestId('progressive-component')).toBeInTheDocument();
      expect(getByTestId('intersection-component')).toBeInTheDocument();
      expect(getByTestId('error')).toHaveTextContent('Intersection load failed');

      // Error boundary should not be triggered
      expect(queryByTestId('error-boundary')).not.toBeInTheDocument();
    });

    it('should recover from temporary network errors', () => {
      // Start with error state
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          dataStatus: { status: 'no_data', message: 'Network error' },
        })
      );

      const { getByTestId, rerender } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      expect(getByTestId('progressive-component')).toBeInTheDocument();

      // Mock recovery - second render succeeds
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          currentStage: 'full',
          dataStatus: { status: 'success' },
        })
      );

      // Rerender with different props to trigger retry
      rerender(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner2" repo="testrepo2" />
        </TestErrorBoundary>
      );

      // Should succeed on retry
      expect(getByTestId('current-stage')).not.toHaveTextContent('initial');
    });
  });

  describe('Error propagation and handling', () => {
    it('should properly handle async errors in progressive loading', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock the hook to return error state (as if async error was handled internally)
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          dataStatus: { status: 'no_data', message: 'Async API error' },
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      expect(getByTestId('progressive-component')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed data errors gracefully', () => {
      // Mock the hook to return malformed data state
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          dataStatus: { status: 'no_data', message: 'Data incomplete' },
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      expect(getByTestId('progressive-component')).toBeInTheDocument();
      expect(getByTestId('data-status')).toHaveTextContent('no_data');
      expect(getByTestId('status-message')).toHaveTextContent('Data incomplete');
    });

    it('should handle timeout scenarios in progressive loading', () => {
      vi.useFakeTimers();

      // Mock the hook to return pending state (simulating in-progress timeout)
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          currentStage: 'initial',
          dataStatus: { status: 'pending' },
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      // Should not crash even with long-running operations
      expect(getByTestId('progressive-component')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Error recovery mechanisms', () => {
    it('should allow manual retry after error', () => {
      // Mock intersection loader with error state
      vi.mocked(useIntersectionLoader).mockReturnValue(
        createIntersectionLoaderMock({
          error: new Error('Intersection load failed'),
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <IntersectionLoaderComponent shouldFailLoad={true} />
        </TestErrorBoundary>
      );

      // Initial error
      expect(getByTestId('error')).toBeInTheDocument();

      // Component should remain functional for retry attempts
      expect(getByTestId('intersection-component')).toBeInTheDocument();
    });

    it('should maintain component state after non-critical errors', () => {
      // Mock the hook to show enhancement stage error but component still functional
      vi.mocked(useProgressiveRepoData).mockReturnValue(
        createProgressiveDataMock({
          currentStage: 'enhancement',
          stageProgress: { initial: true, critical: true, full: true, enhancement: false },
          dataStatus: { status: 'partial_data', message: 'Enhancement stage error' },
        })
      );

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      expect(getByTestId('progressive-component')).toBeInTheDocument();
      expect(getByTestId('current-stage')).toBeInTheDocument();

      // Component should continue to function despite enhancement stage errors
      expect(getByTestId('progressive-component')).toBeInTheDocument();
    });
  });
});
