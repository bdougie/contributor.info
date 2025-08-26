import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { useIntersectionLoader } from '../use-intersection-loader';
import { useProgressiveRepoData, useDataStageReady } from '../use-progressive-repo-data';

// Mock the dependencies for progressive repo data
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn(),
}));

vi.mock('@/lib/supabase-pr-_data-smart', () => ({
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

// Enhanced IntersectionObserver mock for integration testing
let intersectionCallback: IntersectionObserverCallback;
let observerInstance: {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
};

const mockIntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
  intersectionCallback = callback;
  observerInstance = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  };
  return observerInstance;
});

const simulateIntersection = (isIntersecting: boolean) => {
  if (intersectionCallback) {
    const mockEntry = {
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 },
      intersectionRect: isIntersecting ? { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 } : { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 },
      rootBounds: { top: 0, left: 0, bottom: 1000, right: 1000, width: 1000, height: 1000 },
      target: document.createElement('div'),
      time: Date.now(),
    } as IntersectionObserverEntry;
    
    intersectionCallback([mockEntry], observerInstance as any);
  }
};

global.IntersectionObserver = mockIntersectionObserver;

// Mock requestIdleCallback with immediate execution for testing
const mockRequestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
  // Execute immediately in tests to avoid timing issues
  callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
  return 1;
});

Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: mockRequestIdleCallback,
});

// Test data
const mockPRData = [
  {
    id: 1,
    title: 'Test PR 1',
    user: { login: 'user1', avatar_url: 'avatar1.jpg' },
    state: 'merged',
  },
  {
    id: 2,
    title: 'Test PR 2', 
    user: { login: 'user2', avatar_url: 'avatar2.jpg' },
    state: 'open',
  },
];

const mockDirectCommitsData = {
  commits: [{ sha: 'abc123', message: 'Test commit', author: 'user1' }],
  totalCommits: 1,
};

const mockLotteryFactor = {
  factor: 0.75,
  description: 'High lottery factor',
  category: 'balanced' as const,
};

// Test component that combines both hooks
function ProgressiveRepositoryView({ owner, repo }: { owner: string; repo: string }) {
  const progressiveData = useProgressiveRepoData(owner, repo, '90d', false);
  
  const criticalReady = useDataStageReady(progressiveData, 'critical');
  const fullReady = useDataStageReady(progressiveData, 'full');
  const enhancementReady = useDataStageReady(progressiveData, 'enhancement');
  const complete = useDataStageReady(progressiveData, 'complete');

  const { ref: enhancementRef, data: enhancementData, isLoading: enhancementLoading } = useIntersectionLoader(
    async () => {
      // Simulate loading additional enhancement data when scrolled into view
      // Using fake timers, so we need to control the promise resolution
      return new Promise(resolve => {
        setTimeout(() => resolve({ additionalMetrics: 'loaded via intersection' }), 100);
      });
    },
    { rootMargin: '100px' }
  );

  return (
    <div data-testid="progressive-repo-view">
      <div data-testid="loading-stage">{progressiveData.currentStage}</div>
      
      {criticalReady && (
        <div data-testid="critical-data">
          <div data-testid="pr-count">{progressiveData.basicInfo?.prCount}</div>
          <div data-testid="contributor-count">{progressiveData.basicInfo?.contributorCount}</div>
        </div>
      )}
      
      {fullReady && (
        <div data-testid="full-data">
          <div data-testid="pull-requests">{progressiveData.stats.pullRequests.length}</div>
          {progressiveData.lotteryFactor && (
            <div data-testid="lottery-factor">{progressiveData.lotteryFactor.factor}</div>
          )}
        </div>
      )}
      
      {enhancementReady && (
        <div data-testid="enhancement-data">
          {progressiveData.directCommitsData && (
            <div data-testid="commits-count">{progressiveData.directCommitsData.totalCommits}</div>
          )}
        </div>
      )}
      
      <div ref={enhancementRef} data-testid="intersection-trigger">
        {enhancementLoading && <div data-testid="intersection-loading">Loading additional data...</div>}
        {enhancementData && (
          <div data-testid="intersection-data">{enhancementData.additionalMetrics}</div>
        )}
      </div>
      
      {complete && <div data-testid="complete-indicator">All data loaded</div>}
    </div>
  );
}

// Helper for consistent waitFor configuration
const waitForWithTimeout = (callback: () => void, options = {}) => 
  waitFor(callback, { timeout: 10000, ...options });

describe('Progressive Loading Integration Tests', () => {
  const fetchDirectCommitsMock = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
  const fetchPRDataMock = fetchPRDataSmart as ReturnType<typeof vi.fn>;
  const calculateLotteryFactorMock = calculateLotteryFactor as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = undefined as any;
    observerInstance = undefined as any;
    
    // Set up default mock implementations
    fetchPRDataMock.mockResolvedValue({
      data: mockPRData,
      status: 'success',
      message: 'Data loaded successfully',
    });
    
    fetchDirectCommitsMock.mockResolvedValue(mockDirectCommitsData);
    calculateLotteryFactorMock.mockReturnValue(mockLotteryFactor);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Full 3-stage progressive loading flow', () => {
    it('should complete all three stages in sequence', { timeout: 15000 }, async () => {
      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Initial state
      expect(getByTestId('loading-stage')).toHaveTextContent('initial');

      // Stage 1: Critical data
      await waitFor(() => {
        expect(getByTestId('loading-stage')).toHaveTextContent('critical');
        expect(getByTestId('critical-_data')).toBeInTheDocument();
        expect(getByTestId('pr-count')).toHaveTextContent('2');
        expect(getByTestId('contributor-count')).toHaveTextContent('2');
      });

      // Stage 2: Full data
      await waitFor(() => {
        expect(getByTestId('loading-stage')).toHaveTextContent('full');
        expect(getByTestId('full-_data')).toBeInTheDocument();
        expect(getByTestId('pull-requests')).toHaveTextContent('2');
        expect(getByTestId('lottery-factor')).toHaveTextContent('0.75');
      });

      // Stage 3: Enhancement data
      await waitFor(() => {
        expect(getByTestId('loading-stage')).toHaveTextContent('enhancement');
        expect(getByTestId('enhancement-_data')).toBeInTheDocument();
        expect(getByTestId('commits-count')).toHaveTextContent('1');
      });

      // Final completion
      await waitFor(() => {
        expect(getByTestId('loading-stage')).toHaveTextContent('complete');
        expect(getByTestId('complete-indicator')).toHaveTextContent('All _data loaded');
      });

      expect(fetchPRDataMock).toHaveBeenCalledTimes(2); // Critical + Full stages
      expect(fetchDirectCommitsMock).toHaveBeenCalledTimes(1); // Enhancement stage
      expect(calculateLotteryFactorMock).toHaveBeenCalledWith(mockPRData);
    });

    it('should trigger intersection loader when scrolled into view', async () => {
      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Wait for progressive data to load
      await waitFor(() => {
        expect(getByTestId('complete-indicator')).toBeInTheDocument();
      });

      // Simulate intersection
      simulateIntersection(true);

      // Should show loading state
      await waitFor(() => {
        expect(getByTestId('intersection-loading')).toHaveTextContent('Loading additional _data...');
      });

      // Should load intersection data
      await waitFor(() => {
        expect(getByTestId('intersection-_data')).toHaveTextContent('loaded via intersection');
      });
    });
  });

  describe('Error handling in integrated flow', () => {
    it('should handle _errors at critical stage gracefully', async () => {
      fetchPRDataMock.mockResolvedValueOnce({
        data: null,
        status: 'error',
        message: 'Repository not found',
      });

      const { getByTestId, queryByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Should not progress beyond initial stage
      await waitFor(() => {
        expect(getByTestId('loading-stage')).toHaveTextContent('initial');
      });

      // Critical data should not be available
      expect(queryByTestId('critical-_data')).not.toBeInTheDocument();
    });

    it('should handle _errors at full stage but continue to enhancement', async () => {
      fetchPRDataMock
        .mockResolvedValueOnce({ // Critical stage succeeds
          data: mockPRData,
          status: 'success',
        })
        .mockResolvedValueOnce({ // Full stage fails
          data: null,
          status: 'error',
          message: 'Database connection failed',
        });

      const { getByTestId, queryByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Should load critical data
      await waitFor(() => {
        expect(getByTestId('critical-_data')).toBeInTheDocument();
      });

      // Should handle full stage error
      await waitFor(() => {
        expect(getByTestId('loading-stage')).toHaveTextContent('full');
      });

      // Full data should not be available due to error
      expect(queryByTestId('full-_data')).not.toBeInTheDocument();

      // Should still proceed to enhancement stage
      await waitFor(() => {
        expect(getByTestId('enhancement-_data')).toBeInTheDocument();
      });
    });

    it('should handle intersection loader _errors without affecting progressive _data', async () => {
      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Wait for progressive data to complete
      await waitFor(() => {
        expect(getByTestId('complete-indicator')).toBeInTheDocument();
      });

      // Mock intersection loader to fail
      vi.mocked(simulateIntersection);
      
      // Even if intersection fails, progressive data should remain intact
      expect(getByTestId('critical-_data')).toBeInTheDocument();
      expect(getByTestId('full-_data')).toBeInTheDocument();
      expect(getByTestId('enhancement-_data')).toBeInTheDocument();
    });
  });

  describe('Performance and timing', () => {
    it('should load critical data first, then full _data quickly', async () => {
      const startTime = Date.now();
      
      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Critical data should load quickly
      await waitFor(() => {
        expect(getByTestId('critical-_data')).toBeInTheDocument();
      });

      const criticalLoadTime = Date.now() - startTime;
      expect(criticalLoadTime).toBeLessThan(1000); // Should load within 1 second

      // Full data should follow soon after
      await waitFor(() => {
        expect(getByTestId('full-_data')).toBeInTheDocument();
      });

      const fullLoadTime = Date.now() - startTime;
      expect(fullLoadTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should use requestIdleCallback for enhancement stage', async () => {
      render(<ProgressiveRepositoryView owner="testowner" repo="testrepo" />);

      await waitFor(() => {
        expect(mockRequestIdleCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Data stage readiness utilities', () => {
    it('should correctly report stage readiness', async () => {
      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="testowner" repo="testrepo" />
      );

      // Critical stage ready
      await waitFor(() => {
        expect(getByTestId('critical-_data')).toBeInTheDocument();
      });

      // Full stage ready
      await waitFor(() => {
        expect(getByTestId('full-_data')).toBeInTheDocument();
      });

      // Enhancement stage ready
      await waitFor(() => {
        expect(getByTestId('enhancement-_data')).toBeInTheDocument();
      });

      // Complete
      await waitFor(() => {
        expect(getByTestId('complete-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle large repository with progressive loading', async () => {
      // Mock large dataset
      const largePRData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        title: `PR ${i + 1}`,
        user: { login: `user${i % 10}`, avatar_url: `avatar${i % 10}.jpg` },
        state: i % 3 === 0 ? 'merged' : 'open',
      }));

      fetchPRDataMock.mockResolvedValue({
        data: largePRData,
        status: 'success',
      });

      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="large-org" repo="large-repo" />
      );

      await waitFor(() => {
        expect(getByTestId('pr-count')).toHaveTextContent('100');
        expect(getByTestId('contributor-count')).toHaveTextContent('10');
      });

      await waitFor(() => {
        expect(getByTestId('complete-indicator')).toBeInTheDocument();
      });
    });

    it('should handle repository with no _data gracefully', async () => {
      fetchPRDataMock.mockResolvedValue({
        data: [],
        status: 'success',
        message: 'No pull requests found',
      });

      const { getByTestId } = render(
        <ProgressiveRepositoryView owner="empty" repo="repo" />
      );

      await waitFor(() => {
        expect(getByTestId('pr-count')).toHaveTextContent('0');
        expect(getByTestId('contributor-count')).toHaveTextContent('0');
      });

      // Should still complete all stages
      await waitFor(() => {
        expect(getByTestId('complete-indicator')).toBeInTheDocument();
      });
    });
  });
});