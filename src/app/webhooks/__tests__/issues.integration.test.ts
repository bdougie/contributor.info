import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleIssuesEvent } from '../../../../app/webhooks/issues';
import { IssuesEvent } from '../../../../app/types/github';
import { supabase } from '../../../lib/supabase';
import { inngest } from '../../../lib/inngest/client';
import * as issueSimilarity from '../../../../app/services/issue-similarity';
import * as githubApi from '../../../../app/services/github-api';

// Mock all dependencies
vi.mock('../../../lib/supabase');
vi.mock('../../../lib/inngest/client');
vi.mock('../../../../app/services/issue-similarity');
vi.mock('../../../../app/services/github-api');

describe('Issues Webhook Integration', () => {
  const mockRepository = {
    id: 12345,
    full_name: 'test-org/test-repo',
    owner: { login: 'test-org' },
    name: 'test-repo'
  };

  const mockIssue = {
    id: 98765,
    number: 42,
    title: 'Bug: Application crashes on startup',
    body: 'When I try to start the application, it immediately crashes with an error.',
    state: 'open',
    user: {
      id: 11111,
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
      html_url: 'https://github.com/testuser',
      type: 'User'
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    labels: [{ name: 'bug' }],
    assignees: [],
    comments: 0,
    html_url: 'https://github.com/test-org/test-repo/issues/42'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleIssuesEvent - opened', () => {
    it('should process new issue and post similar issues comment', async () => {
      const event: IssuesEvent = {
        action: 'opened',
        issue: mockIssue,
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      // Mock repository exists
      vi.mocked(supabase).from = vi.fn().mockImplementation((table) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { id: 'repo-uuid' } 
                })
              })
            })
          };
        }
        if (table === 'contributors') {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { id: 'contributor-uuid' } 
                })
              })
            })
          };
        }
        if (table === 'issues') {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { id: 'issue-uuid' } 
                })
              })
            })
          };
        }
        return {} as any;
      });

      // Mock similar issues found
      const mockSimilarIssues = [
        {
          number: 10,
          title: 'App crashes on launch',
          state: 'closed',
          similarity: 0.89,
          html_url: 'https://github.com/test-org/test-repo/issues/10'
        }
      ];

      vi.mocked(issueSimilarity.processNewIssue).mockResolvedValue(mockSimilarIssues);
      vi.mocked(issueSimilarity.formatSimilarIssuesComment).mockReturnValue(
        '## 🔍 Similar Issues Found\n\nI found the following similar issues...'
      );
      vi.mocked(githubApi.createIssueComment).mockResolvedValue();
      vi.mocked(inngest.send).mockResolvedValue({} as any);

      await handleIssuesEvent(event);

      // Verify issue was processed for similarity
      expect(issueSimilarity.processNewIssue).toHaveBeenCalledWith({
        id: 'issue-uuid',
        github_id: 98765,
        number: 42,
        title: 'Bug: Application crashes on startup',
        body: 'When I try to start the application, it immediately crashes with an error.',
        repository_id: 'repo-uuid',
        html_url: 'https://github.com/test-org/test-repo/issues/42'
      });

      // Verify comment was posted
      expect(githubApi.createIssueComment).toHaveBeenCalledWith(
        'test-org',
        'test-repo',
        42,
        expect.stringContaining('Similar Issues Found')
      );

      // Verify Inngest event was sent
      expect(inngest.send).toHaveBeenCalledWith({
        name: 'github.issue.analyze',
        data: {
          issue_id: 98765,
          issue_number: 42,
          repository_id: 'repo-uuid',
          repository_name: 'test-org/test-repo'
        }
      });
    });

    it('should not post comment when no similar issues found', async () => {
      const event: IssuesEvent = {
        action: 'opened',
        issue: mockIssue,
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      // Setup mocks
      vi.mocked(supabase).from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } })
          })
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } })
          })
        })
      } as any));

      // No similar issues found
      vi.mocked(issueSimilarity.processNewIssue).mockResolvedValue([]);

      await handleIssuesEvent(event);

      // Should not attempt to create comment
      expect(githubApi.createIssueComment).not.toHaveBeenCalled();
    });

    it('should skip processing for untracked repositories', async () => {
      const event: IssuesEvent = {
        action: 'opened',
        issue: mockIssue,
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      // Repository not found
      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null })
          })
        })
      } as any);

      await handleIssuesEvent(event);

      // Should not process similarity
      expect(issueSimilarity.processNewIssue).not.toHaveBeenCalled();
      expect(githubApi.createIssueComment).not.toHaveBeenCalled();
    });

    it('should handle errors and re-throw for retry', async () => {
      const event: IssuesEvent = {
        action: 'opened',
        issue: mockIssue,
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      // Setup error
      vi.mocked(supabase).from = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Should re-throw error for webhook retry
      await expect(handleIssuesEvent(event)).rejects.toThrow('Database connection failed');
    });
  });

  describe('handleIssuesEvent - other actions', () => {
    it('should handle issue closure', async () => {
      const event: IssuesEvent = {
        action: 'closed',
        issue: { ...mockIssue, state: 'closed', closed_at: '2024-01-02T00:00:00Z' },
        repository: mockRepository,
        sender: { id: 22222, login: 'closer' }
      } as any;

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: mockUpdate
      } as any);

      await handleIssuesEvent(event);

      expect(mockUpdate).toHaveBeenCalledWith({
        state: 'closed',
        closed_at: '2024-01-02T00:00:00Z',
        closed_by_id: 22222,
        updated_at: expect.any(String)
      });
    });

    it('should handle issue reopening', async () => {
      const event: IssuesEvent = {
        action: 'reopened',
        issue: { ...mockIssue, state: 'open' },
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: mockUpdate
      } as any);

      await handleIssuesEvent(event);

      expect(mockUpdate).toHaveBeenCalledWith({
        state: 'open',
        closed_at: null,
        closed_by_id: null,
        updated_at: expect.any(String)
      });
    });

    it('should handle issue edits and trigger re-analysis', async () => {
      const event: IssuesEvent = {
        action: 'edited',
        issue: mockIssue,
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: mockUpdate
      } as any);
      vi.mocked(inngest.send).mockResolvedValue({} as any);

      await handleIssuesEvent(event);

      expect(mockUpdate).toHaveBeenCalledWith({
        title: mockIssue.title,
        body: mockIssue.body,
        updated_at: mockIssue.updated_at
      });

      expect(inngest.send).toHaveBeenCalledWith({
        name: 'github.issue.recalculate_similarity',
        data: {
          issue_id: mockIssue.id,
          repository_id: mockRepository.id
        }
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle missing issue body gracefully', async () => {
      const event: IssuesEvent = {
        action: 'opened',
        issue: { ...mockIssue, body: null },
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      vi.mocked(supabase).from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } })
          })
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } })
          })
        })
      } as any));

      vi.mocked(issueSimilarity.processNewIssue).mockResolvedValue([]);

      // Should not throw error
      await expect(handleIssuesEvent(event)).resolves.not.toThrow();
    });

    it('should handle similarity processing errors gracefully', async () => {
      const event: IssuesEvent = {
        action: 'opened',
        issue: mockIssue,
        repository: mockRepository,
        sender: mockIssue.user
      } as any;

      vi.mocked(supabase).from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } })
          })
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } })
          })
        })
      } as any));

      // Similarity processing fails
      vi.mocked(issueSimilarity.processNewIssue).mockRejectedValue(
        new Error('Embedding generation failed')
      );

      // Should re-throw for retry
      await expect(handleIssuesEvent(event)).rejects.toThrow('Embedding generation failed');
    });
  });
});