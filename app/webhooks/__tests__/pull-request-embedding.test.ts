import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePullRequestEvent } from '../pull-request';
import type { PullRequestEvent } from '../../types/github';
import { embeddingQueueService } from '../../services/webhook/embedding-queue';
import { webhookDataService } from '../../services/webhook/data-service';

// Mock dependencies
vi.mock('../../lib/auth', () => ({
  githubAppAuth: {
    getInstallationOctokit: vi.fn(),
  },
}));

vi.mock('../../../src/lib/supabase', () => {
  const chain = {
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    select: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    update: vi.fn(() => chain),
  };

  return {
    supabase: {
      from: vi.fn(() => chain),
    },
  };
});

vi.mock('../../services/contributor-config', () => ({
  fetchContributorConfig: vi.fn(),
  isFeatureEnabled: vi.fn(),
  isUserExcluded: vi.fn(),
  generateCodeOwnersSuggestion: vi.fn(),
}));

vi.mock('../../services/similarity', () => ({
  findSimilarIssues: vi.fn(),
}));

vi.mock('../../services/webhook/data-service', () => ({
  webhookDataService: {
    storePR: vi.fn(),
    ensureRepository: vi.fn(),
    storeWebhookData: vi.fn(),
  },
}));

vi.mock('../../services/webhook/similarity-updater', () => ({
  webhookSimilarityService: {
    handlePREvent: vi.fn(() => Promise.resolve([])),
    updatePRSimilarity: vi.fn(),
  },
}));

vi.mock('../event-router', () => {
  const mockEventRouter = {
    routeEvent: vi.fn(() => Promise.resolve()),
  };
  return {
    eventRouter: mockEventRouter,
    EventRouter: {
      getInstance: vi.fn(() => mockEventRouter),
    },
  };
});

vi.mock('../../services/webhook-metrics', () => ({
  webhookMetricsService: {
    recordEvent: vi.fn(),
    trackWebhookProcessing: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../services/similarity-metrics', () => ({
  similarityMetricsService: {
    recordSimilarityCheck: vi.fn(),
    trackPrediction: vi.fn(),
    trackSimilarityUpdate: vi.fn(),
  },
}));

vi.mock('../../services/insights', () => ({
  generatePRInsights: vi.fn(),
  ContributorInsights: {},
}));

vi.mock('../../services/comments', () => ({
  formatPRComment: vi.fn(),
  formatMinimalPRComment: vi.fn(),
}));

vi.mock('../../services/reviewers', () => ({
  suggestReviewers: vi.fn(),
}));

vi.mock('../pr-check-runs', () => ({
  handlePRCheckRuns: vi.fn(),
}));

// Mock embedding queue service
vi.mock('../../services/webhook/embedding-queue', () => ({
  embeddingQueueService: {
    queuePREmbedding: vi.fn(),
  },
}));

describe('PR Embedding Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  it('should queue embedding generation when PR is opened', async () => {
    const prId = 'pr-uuid-123';
    const repoId = 'repo-uuid-456';

    // Mock data service responses
    vi.mocked(webhookDataService.ensureRepository).mockResolvedValue(repoId);
    vi.mocked(webhookDataService.storePR).mockResolvedValue(prId);

    const openedEvent = {
      action: 'opened',
      pull_request: {
        id: 123,
        number: 1,
        title: 'Test PR',
        draft: false,
        state: 'open',
        user: { login: 'test-user', id: 1 },
        labels: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      repository: {
        id: 456,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner' },
      },
      installation: { id: 789 },
    } as PullRequestEvent;

    await handlePullRequestEvent(openedEvent);

    // Verify embedding queue called with correct ID
    expect(embeddingQueueService.queuePREmbedding).toHaveBeenCalledWith(
      prId,
      repoId,
      'high'
    );
  });

  it('should queue embedding generation when PR is edited', async () => {
    const prId = 'pr-uuid-123';
    const repoId = 'repo-uuid-456';

    // Mock data service responses
    vi.mocked(webhookDataService.ensureRepository).mockResolvedValue(repoId);
    vi.mocked(webhookDataService.storePR).mockResolvedValue(prId);

    const editedEvent = {
      action: 'edited',
      pull_request: {
        id: 123,
        number: 1,
        title: 'Test PR',
        draft: false,
        state: 'open',
        user: { login: 'test-user', id: 1 },
        labels: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      repository: {
        id: 456,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner' },
      },
      installation: { id: 789 },
    } as PullRequestEvent;

    await handlePullRequestEvent(editedEvent);

    // Verify embedding queue called
    expect(embeddingQueueService.queuePREmbedding).toHaveBeenCalledWith(
      prId,
      repoId,
      'medium' // Edited events usually have medium priority
    );
  });
});
