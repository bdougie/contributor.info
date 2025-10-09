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
    // Log initial event data for debugging
    console.log(
      '[Embeddings] Function invoked with event:',
      JSON.stringify({
        name: event.name,
        hasData: !!event.data,
        repositoryId: (event.data as EmbeddingJobData | undefined)?.repositoryId,
        forceRegenerate: (event.data as EmbeddingJobData | undefined)?.forceRegenerate,
        itemTypes: (event.data as EmbeddingJobData | undefined)?.itemTypes,
      })
    );

    const data = event.data as EmbeddingJobData | undefined;
    const repositoryId = data?.repositoryId;
    const forceRegenerate = data?.forceRegenerate || false;
    const itemTypes = data?.itemTypes || ['issues', 'pull_requests', 'discussions'];

    // Step 1: Create or update job record
    const jobId = await step.run('create-job', async () => {
      console.log('[Embeddings] Creating job record for repository:', repositoryId);

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

      if (error) {
        console.error('[Embeddings] Failed to create job record:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          repositoryId,
        });
        throw new NonRetriableError(`Failed to create embedding job: ${error.message}`);
      }

      if (!job) {
        console.error('[Embeddings] Job created but no data returned');
        throw new NonRetriableError('Failed to create embedding job: no data returned');
      }

      console.log('[Embeddings] Job created successfully:', job.id);
      return job.id;
    });

    // Step 2: Find items needing embeddings
    const itemsToProcess = await step.run('find-items', async () => {
      console.log('[Embeddings] Finding items to process:', {
        repositoryId,
        forceRegenerate,
        itemTypes,
      });

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
        console.error('[Embeddings] Failed to fetch items needing embeddings:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          repositoryId,
        });
        return [];
      }

      console.log('[Embeddings] Found items from view:', viewItems?.length || 0);

      if (viewItems) {
        items.push(...viewItems);
      }

      // If force regenerate, also get items with existing embeddings
      if (forceRegenerate && repositoryId) {
        console.log('[Embeddings] Force regenerate enabled, fetching existing embeddings');
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
          const { data: forceItems, error: forceError } = await supabase
            .from(table)
            .select('id, repository_id, title, body, content_hash, embedding_generated_at')
            .eq('repository_id', repositoryId)
            .not('embedding', 'is', null)
            .limit(50);

          if (forceError) {
            console.error(`[Embeddings] Failed to fetch existing ${itemType}:`, {
              error: forceError.message,
              code: forceError.code,
              table,
            });
          }

          if (forceItems) {
            console.log(
              `[Embeddings] Found ${forceItems.length} existing ${itemType} to regenerate`
            );
            items.push(
              ...forceItems.map((item) => ({
                ...item,
                type: itemType.slice(0, -1) as 'issue' | 'pull_request' | 'discussion',
              }))
            );
          }
        }
      }

      console.log('[Embeddings] Total items to process:', items.length);

      // Update job with total count
      const { error: updateError } = await supabase
        .from('embedding_jobs')
        .update({
          items_total: items.length,
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateError) {
        console.error('[Embeddings] Failed to update job status:', {
          error: updateError.message,
          jobId,
        });
      }

      return items;
    });

    if (itemsToProcess.length === 0) {
      console.log('[Embeddings] No items to process, marking job as complete');
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

    console.log('[Embeddings] Starting batch processing:', {
      totalItems: itemsToProcess.length,
      batchSize,
      totalBatches: Math.ceil(itemsToProcess.length / batchSize),
    });

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);
      const batchNumber = i / batchSize;

      await step.run(`process-batch-${batchNumber}`, async () => {
        console.log(`[Embeddings] Processing batch ${batchNumber + 1}:`, {
          batchSize: batch.length,
          itemIds: batch.map((item) => item.id).slice(0, 5), // Log first 5 IDs
        });

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

          // Call OpenAI API for batch embeddings
          const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            const errorMsg =
              'OpenAI API key not configured - check VITE_OPENAI_API_KEY or OPENAI_API_KEY environment variables';
            console.error('[Embeddings]', errorMsg, {
              hasViteKey: !!process.env.VITE_OPENAI_API_KEY,
              hasOpenAIKey: !!process.env.OPENAI_API_KEY,
              availableEnvVars: Object.keys(process.env).filter(
                (k) => k.includes('OPENAI') || k.includes('KEY')
              ),
            });
            throw new Error(errorMsg);
          }

          const texts = batch.map((item) =>
            `[${item.type.toUpperCase()}] ${item.title} ${item.body || ''}`.substring(0, 2000)
          );

          console.log(`[Embeddings] Calling OpenAI API for ${texts.length} texts`);

          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: texts,
              dimensions: 384, // CRITICAL: Specify 384 dimensions to match database schema
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[Embeddings] OpenAI API error:', {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
              batchNumber,
              textsCount: texts.length,
            });
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          const embeddings = data.data;

          console.log(
            `[Embeddings] Generated ${embeddings.length} embeddings for batch ${batchNumber + 1}`
          );

          // Update database with embeddings
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const embedding = embeddings[j]?.embedding;

            if (!embedding) {
              console.warn(`[Embeddings] No embedding returned for item ${item.id} at index ${j}`);
              continue;
            }

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
            const { error: updateError } = await supabase
              .from(table)
              .update({
                embedding,
                embedding_generated_at: new Date().toISOString(),
                content_hash: item.content_hash,
              })
              .eq('id', item.id);

            if (updateError) {
              const errorMsg = `Failed to update ${item.type} ${item.id}: ${updateError.message}`;
              console.error('[Embeddings]', errorMsg, {
                table,
                itemId: item.id,
                errorCode: updateError.code,
                errorDetails: updateError.details,
              });
              errors.push(errorMsg);
              continue;
            }

            // Store in cache
            const { error: cacheError } = await supabase.from('similarity_cache').upsert(
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

            if (cacheError) {
              console.warn('[Embeddings] Cache warning:', {
                message: cacheError.message,
                code: cacheError.code,
                itemId: item.id,
              });
              // Don't fail on cache errors
            }

            processedCount++;
          }

          console.log(`[Embeddings] Batch ${batchNumber + 1} complete:`, {
            processed: processedCount,
            batchErrors: errors.length,
          });

          // Update job progress
          const { error: progressError } = await supabase.rpc('update_embedding_job_progress', {
            job_id: jobId,
            processed_count: processedCount,
          });

          if (progressError) {
            console.error('[Embeddings] Failed to update job progress:', {
              error: progressError.message,
              jobId,
              processedCount,
            });
          }
        } catch (error) {
          const errorMsg = `Batch ${batchNumber + 1} failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error('[Embeddings]', errorMsg, {
            batchNumber: batchNumber + 1,
            batchSize: batch.length,
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : error,
          });
          errors.push(errorMsg);
        }
      });
    }

    // Step 4: Finalize job
    await step.run('finalize-job', async () => {
      console.log('[Embeddings] Finalizing job:', {
        jobId,
        processedCount,
        totalItems: itemsToProcess.length,
        errorCount: errors.length,
      });

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

      const { error: finalizeError } = await supabase
        .from('embedding_jobs')
        .update({
          status: jobStatus,
          items_processed: processedCount,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (finalizeError) {
        console.error('[Embeddings] Failed to finalize job:', {
          error: finalizeError.message,
          jobId,
          jobStatus,
        });
      }

      // Clean up old cache entries
      const { error: cleanupError } = await supabase.rpc('cleanup_expired_cache');
      if (cleanupError) {
        console.warn('[Embeddings] Cache cleanup warning:', cleanupError.message);
      }

      console.log('[Embeddings] Job finalized:', {
        jobId,
        status: jobStatus,
        processed: processedCount,
        total: itemsToProcess.length,
        errors: errors.length,
      });
    });

    // Avoid ternary - Rollup 4.45.0 bug
    let returnErrors: string[] | undefined;
    if (errors.length > 0) {
      returnErrors = errors;
    } else {
      returnErrors = undefined;
    }

    const result = {
      jobId,
      processed: processedCount,
      total: itemsToProcess.length,
      errors: returnErrors,
    };

    console.log('[Embeddings] Function complete:', result);
    return result;
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
