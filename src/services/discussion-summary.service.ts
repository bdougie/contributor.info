/**
 * Discussion Summary Service
 * Generates and stores AI summaries for GitHub Discussions
 * Integrates with LLM service and Supabase for persistence
 */

import { supabase } from '@/lib/supabase';
import { llmService } from '@/lib/llm/llm-service';
import type { DiscussionData } from '@/lib/llm/discussion-summary-types';

export interface DiscussionSummaryResult {
  discussionId: string;
  summary: string | null;
  success: boolean;
  error?: string;
}

/**
 * Generate and store summary for a single discussion
 */
export async function generateDiscussionSummary(
  discussionId: string,
  discussionData: DiscussionData
): Promise<DiscussionSummaryResult> {
  try {
    // Generate summary using LLM service
    const result = await llmService.generateDiscussionSummary(discussionData, {
      discussionId,
      feature: 'discussion-summary-service',
    });

    if (!result) {
      return {
        discussionId,
        summary: null,
        success: false,
        error: 'LLM service unavailable',
      };
    }

    // Store summary in database
    const { error: updateError } = await supabase
      .from('discussions')
      .update({ summary: result.content })
      .eq('id', discussionId);

    if (updateError) {
      console.error('Failed to store discussion summary:', updateError);
      return {
        discussionId,
        summary: result.content,
        success: false,
        error: updateError.message,
      };
    }

    return {
      discussionId,
      summary: result.content,
      success: true,
    };
  } catch (error) {
    console.error('Failed to generate discussion summary:', error);
    return {
      discussionId,
      summary: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch generate summaries for multiple discussions
 * Useful for backfilling existing discussions
 */
export async function batchGenerateDiscussionSummaries(
  discussionIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<DiscussionSummaryResult[]> {
  const results: DiscussionSummaryResult[] = [];

  for (let i = 0; i < discussionIds.length; i++) {
    const discussionId = discussionIds[i];

    // Fetch discussion data
    const { data: discussion, error } = await supabase
      .from('discussions')
      .select('id, title, body, category_name, category_emoji, author_login, is_answered')
      .eq('id', discussionId)
      .maybeSingle();

    if (error || !discussion) {
      results.push({
        discussionId,
        summary: null,
        success: false,
        error: error?.message || 'Discussion not found',
      });
      continue;
    }

    // Generate and store summary
    const result = await generateDiscussionSummary(discussionId, {
      title: discussion.title,
      body: discussion.body || null,
      category: discussion.category_name
        ? {
            name: discussion.category_name,
            emoji: discussion.category_emoji || undefined,
          }
        : undefined,
      author: discussion.author_login ? { login: discussion.author_login } : undefined,
      isAnswered: discussion.is_answered || false,
    });

    results.push(result);

    // Report progress
    if (onProgress) {
      onProgress(i + 1, discussionIds.length);
    }

    // Rate limiting: wait 100ms between requests to avoid overwhelming API
    if (i < discussionIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Generate summaries for all discussions in a repository
 */
export async function generateSummariesForRepository(
  repositoryId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<DiscussionSummaryResult[]> {
  // Fetch all discussions without summaries
  const { data: discussions, error } = await supabase
    .from('discussions')
    .select('id')
    .eq('repository_id', repositoryId)
    .is('summary', null);

  if (error) {
    console.error('Failed to fetch discussions:', error);
    return [];
  }

  if (!discussions || discussions.length === 0) {
    console.log('No discussions need summaries for repository:', repositoryId);
    return [];
  }

  const discussionIds = discussions.map((d) => d.id);
  console.log(`Generating summaries for ${discussionIds.length} discussions in repository`);

  return batchGenerateDiscussionSummaries(discussionIds, onProgress);
}

/**
 * Update summary when discussion content changes (webhook integration)
 */
export async function updateDiscussionSummary(
  discussionId: string,
  updatedData: Partial<DiscussionData>
): Promise<DiscussionSummaryResult> {
  // Fetch current discussion data
  const { data: discussion, error } = await supabase
    .from('discussions')
    .select('id, title, body, category_name, category_emoji, author_login, is_answered')
    .eq('id', discussionId)
    .maybeSingle();

  if (error || !discussion) {
    return {
      discussionId,
      summary: null,
      success: false,
      error: error?.message || 'Discussion not found',
    };
  }

  // Merge with updated data
  const discussionData: DiscussionData = {
    title: updatedData.title || discussion.title,
    body: updatedData.body !== undefined ? updatedData.body : discussion.body,
    category: updatedData.category || {
      name: discussion.category_name || '',
      emoji: discussion.category_emoji || undefined,
    },
    author: updatedData.author || { login: discussion.author_login || '' },
    isAnswered:
      updatedData.isAnswered !== undefined ? updatedData.isAnswered : discussion.is_answered,
  };

  return generateDiscussionSummary(discussionId, discussionData);
}
