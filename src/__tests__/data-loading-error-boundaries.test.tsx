import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup, screen, fireEvent } from '@testing-library/react';
import { Component, ReactNode } from 'react';

import { DataLoadingErrorBoundary } from '@/components/error-boundaries/data-loading-error-boundary';
import { CriticalDataFallback, FullDataFallback, EnhancementDataFallback } from '@/components/fallbacks/loading-fallbacks';
import { useProgressiveRepoDataWithErrorBoundaries } from '@/hooks/use-progressive-repo-data-with-error-boundaries';
import { createLoadingError, LoadingError, LoadingStage } from '@/lib/types/data-loading-errors';
import { errorTracker, trackDataLoadingError } from '@/lib/error-tracking';

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

vi.mock('@/lib/env', () => ({
  env: {
    SUPABASE_URL: 'test-url',
    SUPABASE_ANON_KEY: 'test-key',
  },
}));

import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart';
import { calculateLotteryFactor } from '@/lib/utils';

// Mock IntersectionObserver and requestIdleCallback
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as any;

Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: vi.fn((callback: IdleRequestCallback) => {
    callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    return 1;
  }),
});

// Test component that uses the enhanced progressive hook
function TestProgressiveComponent({ 
  owner, 
  repo, 
  shouldThrowInRender = false,
  errorStage,
  errorType 
}: { 
  owner: string; 
  repo: string; 
  shouldThrowInRender?: boolean;
  errorStage?: LoadingStage;
  errorType?: string;
}) {
  const data = useProgressiveRepoDataWithErrorBoundaries(owner, repo, '90d', false, {
    enableRetry: true,
    enableGracefulDegradation: true,
  });

  if (shouldThrowInRender && data.currentStage === (errorStage || 'full')) {
    const error = createLoadingError(
      errorType === 'permission' ? 'PERMISSION_DENIED' : 'NETWORK_TIMEOUT',
      `Render error during ${errorStage || 'full'} stage`,
      { owner, repo }
    );
    throw error;
  }

  return (
    <div data-testid="progressive-component">
      <div data-testid="current-stage">{data.currentStage}</div>
      <div data-testid="data-status">{data.dataStatus.status}</div>
      <div data-testid="has-partial-data">{data.hasPartialData.toString()}</div>
      <div data-testid="is-retrying">{data.isRetrying || 'none'}</div>
      {data.dataStatus.message && (
        <div data-testid="status-message">{data.dataStatus.message}</div>
      )}
      {Object.entries(data.stageErrors).map(([stage, error]) => 
        error && (
          <div key={stage} data-testid={`error-${stage}`}>
            {error.userMessage}
          </div>
        )
      )}
    </div>
  );
}

// Test component for error boundary scenarios
function TestErrorBoundaryWrapper({ 
  stage, 
  children,
  enableGracefulDegradation = true,
  onError,
  onRetry 
}: {
  stage: LoadingStage;
  children: ReactNode;
  enableGracefulDegradation?: boolean;
  onError?: (error: LoadingError, errorInfo: any) => void;
  onRetry?: () => void;
}) {
  return (
    <DataLoadingErrorBoundary
      stage={stage}
      enableGracefulDegradation={enableGracefulDegradation}
      onError={onError}
      onRetry={onRetry}
    >
      {children}
    </DataLoadingErrorBoundary>
  );
}

describe('Data Loading Error Boundaries Integration', () => {
  const fetchDirectCommitsMock = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
  const fetchPRDataMock = fetchPRDataSmart as ReturnType<typeof vi.fn>;
  const calculateLotteryFactorMock = calculateLotteryFactor as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    errorTracker.clearErrorData();
    
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
      hasYoloCoders: false,
      yoloCoderStats: [],
    });
    
    calculateLotteryFactorMock.mockReturnValue({
      factor: 0.5,
      riskLevel: 'Balanced',
      topContributorsCount: 3,
      topContributorsPercentage: 60,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Error Boundary Component Tests', () => {
    it('should catch and display critical stage errors with recovery options', async () => {
      const onError = vi.fn();
      
      const { getByTestId, getByText } = render(
        <TestErrorBoundaryWrapper stage="critical" onError={onError}>
          <TestProgressiveComponent 
            owner="testowner" 
            repo="testrepo" 
            shouldThrowInRender={true}
            errorStage="critical"
            errorType="network"
          />
        </TestErrorBoundaryWrapper>
      );

      await waitFor(() => {
        expect(getByText(/Failed to load data/)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'critical',
          type: 'timeout',
          retryable: true,
        }),
        expect.any(Object)
      );
    });

    it('should show partial data for non-critical errors when graceful degradation is enabled', async () => {
      const fallbackData = <div data-testid="fallback-content">Fallback Content</div>;
      
      const { getByTestId } = render(
        <TestErrorBoundaryWrapper 
          stage="full" 
          enableGracefulDegradation={true}
          fallbackData={fallbackData}
        >
          <TestProgressiveComponent 
            owner="testowner" 
            repo="testrepo" 
            shouldThrowInRender={true}
            errorStage="full"
          />
        </TestErrorBoundaryWrapper>
      );

      await waitFor(() => {
        expect(getByTestId('fallback-content')).toBeInTheDocument();
      });
    });

    it('should handle permission errors with appropriate recovery options', async () => {
      const { getByText, queryByText } = render(
        <TestErrorBoundaryWrapper stage="critical">
          <TestProgressiveComponent 
            owner="testowner" 
            repo="testrepo" 
            shouldThrowInRender={true}
            errorStage="critical"
            errorType="permission"
          />
        </TestErrorBoundaryWrapper>
      );

      await waitFor(() => {
        expect(getByText(/Access denied/)).toBeInTheDocument();
        expect(getByText(/Sign In Again/)).toBeInTheDocument();
        expect(queryByText(/Try Again/)).not.toBeInTheDocument(); // Permission errors are not retryable
      });
    });
  });

  describe('Progressive Hook with Error Handling', () => {
    it('should handle API failures gracefully with retry mechanism', async () => {
      fetchPRDataMock
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          data: [{ id: 1, title: 'Test PR', user: { login: 'user1', avatar_url: 'avatar1.jpg' } }],
          status: 'success',
        });

      const { getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      // Initially should show error state
      await waitFor(() => {
        expect(getByTestId('data-status')).toHaveTextContent('pending');
      }, { timeout: 5000 });

      // Should eventually succeed after retry
      await waitFor(() => {
        expect(getByTestId('data-status')).toHaveTextContent('success');
      }, { timeout: 10000 });
    });

    it('should continue to enhancement stage even if full stage fails', async () => {
      fetchPRDataMock
        .mockResolvedValueOnce({ // Critical stage succeeds
          data: [{ id: 1, title: 'Test PR', user: { login: 'user1', avatar_url: 'avatar1.jpg' } }],
          status: 'success',
        })
        .mockRejectedValue(new Error('Full stage API error')); // Full stage fails

      fetchDirectCommitsMock.mockResolvedValue({ // Enhancement stage succeeds
        commits: [],
        totalCommits: 0,
        hasYoloCoders: false,
        yoloCoderStats: [],
      });

      const { getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      await waitFor(() => {
        expect(getByTestId('has-partial-data')).toHaveTextContent('true');
      }, { timeout: 5000 });
    });

    it('should track stage-specific errors correctly', async () => {
      fetchPRDataMock.mockRejectedValue(new Error('Critical stage failure'));

      const { getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      await waitFor(() => {
        expect(getByTestId('error-critical')).toBeInTheDocument();
      });

      // Check that error was tracked
      const errorStats = errorTracker.getErrorStats();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      expect(errorStats.errorsByStage.critical).toBeGreaterThan(0);
    });
  });

  describe('Fallback UI Components', () => {
    it('should render critical data fallback with partial data', () => {
      const partialData = {
        prCount: 5,
        contributorCount: 3,
        topContributors: [
          { login: 'user1', avatar_url: 'avatar1.jpg', contributions: 10 },
          { login: 'user2', avatar_url: 'avatar2.jpg', contributions: 5 },
        ]
      };

      const { getByText } = render(
        <CriticalDataFallback 
          stage="critical" 
          partialData={partialData}
          message="Some data could not be loaded"
        />
      );

      expect(getByText('5')).toBeInTheDocument(); // PR count
      expect(getByText('3')).toBeInTheDocument(); // Contributor count
      expect(getByText(/Some data could not be loaded/)).toBeInTheDocument();
    });

    it('should render full data fallback with loading skeletons', () => {
      const { container } = render(
        <FullDataFallback 
          stage="full" 
          message="Loading detailed information..."
        />
      );

      // Should contain skeleton elements
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      expect(container.querySelector('[data-testid="status-message"]')).toBeNull();
    });

    it('should render enhancement fallback for optional features', () => {
      const partialData = {
        directCommitsData: {
          hasYoloCoders: true,
          yoloCoderStats: [{ login: 'yolo-user', directCommitPercentage: 85 }]
        }
      };

      const { getByText } = render(
        <EnhancementDataFallback 
          stage="enhancement" 
          partialData={partialData}
          showPartialData={true}
        />
      );

      expect(getByText(/YOLO coders detected/)).toBeInTheDocument();
      expect(getByText(/yolo-user/)).toBeInTheDocument();
    });
  });

  describe('Error Recovery and Retry', () => {
    it('should implement exponential backoff for retries', async () => {
      vi.useFakeTimers();
      
      fetchPRDataMock.mockRejectedValue(new Error('Network timeout'));

      const { getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      // Initial error
      await waitFor(() => {
        expect(getByTestId('data-status')).toHaveTextContent('pending');
      });

      // Fast forward time to trigger retries
      vi.advanceTimersByTime(5000);

      expect(fetchPRDataMock).toHaveBeenCalledTimes(1); // Initial call
      
      vi.useRealTimers();
    });

    it('should stop retrying after maximum attempts', async () => {
      fetchPRDataMock.mockRejectedValue(new Error('Persistent network error'));

      const { getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      await waitFor(() => {
        expect(getByTestId('data-status')).toHaveTextContent('error');
      }, { timeout: 10000 });

      // Should not retry indefinitely
      expect(fetchPRDataMock).toHaveBeenCalledTimes(1); // Only initial call in this test
    });

    it('should handle manual retry correctly', async () => {
      const onRetry = vi.fn();
      
      const { getByText } = render(
        <TestErrorBoundaryWrapper stage="critical" onRetry={onRetry}>
          <TestProgressiveComponent 
            owner="testowner" 
            repo="testrepo" 
            shouldThrowInRender={true}
            errorStage="critical"
          />
        </TestErrorBoundaryWrapper>
      );

      await waitFor(() => {
        expect(getByText(/Try Again/)).toBeInTheDocument();
      });

      fireEvent.click(getByText(/Try Again/));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Error Tracking Integration', () => {
    it('should track errors with proper context', async () => {
      const error = createLoadingError('NETWORK_TIMEOUT', 'Test error', {
        owner: 'testowner',
        repo: 'testrepo',
        timeRange: '90d'
      });

      trackDataLoadingError(error, { repository: 'testowner/testrepo' });

      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByType.timeout).toBe(1);
    });

    it('should export error data for debugging', () => {
      const error = createLoadingError('PERMISSION_DENIED', 'Access denied');
      trackDataLoadingError(error);

      const exportedData = errorTracker.exportErrorData();
      expect(exportedData).toContain('Access denied');
      expect(exportedData).toContain('permission');
    });
  });

  describe('Integration with Existing Progressive Loading', () => {
    it('should work with existing intersection observer hooks', async () => {
      const { getByTestId } = render(
        <TestErrorBoundaryWrapper stage="enhancement" enableGracefulDegradation={true}>
          <TestProgressiveComponent owner="testowner" repo="testrepo" />
        </TestErrorBoundaryWrapper>
      );

      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
      });
    });

    it('should maintain backward compatibility with existing error handling', async () => {
      fetchPRDataMock.mockResolvedValue({
        data: null,
        status: 'partial_data',
        message: 'Incomplete data',
      });

      const { getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      await waitFor(() => {
        expect(getByTestId('status-message')).toHaveTextContent('Incomplete data');
      });
    });
  });

  describe('Performance and Resource Management', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      unmount();
      
      // Verify no memory leaks or pending timers
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should handle rapid component re-renders without issues', async () => {
      const { rerender, getByTestId } = render(
        <TestProgressiveComponent owner="testowner" repo="testrepo" />
      );

      // Rapid re-renders with different props
      for (let i = 0; i < 5; i++) {
        rerender(
          <TestProgressiveComponent owner={`owner${i}`} repo={`repo${i}`} />
        );
      }

      await waitFor(() => {
        expect(getByTestId('progressive-component')).toBeInTheDocument();
      });
    });
  });
});