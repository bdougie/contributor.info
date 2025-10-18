/**
 * Similarity Search Service
 *
 * Finds similar items (PRs, issues, discussions) within a workspace using vector embeddings.
 * Helps users respond to items by suggesting relevant related content.
 *
 * Uses standardized 384-dimension embeddings across all entity types for consistent
 * cross-entity similarity search.
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
  const { workspaceId, queryItem, limit = 7 } = options;

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
      tableName = 'issues';
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

    // Step 4: Use the new cross-entity similarity function
    // This function handles all entity types in a single call with consistent dimensions
    const { data: similarItems, error: similarityError } = await supabase.rpc(
      'find_similar_items_cross_entity',
      {
        query_embedding: embeddingArray,
        repo_ids: repoIds,
        match_count: Math.min(limit * 3, 100), // Cap at 100 to prevent excessive database load
        exclude_item_type: queryItem.type,
        exclude_item_id: rawId,
      }
    );

    if (similarityError) {
      console.error('Error finding similar items:', similarityError);
      throw new Error(`Failed to find similar items: ${similarityError.message}`);
    }

    // Step 5: Format results
    const allResults: SimilarItem[] = [];

    if (similarItems) {
      similarItems.forEach(
        (item: {
          item_type: string;
          id: string;
          title: string;
          number: number;
          similarity: number;
          url: string;
          state: string;
          repository_name: string;
        }) => {
          // Map item_type to our SimilarItem type
          // Skip items with unknown types to fail gracefully
          let itemType: 'pr' | 'issue' | 'discussion';
          if (item.item_type === 'pull_request') {
            itemType = 'pr';
          } else if (item.item_type === 'issue') {
            itemType = 'issue';
          } else if (item.item_type === 'discussion') {
            itemType = 'discussion';
          } else {
            // Unknown item type - skip this item
            console.warn('Unknown item_type from database:', item.item_type);
            return;
          }

          // Map state to our status format
          let status: 'open' | 'merged' | 'closed' | 'answered';
          if (itemType === 'pr') {
            // For PRs, state comes from the database
            if (item.state === 'open') {
              status = 'open';
            } else if (item.state === 'merged') {
              status = 'merged';
            } else {
              status = 'closed';
            }
          } else if (itemType === 'discussion') {
            // For discussions, state is either 'answered' or 'open'
            if (item.state === 'answered') {
              status = 'answered';
            } else {
              status = 'open';
            }
          } else {
            // For issues, state is 'open' or 'closed'
            status = item.state as 'open' | 'closed';
          }

          allResults.push({
            id: item.id,
            type: itemType,
            number: item.number,
            title: item.title,
            repository: item.repository_name,
            url: item.url,
            similarity: item.similarity,
            status: status,
          });
        }
      );
    }

    // Step 6: Sort by similarity and return top N
    const sortedResults = allResults.sort((a, b) => b.similarity - a.similarity).slice(0, limit);

    return sortedResults;
  } catch (error) {
    console.error('Error in similarity search:', error);
    throw error;
  }
}

/**
 * Generate a formatted response message with similar items
 * Matches the Continue project's GitHub Actions format for consistency
 */
export function generateResponseMessage(similarItems: SimilarItem[]): string {
  if (similarItems.length === 0) {
    return 'No similar items found in this workspace.';
  }

  const lines = [
    'I found some existing items that might be related. Let me know if these are helpful:\n',
  ];

  // Table header
  lines.push('| # | Title | Status |');
  lines.push('|---|-------|--------|');

  similarItems.forEach((item) => {
    // Use lookup tables to avoid Rollup 4.45.0 ternary bug (see docs/architecture/state-machine-patterns.md)
    const statusLabelMap: Record<string, string> = {
      merged: 'Merged',
      closed: 'Closed',
      answered: 'Answered',
      open: 'Open',
    };
    const statusLabel = statusLabelMap[item.status] || 'Unknown';

    const statusEmojiMap: Record<string, string> = {
      merged: '🟣',
      closed: '🔴',
      answered: '✅',
      open: '🟢',
    };
    const statusEmoji = statusEmojiMap[item.status] || '⚫';

    // Format table row
    lines.push(
      `| [#${item.number}](${item.url}) | ${item.title} | ${statusEmoji} ${statusLabel} |`
    );
  });

  return lines.join('\n');
}
