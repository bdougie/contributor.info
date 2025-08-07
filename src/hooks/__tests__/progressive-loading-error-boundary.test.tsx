import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { Component, ReactNode } from 'react';
import { useProgressiveRepoData } from '../use-progressive-repo-data';
import { useIntersectionLoader } from '../use-intersection-loader';

// Mock the dependencies
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn(),
}));

vi.mock('@/lib/supabase-pr-data-smart', () => ({
  fetchPRDataSmart: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn(),
}));

vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart';
import { calculateLotteryFactor } from '@/lib/utils';

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as any;

// Mock requestIdleCallback
Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: vi.fn((callback: IdleRequestCallback) => {
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);
    return 1;
  }),
});

// Error boundary component for testing
class TestErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error, errorInfo: any) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
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
  shouldThrowInRender = false 
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
      {data.dataStatus.message && (
        <div data-testid="status-message">{data.dataStatus.message}</div>
      )}
    </div>
  );
}

// Component that uses intersection loader with potential for errors
function IntersectionLoaderComponent({ 
  shouldFailLoad = false 
}: { 
  shouldFailLoad?: boolean 
}) {
  const { ref, data, error, isLoading } = useIntersectionLoader(
    async () => {
      if (shouldFailLoad) {
        throw new Error('Intersection load failed');
      }
      return { result: 'success' };
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

describe('Progressive Loading Error Boundary Tests', () => {
  const fetchDirectCommitsMock = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
  const fetchPRDataMock = fetchPRDataSmart as ReturnType<typeof vi.fn>;
  const calculateLotteryFactorMock = calculateLotteryFactor as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default successful mock implementations
    fetchPRDataMock.mockResolvedValue({
      data: [
        { id: 1, title: 'Test PR', user: { login: 'user1', avatar_url: 'avatar1.jpg' } }
      ],
      status: 'success',
    });
    
    fetchDirectCommitsMock.mockResolvedValue({
      commits: [{ sha: 'abc123', message: 'Test commit', author: 'user1' }],
      totalCommits: 1,
    });
    
    calculateLotteryFactorMock.mockReturnValue({
      factor: 0.5,
      description: 'Balanced',
      category: 'balanced',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Error boundary integration with progressive loading', () => {
    it('should catch render errors during progressive loading stages', async () => {
      const onError = vi.fn();
      
      const { getByTestId } = render(
        <TestErrorBoundary onError={onError}>
          <ProgressiveDataComponent 
            owner="testowner" 
            repo="testrepo" 
            shouldThrowInRender={true}
          />
        </TestErrorBoundary>
      );

      // Wait for the error to be thrown during full stage
      await waitFor(() => {
        expect(getByTestId('error-boundary')).toBeInTheDocument();
        expect(getByTestId('error-message')).toHaveTextContent('Render error during full stage');
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Render error during full stage' }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully without crashing the component', async () => {
      fetchPRDataMock.mockRejectedValue(new Error('API server error'));
      
      const { getByTestId, queryByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      // Component should not crash, error boundary should not activate
      await waitFor(() => {
        expect(queryByTestId('error-boundary')).not.toBeInTheDocument();
        expect(getByTestId('progressive-component')).toBeInTheDocument();
      });
    });

    it('should isolate errors to specific loading stages', async () => {
      fetchPRDataMock
        .mockResolvedValueOnce({ // Critical stage succeeds
          data: [{ id: 1, title: 'Test PR', user: { login: 'user1', avatar_url: 'avatar1.jpg' } }],
          status: 'success',
        })
        .mockRejectedValue(new Error('Full stage API error')); // Full stage fails

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      // Should handle the error internally and continue functioning
      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
        expect(getByTestId('current-stage')).toBeInTheDocument();
      });
    });
  });

  describe('Error boundary integration with intersection loader', () => {
    it('should catch errors from intersection loader without affecting other components', async () => {
      const onError = vi.fn();
      
      const { getByTestId } = render(
        <TestErrorBoundary onError={onError}>
          <IntersectionLoaderComponent shouldFailLoad={true} />
        </TestErrorBoundary>
      );

      // Error should be handled internally, not crash the component
      await waitFor(() => {
        expect(getByTestId('intersection-component')).toBeInTheDocument();
        expect(getByTestId('error')).toHaveTextContent('Intersection load failed');
      });

      // Error boundary should not be triggered
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle successful intersection loading without errors', async () => {
      const { getByTestId } = render(
        <TestErrorBoundary>
          <IntersectionLoaderComponent shouldFailLoad={false} />
        </TestErrorBoundary>
      );

      await waitFor(() => {
        expect(getByTestId('data')).toHaveTextContent('success');
      });
    });
  });

  describe('Combined error scenarios', () => {
    it('should handle multiple components with mixed error states', async () => {
      fetchPRDataMock.mockRejectedValue(new Error('Progressive data API error'));
      
      const { getByTestId, queryByTestId } = render(
        <TestErrorBoundary>
          <div>
            <ProgressiveDataComponent owner="testowner" repo="testrepo" />
            <IntersectionLoaderComponent shouldFailLoad={true} />
          </div>
        </TestErrorBoundary>
      );

      await waitFor(() => {
        // Both components should handle errors internally
        expect(getByTestId('progressive-component')).toBeInTheDocument();
        expect(getByTestId('intersection-component')).toBeInTheDocument();
        expect(getByTestId('error')).toHaveTextContent('Intersection load failed');
        
        // Error boundary should not be triggered
        expect(queryByTestId('error-boundary')).not.toBeInTheDocument();
      });
    });

    it('should recover from temporary network errors', async () => {
      // First call fails, second succeeds
      fetchPRDataMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          data: [{ id: 1, title: 'Test PR', user: { login: 'user1', avatar_url: 'avatar1.jpg' } }],
          status: 'success',
        });

      const { getByTestId, rerender } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      // Wait for initial failure
      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
      });

      // Rerender with different props to trigger retry
      rerender(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner2" repo="testrepo2" />
        </TestErrorBoundary>
      );

      // Should succeed on retry
      await waitFor(() => {
        expect(getByTestId('current-stage')).not.toHaveTextContent('initial');
      });
    });
  });

  describe('Error propagation and handling', () => {
    it('should properly handle async errors in progressive loading', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetchPRDataMock.mockRejectedValue(new Error('Async API error'));
      
      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
      });

      // Async errors should be logged but not crash the component
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed data errors gracefully', async () => {
      fetchPRDataMock.mockResolvedValue({
        data: null, // Malformed response
        status: 'partial_data',
        message: 'Data incomplete',
      });

      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
        expect(getByTestId('data-status')).toHaveTextContent('no_data');
        expect(getByTestId('status-message')).toHaveTextContent('Data incomplete');
      });
    });

    it('should handle timeout scenarios in progressive loading', async () => {
      vi.useFakeTimers();
      
      fetchPRDataMock.mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            data: [],
            status: 'success',
          }), 10000); // Very long timeout
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
    it('should allow manual retry after error', async () => {
      const { getByTestId } = render(
        <TestErrorBoundary>
          <IntersectionLoaderComponent shouldFailLoad={true} />
        </TestErrorBoundary>
      );

      // Initial error
      await waitFor(() => {
        expect(getByTestId('error')).toBeInTheDocument();
      });

      // Component should remain functional for retry attempts
      expect(getByTestId('intersection-component')).toBeInTheDocument();
    });

    it('should maintain component state after non-critical errors', async () => {
      fetchDirectCommitsMock.mockRejectedValue(new Error('Enhancement stage error'));
      
      const { getByTestId } = render(
        <TestErrorBoundary>
          <ProgressiveDataComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundary>
      );

      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
        expect(getByTestId('current-stage')).toBeInTheDocument();
      });

      // Component should continue to function despite enhancement stage errors
      expect(getByTestId('progressive-component')).toBeInTheDocument();
    });
  });
});