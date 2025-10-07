import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDiscussionSummary,
  batchGenerateDiscussionSummaries,
} from '../discussion-summary.service';
import { llmService } from '@/lib/llm/llm-service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');
vi.mock('@/lib/llm/llm-service');

describe('Discussion Summary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDiscussionSummary', () => {
    it('should generate and store summary successfully', async () => {
      const mockSummary = {
        type: 'discussion_summary' as const,
        content: 'How to implement OAuth2 authentication with token refresh',
        confidence: 0.8,
        timestamp: new Date(),
      };

      vi.mocked(llmService.generateDiscussionSummary).mockResolvedValue(mockSummary);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as never);

      const result = await generateDiscussionSummary('disc-123', {
        title: 'How to implement OAuth2?',
        body: 'I need help implementing OAuth2 authentication...',
      });

      expect(result).toEqual({
        discussionId: 'disc-123',
        summary: mockSummary.content,
        success: true,
      });

      expect(llmService.generateDiscussionSummary).toHaveBeenCalledWith(
        {
          title: 'How to implement OAuth2?',
          body: 'I need help implementing OAuth2 authentication...',
        },
        {
          discussionId: 'disc-123',
          feature: 'discussion-summary-service',
        }
      );
    });

    it('should handle LLM service unavailable', async () => {
      vi.mocked(llmService.generateDiscussionSummary).mockResolvedValue(null);

      const result = await generateDiscussionSummary('disc-123', {
        title: 'Test',
        body: 'Test body',
      });

      expect(result).toEqual({
        discussionId: 'disc-123',
        summary: null,
        success: false,
        error: 'LLM service unavailable',
      });
    });

    it('should handle database update failure', async () => {
      const mockSummary = {
        type: 'discussion_summary' as const,
        content: 'Test summary',
        confidence: 0.8,
        timestamp: new Date(),
      };

      vi.mocked(llmService.generateDiscussionSummary).mockResolvedValue(mockSummary);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      } as never);

      const result = await generateDiscussionSummary('disc-123', {
        title: 'Test',
        body: 'Test body',
      });

      expect(result).toEqual({
        discussionId: 'disc-123',
        summary: mockSummary.content,
        success: false,
        error: 'DB error',
      });
    });
  });

  describe('batchGenerateDiscussionSummaries', () => {
    it('should generate summaries for multiple discussions', async () => {
      const mockDiscussions = [
        {
          id: 'disc-1',
          title: 'OAuth Question',
          body: 'How to implement OAuth?',
          category_name: 'Q&A',
          author_login: 'user1',
          is_answered: false,
        },
        {
          id: 'disc-2',
          title: 'API Rate Limiting',
          body: 'How to handle rate limits?',
          category_name: 'Q&A',
          author_login: 'user2',
          is_answered: true,
        },
      ];

      const mockSummary = {
        type: 'discussion_summary' as const,
        content: 'Test summary',
        confidence: 0.8,
        timestamp: new Date(),
      };

      // Mock supabase select for each discussion
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'discussions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  const callCount = vi.mocked(supabase.from).mock.calls.length;
                  return {
                    data: mockDiscussions[callCount % 2],
                    error: null,
                  };
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as never;
        }
        return {} as never;
      });

      vi.mocked(llmService.generateDiscussionSummary).mockResolvedValue(mockSummary);

      const progressCallback = vi.fn();
      const results = await batchGenerateDiscussionSummaries(
        ['disc-1', 'disc-2'],
        progressCallback
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(progressCallback).toHaveBeenCalledWith(1, 2);
      expect(progressCallback).toHaveBeenCalledWith(2, 2);
    });

    it('should handle discussion not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      } as never);

      const results = await batchGenerateDiscussionSummaries(['disc-404']);

      expect(results).toEqual([
        {
          discussionId: 'disc-404',
          summary: null,
          success: false,
          error: 'Not found',
        },
      ]);
    });
  });
});
