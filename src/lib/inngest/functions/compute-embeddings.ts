import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { NonRetriableError } from 'inngest';

interface EmbeddingJobData {
  repositoryId: string;
  forceRegenerate?: boolean;
  itemTypes?: ('issues' | 'pull_requests' | 'discussions')[];
}

/**
 * Background job to compute embeddings for issues, PRs, and discussions
 * Runs every 15 minutes to process new and updated content
 */
export const computeEmbeddings = inngest.createFunction(
  {
    id: 'compute-embeddings',
    name: 'Compute Embeddings for Issues, PRs, and Discussions',
    concurrency: {
      limit: 2,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 5,
      period: '1m',
    },
  },
  [
    { event: 'embeddings/compute.requested' },
    { cron: '*/15 * * * *' }, // Run every 15 minutes
  ],
  async ({ event, step }) => {
    const data = event.data as EmbeddingJobData | undefined;
    const repositoryId = data?.repositoryId;
    const forceRegenerate = data?.forceRegenerate || false;
    const itemTypes = data?.itemTypes || ['issues', 'pull_requests', 'discussions'];

    // Step 1: Create or update job record
    const jobId = await step.run('create-job', async () => {
      const { data: job, error } = await supabase
        .from('embedding_jobs')
        .insert({
          repository_id: repositoryId || null,
          status: 'pending',
          items_total: 0,
          items_processed: 0,
        })
        .select()
        .maybeSingle();

      if (error || !job) {
        throw new NonRetriableError('Failed to create embedding job');
      }

      return job.id;
    });

    // Step 2: Find items needing embeddings
    const itemsToProcess = await step.run('find-items', async () => {
      const items: Array<{
        id: string;
        type: 'issue' | 'pull_request' | 'discussion';
        repository_id: string;
        title: string;
        body: string | null;
        content_hash: string | null;
        embedding_generated_at: string | null;
      }> = [];

      // Build query conditions
      let baseQuery = supabase.from('items_needing_embeddings').select('*');

      if (repositoryId) {
        baseQuery = baseQuery.eq('repository_id', repositoryId);
      }

      // Get items from view
      const { data: viewItems, error } = await baseQuery.limit(100);

      if (error) {
        console.error('Failed to fetch items needing embeddings:', error);
        return [];
      }

      if (viewItems) {
        items.push(...viewItems);
      }

      // If force regenerate, also get items with existing embeddings
      if (forceRegenerate && repositoryId) {
        for (const itemType of itemTypes) {
          // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
          let table: string;
          if (itemType === 'issues') {
            table = 'issues';
          } else if (itemType === 'pull_requests') {
            table = 'pull_requests';
          } else {
            table = 'discussions';
          }
          const { data: forceItems } = await supabase
            .from(table)
            .select('id, repository_id, title, body, content_hash, embedding_generated_at')
            .eq('repository_id', repositoryId)
            .not('embedding', 'is', null)
            .limit(50);

          if (forceItems) {
            items.push(
              ...forceItems.map((item) => ({
                ...item,
                type: itemType.slice(0, -1) as 'issue' | 'pull_request' | 'discussion',
              }))
            );
          }
        }
      }

      // Update job with total count
      await supabase
        .from('embedding_jobs')
        .update({
          items_total: items.length,
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return items;
    });

    if (itemsToProcess.length === 0) {
      await step.run('mark-complete', async () => {
        await supabase
          .from('embedding_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      });
      return { message: 'No items to process', jobId };
    }

    // Step 3: Process embeddings in batches
    const batchSize = 20;
    let processedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);

      await step.run(`process-batch-${i / batchSize}`, async () => {
        try {
          // Generate content hashes if missing
          for (const item of batch) {
            if (!item.content_hash) {
              const crypto = await import('crypto');
              const content = `${item.title || ''}:${item.body || ''}`;
              item.content_hash = crypto
                .createHash('sha256')
                .update(content)
                .digest('hex')
                .substring(0, 16);
            }
          }

          // Generate MiniLM embeddings using local service
          const { generateEmbedding, prepareTextForEmbedding } = await import(
            '../../../../app/services/embeddings'
          );

          const embeddings: Array<{ embedding: number[] }> = [];

          // Process each item in the batch
          for (const item of batch) {
            const embeddingItem = {
              id: item.id,
              title: item.title,
              body: item.body,
              type: item.type,
            };
            const text = prepareTextForEmbedding(embeddingItem);
            const embedding = await generateEmbedding(text);
            embeddings.push({ embedding });
          }

          // Update database with embeddings
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const embedding = embeddings[j]?.embedding;

            if (embedding) {
              // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
              let table: string;
              if (item.type === 'issue') {
                table = 'issues';
              } else if (item.type === 'pull_request') {
                table = 'pull_requests';
              } else {
                table = 'discussions';
              }

              // Update the item with embedding
              await supabase
                .from(table)
                .update({
                  embedding,
                  embedding_generated_at: new Date().toISOString(),
                  content_hash: item.content_hash,
                })
                .eq('id', item.id);

              // Store in cache
              await supabase.from('similarity_cache').upsert(
                {
                  repository_id: item.repository_id,
                  item_type: item.type,
                  item_id: item.id,
                  embedding,
                  content_hash: item.content_hash,
                  ttl_hours: 168, // 7 days for background-generated embeddings
                },
                {
                  onConflict: 'repository_id,item_type,item_id',
                }
              );

              processedCount++;
            }
          }

          // Update job progress
          await supabase.rpc('update_embedding_job_progress', {
            job_id: jobId,
            processed_count: processedCount,
          });
        } catch (error) {
          const errorMsg = `Batch ${i / batchSize} failed: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      });
    }

    // Step 4: Finalize job
    await step.run('finalize-job', async () => {
      // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
      let jobStatus: 'failed' | 'completed';
      if (errors.length > 0 && processedCount === 0) {
        jobStatus = 'failed';
      } else {
        jobStatus = 'completed';
      }

      let errorMessage: string | null;
      if (errors.length > 0) {
        errorMessage = errors.join('; ');
      } else {
        errorMessage = null;
      }

      await supabase
        .from('embedding_jobs')
        .update({
          status: jobStatus,
          items_processed: processedCount,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      // Clean up old cache entries
      await supabase.rpc('cleanup_expired_cache');
    });

    // Avoid ternary - Rollup 4.45.0 bug
    let returnErrors: string[] | undefined;
    if (errors.length > 0) {
      returnErrors = errors;
    } else {
      returnErrors = undefined;
    }

    return {
      jobId,
      processed: processedCount,
      total: itemsToProcess.length,
      errors: returnErrors,
    };
  }
);

/**
 * Trigger embedding computation for a specific repository
 */
export const triggerEmbeddingComputation = async (
  repositoryId: string,
  options?: {
    forceRegenerate?: boolean;
    itemTypes?: ('issues' | 'pull_requests' | 'discussions')[];
  }
) => {
  await inngest.send({
    name: 'embeddings/compute.requested',
    data: {
      repositoryId,
      forceRegenerate: options?.forceRegenerate,
      itemTypes: options?.itemTypes,
    },
  });
};
