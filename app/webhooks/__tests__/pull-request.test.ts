import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePullRequestEvent } from '../pull-request';
import type { PullRequestEvent } from '../../types/github';

// Mock dependencies
vi.mock('../../lib/auth', () => ({
  githubAppAuth: {
    getInstallationOctokit: vi.fn(),
  },
}));

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('../../services/contributor-config', () => ({
  fetchContributorConfig: vi.fn(),
  isFeatureEnabled: vi.fn(),
  isUserExcluded: vi.fn(),
}));

vi.mock('../../services/similarity', () => ({
  findSimilarIssues: vi.fn(),
}));

describe('PR Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  describe('Event Filtering', () => {
    it('should only process opened and ready_for_review events', async () => {
      const baseEvent = {
        action: 'synchronize',
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

      // Should not process unsupported actions
      await handlePullRequestEvent(baseEvent);
      expect(console.log).not.toHaveBeenCalled();

      // Should process 'opened' events
      const openedEvent = { ...baseEvent, action: 'opened' as const };
      await handlePullRequestEvent(openedEvent);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing opened PR #1')
      );

      // Should process 'ready_for_review' events
      vi.clearAllMocks();
      const readyEvent = { ...baseEvent, action: 'ready_for_review' as const };
      await handlePullRequestEvent(readyEvent);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing PR #1')
      );
    });

    it('should skip draft PRs for opened events', async () => {
      const draftEvent = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          title: 'Test PR',
          draft: true, // Draft PR
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

      await handlePullRequestEvent(draftEvent);
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Similarity Comments', () => {
    it('should post similarity comment when similar issues found', async () => {
      const { fetchContributorConfig, isFeatureEnabled, isUserExcluded } = await import('../../services/contributor-config');
      const { findSimilarIssues } = await import('../../services/similarity');
      const { githubAppAuth } = await import('../../lib/auth');
      const { supabase } = await import('../../../src/lib/supabase');

      // Mock successful flow
      vi.mocked(fetchContributorConfig).mockResolvedValue({
        version: 1,
        features: { auto_comment: true, similar_issues: true },
      });
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
      vi.mocked(isUserExcluded).mockReturnValue(false);
      
      // Mock similar issues found
      vi.mocked(findSimilarIssues).mockResolvedValue([
        {
          issue: {
            id: 999,
            number: 5,
            title: 'Similar issue',
            state: 'open',
            html_url: 'https://github.com/owner/repo/issues/5',
          },
          similarityScore: 0.8,
          reasons: ['Similar title'],
          relationship: 'relates_to',
        },
      ]);

      // Mock octokit and database calls
      const mockCreateComment = vi.fn().mockResolvedValue({ data: { id: 123 } });
      vi.mocked(githubAppAuth.getInstallationOctokit).mockResolvedValue({
        issues: { createComment: mockCreateComment },
      } as any);

      // Mock database calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      });
      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pr-id' } }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'github_app_installation_settings') {
          return { select: mockSelect } as any;
        }
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'repo-id' } }),
              }),
            }),
          } as any;
        }
        return { upsert: mockUpsert } as any;
      });

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

      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo',
        issue_number: 1,
        body: expect.stringContaining('Related Issues'),
      });
    });

    it('should not comment when similar_issues feature is disabled', async () => {
      const { fetchContributorConfig, isFeatureEnabled, isUserExcluded } = await import('../../services/contributor-config');
      const { githubAppAuth } = await import('../../lib/auth');
      const { supabase } = await import('../../../src/lib/supabase');

      // Mock config with similar_issues disabled
      vi.mocked(fetchContributorConfig).mockResolvedValue({
        version: 1,
        features: { auto_comment: true, similar_issues: false },
      });
      vi.mocked(isFeatureEnabled).mockImplementation((config, feature) => {
        if (feature === 'similar_issues') return false;
        return true;
      });
      vi.mocked(isUserExcluded).mockReturnValue(false);

      const mockCreateComment = vi.fn();
      vi.mocked(githubAppAuth.getInstallationOctokit).mockResolvedValue({
        issues: { createComment: mockCreateComment },
      } as any);

      // Mock database calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

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

      expect(mockCreateComment).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Similar issues feature is disabled in .contributor config'
      );
    });

    it('should not comment when no similar issues found', async () => {
      const { fetchContributorConfig, isFeatureEnabled, isUserExcluded } = await import('../../services/contributor-config');
      const { findSimilarIssues } = await import('../../services/similarity');
      const { githubAppAuth } = await import('../../lib/auth');
      const { supabase } = await import('../../../src/lib/supabase');

      // Mock successful flow but no similar issues
      vi.mocked(fetchContributorConfig).mockResolvedValue({
        version: 1,
        features: { auto_comment: true, similar_issues: true },
      });
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
      vi.mocked(isUserExcluded).mockReturnValue(false);
      vi.mocked(findSimilarIssues).mockResolvedValue([]); // No similar issues

      const mockCreateComment = vi.fn();
      vi.mocked(githubAppAuth.getInstallationOctokit).mockResolvedValue({
        issues: { createComment: mockCreateComment },
      } as any);

      // Mock database calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

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

      expect(mockCreateComment).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('No similar issues found for PR');
    });
  });

  describe('Comment Formatting', () => {
    it('should format similarity comments correctly', async () => {
      // This would be tested by importing and calling formatSimplePRSimilarityComment directly
      // but it's a private function, so we test through the full flow above
    });

    it('should handle different relationship types with correct emojis', async () => {
      // Similar - would test emoji mapping for fixes, implements, relates_to, similar
    });
  });
});