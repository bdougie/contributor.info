/**
 * Similarity Search Service
 *
 * Finds similar items (PRs, issues, discussions) within a workspace using vector embeddings.
 * Helps users respond to items by suggesting relevant related content.
 */

import { supabase } from '@/lib/supabase';

export interface SimilarItem {
  id: string;
  type: 'pr' | 'issue' | 'discussion';
  number: number;
  title: string;
  repository: string;
  url: string;
  similarity: number;
  status: 'open' | 'merged' | 'closed' | 'answered';
}

export interface SimilaritySearchOptions {
  workspaceId: string;
  queryItem: {
    title: string;
    body?: string | null;
    type: 'pr' | 'issue' | 'discussion';
    id: string;
  };
  limit?: number;
}

/**
 * Find similar items across PRs, issues, and discussions within a workspace
 */
export async function findSimilarItems(options: SimilaritySearchOptions): Promise<SimilarItem[]> {
  const { workspaceId, queryItem, limit = 4 } = options;

  try {
    // Step 1: Get workspace repository IDs
    const { data: workspaceRepos, error: workspaceError } = await supabase
      .from('workspace_repositories')
      .select('repository_id')
      .eq('workspace_id', workspaceId);

    if (workspaceError) {
      console.error('Error fetching workspace repositories:', workspaceError);
      throw new Error(`Failed to fetch workspace repositories: ${workspaceError.message}`);
    }

    if (!workspaceRepos || workspaceRepos.length === 0) {
      return [];
    }

    const repoIds = workspaceRepos.map((wr) => wr.repository_id);

    // Step 2: Strip any UI prefixes from the ID (e.g., "discussion-", "issue-", "pr-")
    const rawId = queryItem.id.replace(/^(discussion|issue|pr)-/, '');

    // Step 3: Fetch embedding from database
    // Determine table name based on item type
    let tableName: string;
    if (queryItem.type === 'pr') {
      tableName = 'pull_requests';
    } else if (queryItem.type === 'issue') {
      tableName = 'github_issues';
    } else {
      tableName = 'discussions';
    }

    const { data: itemData, error: fetchError } = await supabase
      .from(tableName)
      .select('embedding')
      .eq('id', rawId)
      .maybeSingle();

    if (fetchError || !itemData?.embedding) {
      console.error('No embedding found for item:', rawId);
      return [];
    }

    // Embedding is already in array format from database
    const embeddingArray = itemData.embedding;

    // Step 4: Search for similar PRs
    // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
    let excludePrId: string | null;
    if (queryItem.type === 'pr') {
      excludePrId = rawId;
    } else {
      excludePrId = null;
    }

    const { data: similarPRs, error: prError } = await supabase.rpc(
      'find_similar_pull_requests_in_workspace',
      {
        query_embedding: embeddingArray,
        repo_ids: repoIds,
        match_count: limit,
        exclude_pr_id: excludePrId,
      }
    );

    if (prError) {
      console.error('Error finding similar PRs:', prError);
      // Don't throw - continue with empty PR results
    }

    // Step 5: Search for similar issues
    // NOTE: The github_issues table (used by find_similar_issues_in_workspace RPC)
    // does not have an embedding column. Skip issue similarity for now.
    // TODO: Either add embeddings to github_issues or use the issues table instead
    const similarIssues: Array<{
      id: string;
      number: number;
      title: string;
      state: string;
      similarity: number;
      html_url: string;
      repository_name: string;
    }> = [];

    // Step 6: Search for similar discussions
    // Note: The RPC function has a bug - it expects UUID but discussions use VARCHAR IDs
    // For now, we pass null to avoid the type error and filter client-side
    const { data: similarDiscussions, error: discussionError } = await supabase.rpc(
      'find_similar_discussions_in_workspace',
      {
        query_embedding: embeddingArray,
        repo_ids: repoIds,
        match_count: limit + 1, // Request one extra to account for filtering
        exclude_discussion_id: null, // Can't use VARCHAR ID with UUID parameter
      }
    );

    if (discussionError) {
      console.error('Error finding similar discussions:', discussionError);
      // Don't throw - continue with empty discussion results
    }

    // Step 7: Combine and format results
    const allResults: SimilarItem[] = [];

    // Add PRs
    if (similarPRs) {
      similarPRs.forEach(
        (pr: {
          id: string;
          number: number;
          title: string;
          state: string;
          merged_at: string | null;
          similarity: number;
          html_url: string;
          repository_name: string;
        }) => {
          // Use if statements to avoid Rollup 4.45.0 ternary bug (see docs/architecture/state-machine-patterns.md)
          let prStatus: 'open' | 'merged' | 'closed';
          if (pr.state === 'open') {
            prStatus = 'open';
          } else if (pr.merged_at) {
            prStatus = 'merged';
          } else {
            prStatus = 'closed';
          }

          allResults.push({
            id: pr.id,
            type: 'pr',
            number: pr.number,
            title: pr.title,
            repository: pr.repository_name,
            url: pr.html_url,
            similarity: pr.similarity,
            status: prStatus,
          });
        }
      );
    }

    // Add Issues
    if (similarIssues) {
      similarIssues.forEach(
        (issue: {
          id: string;
          number: number;
          title: string;
          state: string;
          similarity: number;
          html_url: string;
          repository_name: string;
        }) => {
          allResults.push({
            id: issue.id,
            type: 'issue',
            number: issue.number,
            title: issue.title,
            repository: issue.repository_name,
            url: issue.html_url,
            similarity: issue.similarity,
            status: issue.state as 'open' | 'closed',
          });
        }
      );
    }

    // Add Discussions
    if (similarDiscussions) {
      similarDiscussions.forEach(
        (discussion: {
          id: string;
          number: number;
          title: string;
          is_answered: boolean;
          similarity: number;
          html_url: string;
          repository_name: string;
        }) => {
          // Filter out the current discussion (client-side since RPC can't handle VARCHAR IDs)
          if (queryItem.type === 'discussion' && discussion.id === rawId) {
            return;
          }

          // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
          let discussionStatus: 'answered' | 'open';
          if (discussion.is_answered) {
            discussionStatus = 'answered';
          } else {
            discussionStatus = 'open';
          }

          allResults.push({
            id: discussion.id,
            type: 'discussion',
            number: discussion.number,
            title: discussion.title,
            repository: discussion.repository_name,
            url: discussion.html_url,
            similarity: discussion.similarity,
            status: discussionStatus,
          });
        }
      );
    }

    // Step 8: Sort by similarity and return top N
    const sortedResults = allResults.sort((a, b) => b.similarity - a.similarity).slice(0, limit);

    return sortedResults;
  } catch (error) {
    console.error('Error in similarity search:', error);
    throw error;
  }
}

/**
 * Generate a formatted response message with similar items
 */
export function generateResponseMessage(similarItems: SimilarItem[]): string {
  if (similarItems.length === 0) {
    return 'No similar items found in this workspace.';
  }

  const lines = ['Sharing some relevant links from this workspace:\n'];

  similarItems.forEach((item) => {
    // Use lookup tables to avoid Rollup 4.45.0 ternary bug (see docs/architecture/state-machine-patterns.md)
    const typeLabelMap: Record<string, string> = {
      pr: 'PR',
      issue: 'Issue',
      discussion: 'Discussion',
    };
    const typeLabel = typeLabelMap[item.type] || 'Item';

    const statusEmojiMap: Record<string, string> = {
      merged: '🟣',
      closed: '🔴',
      answered: '✅',
      open: '🟢',
    };
    const statusEmoji = statusEmojiMap[item.status] || '⚫';

    lines.push(`${statusEmoji} **${typeLabel} #${item.number}**: ${item.title}`);
    lines.push(`   📍 ${item.repository}`);
    lines.push(`   🔗 ${item.url}`);
    lines.push('');
  });

  return lines.join('\n');
}
