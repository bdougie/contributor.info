import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock window and fetch for browser environment tests
global.window = {} as Window & typeof globalThis;
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    statusText: 'OK',
    json: () => Promise.resolve({ success: true }),
  } as Response)
);

// Mock dependencies
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'test-job-id',
                status: 'pending',
                repository_id: 'test-repo-id',
                repository_name: 'test/repo',
                processor_type: 'inngest',
                job_type: 'recent-prs',
              },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

vi.mock('../../inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock('../../inngest/types/event-data', () => ({
  mapQueueDataToEventData: vi.fn((jobType, data) => ({
    repositoryId: data.repositoryId,
    repositoryName: data.repositoryName,
    days: data.timeRange || 7,
    priority: 'medium',
    reason: data.triggerSource || 'automatic',
    maxItems: Math.min(data.maxItems || 50, 50),
    jobId: data.jobId,
  })),
}));

// Mock other dependencies
vi.mock('../rollout-manager', () => ({
  hybridRolloutManager: {
    isRepositoryEligible: vi.fn(() => Promise.resolve(false)),
    recordMetrics: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../queue-prioritization', () => ({
  queuePrioritizationService: {
    getRepositoryMetadata: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../job-status-reporter', () => ({
  jobStatusReporter: {
    updateStatus: vi.fn(),
  },
}));

// Import after mocks
import { HybridQueueManager } from '../hybrid-queue-manager';

describe('HybridQueueManager', () => {
  let manager: HybridQueueManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a new instance for testing
    manager = new HybridQueueManager();
  });

  describe('Event Data Mapping', () => {
    it('should properly map timeRange to days parameter for Inngest events', async () => {
      const mockFetch = vi.mocked(fetch);

      await manager.queueRecentDataCapture('test-repo-id', 'owner/repo');

      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/queue-event');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.eventName).toBe('capture/repository.sync.graphql');
      expect(body.data).toMatchObject({
        repositoryId: 'test-repo-id',
        repositoryName: 'owner/repo',
        days: 1, // timeRange of 1 should map to days: 1
        priority: 'medium',
        reason: 'automatic',
        maxItems: 50,
      });
    });

    it('should queue both PR and comment capture when calling queueRecentDataCapture', async () => {
      const mockFetch = vi.mocked(fetch);

      await manager.queueRecentDataCapture('test-repo-id', 'owner/repo');

      // Should be called twice - once for PRs, once for comments
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // First call should be for recent PRs
      const [url1, options1] = mockFetch.mock.calls[0];
      expect(url1).toBe('/api/queue-event');
      const body1 = JSON.parse(options1.body);
      expect(body1.eventName).toBe('capture/repository.sync.graphql');
      expect(body1.data).toMatchObject({
        repositoryId: 'test-repo-id',
        repositoryName: 'owner/repo',
        days: 1, // Recent data uses 1 day timeRange
        reason: 'automatic',
      });

      // Second call should be for comments (including issue comments)
      const [url2, options2] = mockFetch.mock.calls[1];
      expect(url2).toBe('/api/queue-event');
      const body2 = JSON.parse(options2.body);
      expect(body2.eventName).toBe('capture/pr.comments');
      expect(body2.data).toMatchObject({
        repositoryId: 'test-repo-id',
        repositoryName: 'owner/repo',
        days: 7, // Comments use 7 day timeRange for better first responder data
        reason: 'automatic',
        maxItems: 50, // Capped at INNGEST_MAX_ITEMS
      });
    });

    it('should include all required parameters for repository sync events', async () => {
      const mockFetch = vi.mocked(fetch);

      await manager.queueHistoricalDataCapture('test-repo-id', 'owner/repo', 30);

      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/queue-event');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.eventName).toBe('capture/repository.sync.graphql');
      expect(body.data).toMatchObject({
        repositoryId: 'test-repo-id',
        repositoryName: 'owner/repo',
        days: 30, // Should map timeRange to days
        priority: 'medium',
        reason: 'scheduled',
        maxItems: 50, // Capped at INNGEST_MAX_ITEMS
      });
    });

    it('should provide default values for missing parameters', async () => {
      const mockFetch = vi.mocked(fetch);

      // Direct call to queueJob to test default handling
      await manager.queueJob('recent-prs', {
        repositoryId: 'test-repo-id',
        repositoryName: 'owner/repo',
        // Missing timeRange and triggerSource
      });

      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/queue-event');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.eventName).toBe('capture/repository.sync.graphql');
      expect(body.data.days).toBe(7); // Default when timeRange is missing
      expect(body.data.reason).toBe('automatic'); // Default when triggerSource is missing
    });

    it('should validate required fields are present', async () => {
      // Test that repositoryId is required
      await expect(
        manager.queueJob('recent-prs', {
          repositoryName: 'owner/repo',
          // Missing repositoryId
        } as Record<string, unknown>)
      ).rejects.toThrow();
    });
  });

  describe('Event Type Mapping', () => {
    it('should map job types to correct Inngest event names', async () => {
      const mockFetch = vi.mocked(fetch);

      const testCases = [
        { jobType: 'historical-pr-sync', expectedEvent: 'capture/repository.sync.graphql' },
        { jobType: 'recent-prs', expectedEvent: 'capture/repository.sync.graphql' },
        { jobType: 'pr-details', expectedEvent: 'capture/pr.details.graphql' },
        { jobType: 'reviews', expectedEvent: 'capture/pr.reviews' },
        { jobType: 'comments', expectedEvent: 'capture/pr.comments' },
      ];

      for (const { jobType, expectedEvent } of testCases) {
        vi.clearAllMocks();

        await manager.queueJob(jobType, {
          repositoryId: 'test-repo-id',
          repositoryName: 'owner/repo',
          timeRange: 1,
        });

        expect(mockFetch).toHaveBeenCalled();
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe('/api/queue-event');

        const body = JSON.parse(options.body);
        expect(body.eventName).toBe(expectedEvent);
      }
    });

    it('should throw error for unknown job types', async () => {
      await expect(
        manager.queueJob('unknown-job-type', {
          repositoryId: 'test-repo-id',
          repositoryName: 'owner/repo',
        })
      ).rejects.toThrow('Unknown job type for Inngest: unknown-job-type');
    });
  });
});
