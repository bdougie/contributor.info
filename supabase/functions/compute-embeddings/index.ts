/**
 * Compute Embeddings Edge Function
 * Generates MiniLM embeddings for issues, pull requests, and discussions
 *
 * Can be triggered via:
 * - Direct HTTP call
 * - Scheduled cron (via Supabase)
 * - Webhook from GitHub events
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createResponse, createErrorResponse } from '../_shared/responses.ts';
import {
  generateBatchEmbeddings,
  prepareTextForEmbedding,
  createContentHash,
  type EmbeddingItem,
} from '../_shared/embeddings.ts';

interface RequestPayload {
  repositoryId?: string;
  itemIds?: string[];
  itemType?: 'issue' | 'pull_request' | 'discussion';
  limit?: number;
  forceRegenerate?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return createErrorResponse('Server configuration error', 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse request body
    const payload: RequestPayload = req.method === 'POST' ? await req.json() : {};
    const {
      repositoryId,
      itemIds,
      itemType,
      limit = 100,
      forceRegenerate = false,
    } = payload;

    console.log('[Embeddings] Starting computation:', {
      repositoryId,
      itemIds: itemIds?.length,
      itemType,
      limit,
      forceRegenerate,
    });

    // Step 1: Find items needing embeddings
    let itemsToProcess: Array<{
      id: string;
      type: 'issue' | 'pull_request' | 'discussion';
      repository_id: string;
      title: string;
      body: string | null;
      content_hash: string | null;
      embedding: number[] | null;
    }> = [];

    // If specific item IDs provided, fetch them
    if (itemIds && itemIds.length > 0) {
      const tables = itemType ? [itemType === 'issue' ? 'issues' : itemType === 'pull_request' ? 'pull_requests' : 'discussions'] : ['issues', 'pull_requests', 'discussions'];

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('id, repository_id, title, body, content_hash, embedding')
          .in('id', itemIds);

        if (error) {
          console.error(`[Embeddings] Error fetching ${table}:`, error);
          continue;
        }

        if (data) {
          const type = table === 'issues' ? 'issue' : table === 'pull_requests' ? 'pull_request' : 'discussion';
          itemsToProcess.push(
            ...data.map((item) => ({
              ...item,
              type: type as 'issue' | 'pull_request' | 'discussion',
            }))
          );
        }
      }
    } else {
      // Use the view to find items needing embeddings
      let query = supabase.from('items_needing_embeddings').select('*');

      if (repositoryId) {
        query = query.eq('repository_id', repositoryId);
      }

      if (itemType) {
        query = query.eq('type', itemType);
      }

      const { data, error } = await query.limit(limit);

      if (error) {
        console.error('[Embeddings] Error fetching items:', error);
        return createErrorResponse(`Failed to fetch items: ${error.message}`, 500);
      }

      itemsToProcess = data || [];
    }

    // Filter out items that don't need regeneration (unless forced)
    if (!forceRegenerate) {
      itemsToProcess = itemsToProcess.filter((item) => !item.embedding || !item.content_hash);
    }

    console.log(`[Embeddings] Found ${itemsToProcess.length} items to process`);

    if (itemsToProcess.length === 0) {
      return createResponse({
        success: true,
        message: 'No items need embeddings',
        processed: 0,
        total: 0,
      });
    }

    // Step 2: Generate embeddings
    const embeddingItems: EmbeddingItem[] = itemsToProcess.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      type: item.type,
    }));

    const results = await generateBatchEmbeddings(embeddingItems);

    // Step 3: Store embeddings in database
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = itemsToProcess[i];

      if (result.error || result.embedding.length === 0) {
        errorCount++;
        errors.push(`${item.type} ${item.id}: ${result.error || 'Empty embedding'}`);
        continue;
      }

      // Determine table
      const table =
        item.type === 'issue'
          ? 'issues'
          : item.type === 'pull_request'
          ? 'pull_requests'
          : 'discussions';

      // Generate content hash
      const contentHash = await createContentHash(item.title, item.body);

      // Update item with embedding
      const { error: updateError } = await supabase
        .from(table)
        .update({
          embedding: result.embedding,
          embedding_generated_at: new Date().toISOString(),
          content_hash: contentHash,
        })
        .eq('id', item.id);

      if (updateError) {
        errorCount++;
        errors.push(`${item.type} ${item.id}: ${updateError.message}`);
        console.error(`[Embeddings] Failed to update ${item.type} ${item.id}:`, updateError);
        continue;
      }

      // Store in similarity cache
      const { error: cacheError } = await supabase.from('similarity_cache').upsert(
        {
          repository_id: item.repository_id,
          item_type: item.type,
          item_id: item.id,
          embedding: result.embedding,
          content_hash: contentHash,
          ttl_hours: 168, // 7 days
        },
        {
          onConflict: 'repository_id,item_type,item_id',
        }
      );

      if (cacheError) {
        console.warn(`[Embeddings] Failed to cache ${item.type} ${item.id}:`, cacheError);
        // Don't count as error since main update succeeded
      }

      successCount++;
    }

    console.log(`[Embeddings] Completed: ${successCount} success, ${errorCount} errors`);

    return createResponse({
      success: true,
      message: `Processed ${successCount} of ${itemsToProcess.length} items`,
      processed: successCount,
      total: itemsToProcess.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('[Embeddings] Unexpected error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
