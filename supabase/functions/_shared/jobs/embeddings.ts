/**
 * Embedding jobs. One implementation, `computeEmbeddings`, ported from the
 * Inngest `compute-embeddings` function in supabase/functions/inngest-prod.
 * The webhook bridge events (`embedding/issue.generate`, `embedding/pr.generate`,
 * `embedding/batch.process`, `similarity/repository.recalculate`) and the
 * `embeddings.generate` fan-out all reduce to "compute for this repository";
 * queue-event dedupes queued (not running) ones per repository, see retired.ts.
 */

import { asNumber, asString, NonRetriableJobError } from './types.ts';
import type { JobContext, JobHandler, JobPayload, JobResult } from './types.ts';

type ItemType = 'issue' | 'pull_request' | 'discussion';
type ItemTable = 'issues' | 'pull_requests' | 'discussions';

interface EmbeddingItem {
  id: string;
  repository_id: string;
  title: string;
  body: string | null;
  content_hash: string | null;
  type: ItemType;
}

interface ViewRow {
  id: string;
  repository_id: string;
  title: string;
  body: string | null;
  content_hash: string | null;
  item_type: ItemType;
}

interface TableRow {
  id: string;
  repository_id: string;
  title: string;
  body: string | null;
  content_hash: string | null;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const BATCH_SIZE = 20;
const EMBEDDING_MODEL = 'text-embedding-3-small';
/** Must match the vector(384) columns on issues/pull_requests/discussions. */
const EMBEDDING_DIMENSIONS = 384;
const CACHE_TTL_HOURS = 168;
/** Same window the items_needing_embeddings view uses. */
const MAX_ITEM_AGE_DAYS = 90;

const TABLE_FOR_TYPE: Record<ItemType, ItemTable> = {
  issue: 'issues',
  pull_request: 'pull_requests',
  discussion: 'discussions',
};

const ITEM_TYPES: Record<string, ItemType> = {
  issues: 'issue',
  pull_requests: 'pull_request',
  discussions: 'discussion',
};

function normalizeItemTypes(value: unknown): ItemType[] {
  if (!Array.isArray(value)) return ['issue', 'pull_request', 'discussion'];
  const types = value
    .map((v) => (typeof v === 'string' ? ITEM_TYPES[v] : undefined))
    .filter((v): v is ItemType => v !== undefined);
  return types.length > 0 ? types : ['issue', 'pull_request', 'discussion'];
}

export async function contentHash(title: string, body: string | null): Promise<string> {
  const data = new TextEncoder().encode(`${title || ''}:${body || ''}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

export function embeddingInput(item: Pick<EmbeddingItem, 'type' | 'title' | 'body'>): string {
  return `[${item.type.toUpperCase()}] ${item.title} ${item.body || ''}`.substring(0, 2000);
}

function openAiKey(): string {
  const key = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY');
  if (!key) throw new NonRetriableJobError('OPENAI_API_KEY is not configured');
  if (!key.startsWith('sk-')) {
    throw new NonRetriableJobError('OPENAI_API_KEY has an invalid format');
  }
  return key;
}

async function fetchEmbeddings(apiKey: string, texts: string[]): Promise<(number[] | undefined)[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${body}`);
  }
  const json = await response.json() as { data?: { embedding?: number[] }[] };
  return (json.data ?? []).map((d) => d.embedding);
}

/**
 * Items whose embedding is missing or older than the item.
 *
 * The scheduled run reads the `items_needing_embeddings` view (workspace
 * repositories, prioritised, capped at 200 rows). A repository-scoped run
 * queries the source tables directly: the view applies its 200-row cap before
 * any repository filter, so a repository whose items fall outside that global
 * window would otherwise never be reached by its own job.
 */
async function selectItems(
  ctx: JobContext,
  repositoryId: string | undefined,
  itemTypes: ItemType[],
  limit: number,
): Promise<EmbeddingItem[]> {
  const wanted = new Set(itemTypes);
  if (!repositoryId) {
    const { data, error } = await ctx.supabase.from('items_needing_embeddings').select('*').limit(
      limit,
    );
    if (error) throw new Error(`items_needing_embeddings query failed: ${error.message}`);
    return ((data ?? []) as ViewRow[])
      .filter((row) => wanted.has(row.item_type))
      .map((row) => ({
        id: row.id,
        repository_id: row.repository_id,
        title: row.title,
        body: row.body,
        content_hash: row.content_hash,
        type: row.item_type,
      }));
  }

  const since = new Date(Date.now() - MAX_ITEM_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const items: EmbeddingItem[] = [];
  for (const type of itemTypes) {
    if (items.length >= limit) break;
    const { data, error } = await ctx.supabase
      .from(TABLE_FOR_TYPE[type])
      .select('id, repository_id, title, body, content_hash')
      .eq('repository_id', repositoryId)
      .gt('created_at', since)
      .or('embedding.is.null,embedding_generated_at.lt.updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit - items.length);
    if (error) throw new Error(`${TABLE_FOR_TYPE[type]} query failed: ${error.message}`);
    for (const row of (data ?? []) as TableRow[]) {
      items.push({ ...row, type });
    }
  }
  return items;
}

export interface ComputeOptions {
  repositoryId?: string;
  itemTypes?: ItemType[];
  forceRegenerate?: boolean;
  limit?: number;
}

/**
 * Generate embeddings for items that need them. Progress is recorded in
 * `embedding_jobs`. Throws (so the queue retries) when a batch failed or the
 * time budget ran out with items left; a clean run with nothing to do is a
 * normal completion.
 */
export async function computeEmbeddings(
  ctx: JobContext,
  options: ComputeOptions,
): Promise<JobResult> {
  const { supabase } = ctx;
  const repositoryId = options.repositoryId;
  const itemTypes = options.itemTypes ?? ['issue', 'pull_request', 'discussion'];
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const { data: job, error: jobError } = await supabase
    .from('embedding_jobs')
    .insert({
      repository_id: repositoryId ?? null,
      status: 'pending',
      items_total: 0,
      items_processed: 0,
    })
    .select('id')
    .maybeSingle();
  if (jobError || !job) {
    throw new Error(`Failed to create embedding job: ${jobError?.message ?? 'no row'}`);
  }
  const embeddingJobId = job.id as string;

  let items: EmbeddingItem[];
  try {
    items = await selectItems(ctx, repositoryId, itemTypes, limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from('embedding_jobs')
      .update({ status: 'failed', error_message: message })
      .eq('id', embeddingJobId);
    throw error;
  }

  if (options.forceRegenerate && repositoryId) {
    for (const type of itemTypes) {
      const { data: forced } = await supabase
        .from(TABLE_FOR_TYPE[type])
        .select('id, repository_id, title, body, content_hash')
        .eq('repository_id', repositoryId)
        .not('embedding', 'is', null)
        .limit(50);
      for (const row of (forced ?? []) as TableRow[]) {
        items.push({ ...row, type });
      }
    }
  }

  await supabase
    .from('embedding_jobs')
    .update({
      items_total: items.length,
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', embeddingJobId);

  if (items.length === 0) {
    await supabase
      .from('embedding_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', embeddingJobId);
    return { embeddingJobId, processed: 0, total: 0, message: 'No items to process' };
  }

  const apiKey = openAiKey();
  let processed = 0;
  let attempted = 0;
  let firstError: string | undefined;
  let nonRetriable = false;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    if (ctx.remainingMs() < 30_000) {
      console.warn(
        '[embeddings] out of time, %d of %d items left for the next run',
        items.length - i,
        items.length,
      );
      break;
    }
    const batch = items.slice(i, i + BATCH_SIZE);
    attempted += batch.length;
    try {
      for (const item of batch) {
        if (!item.content_hash) item.content_hash = await contentHash(item.title, item.body);
      }
      const embeddings = await fetchEmbeddings(apiKey, batch.map(embeddingInput));
      let batchProcessed = 0;
      const now = new Date().toISOString();

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const embedding = embeddings[j];
        if (!embedding) continue;

        const { error: updateError } = await supabase
          .from(TABLE_FOR_TYPE[item.type])
          .update({ embedding, embedding_generated_at: now, content_hash: item.content_hash })
          .eq('id', item.id);
        if (updateError) {
          throw new Error(
            `Failed to store embedding for ${item.type} ${item.id}: ${updateError.message}`,
          );
        }

        // created_at drives cleanup_expired_cache(); a refreshed entry gets a
        // fresh clock, otherwise it would be deleted on its original expiry.
        const { error: cacheError } = await supabase.from('similarity_cache').upsert(
          {
            repository_id: item.repository_id,
            item_type: item.type,
            item_id: item.id,
            embedding,
            content_hash: item.content_hash,
            ttl_hours: CACHE_TTL_HOURS,
            created_at: now,
            accessed_at: now,
          },
          { onConflict: 'repository_id,item_type,item_id' },
        );
        if (cacheError) {
          console.warn(
            '[embeddings] similarity_cache upsert failed for %s: %s',
            item.id,
            cacheError.message,
          );
        }
        batchProcessed++;
      }

      processed += batchProcessed;
      const { error: progressError } = await supabase.rpc('update_embedding_job_progress', {
        job_id: embeddingJobId,
        processed_count: batchProcessed,
      });
      if (progressError) {
        console.warn('[embeddings] progress update failed: %s', progressError.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[embeddings] batch %d failed: %s', i / BATCH_SIZE, message);
      firstError ??= message;
      if (error instanceof NonRetriableJobError) {
        nonRetriable = true;
        break;
      }
    }
  }

  const leftover = items.length - attempted;
  const finished = firstError === undefined && leftover === 0;
  await supabase
    .from('embedding_jobs')
    .update({
      status: finished ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      ...(firstError ? { error_message: firstError } : {}),
      ...(!firstError && leftover > 0
        ? { error_message: `${leftover} items not reached within the time budget` }
        : {}),
    })
    .eq('id', embeddingJobId);
  await supabase.rpc('cleanup_expired_cache');

  // Items already embedded are excluded by the selection query, so a retry
  // only picks up what this run did not finish.
  if (nonRetriable) throw new NonRetriableJobError(firstError ?? 'embedding run aborted');
  if (firstError) {
    throw new Error(`${processed}/${items.length} embedded; batch failure: ${firstError}`);
  }
  if (leftover > 0) {
    throw new Error(`${processed}/${items.length} embedded; ${leftover} left for the retry`);
  }
  return { embeddingJobId, processed, total: items.length };
}

export const computeRequested: JobHandler = (ctx, payload) =>
  computeEmbeddings(ctx, {
    repositoryId: asString(payload.repositoryId),
    itemTypes: normalizeItemTypes(payload.itemTypes),
    forceRegenerate: payload.forceRegenerate === true,
    limit: asNumber(payload.limit),
  });

/** `embeddings.generate` from the old per-repository fan-out. */
export const generateForRepository: JobHandler = (ctx, payload) => {
  const repositoryId = asString(payload.repositoryId);
  if (!repositoryId) throw new NonRetriableJobError('embeddings.generate requires repositoryId');
  return computeEmbeddings(ctx, {
    repositoryId,
    itemTypes: ['issue', 'pull_request'],
    limit: asNumber(payload.limit) ?? 50,
  });
};

async function repositoryOfItem(
  ctx: JobContext,
  table: ItemTable,
  id: string,
): Promise<string> {
  const { data, error } = await ctx.supabase.from(table).select('repository_id').eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Lookup of ${table} ${id} failed: ${error.message}`);
  const repositoryId = (data as { repository_id?: string } | null)?.repository_id;
  if (!repositoryId) throw new NonRetriableJobError(`${table} ${id} not found`);
  return repositoryId;
}

export const issueEmbedding: JobHandler = async (ctx, payload) => {
  const issueId = asString(payload.issueId);
  if (!issueId) throw new NonRetriableJobError('embedding/issue.generate requires issueId');
  const repositoryId = asString(payload.repositoryId) ??
    await repositoryOfItem(ctx, 'issues', issueId);
  return computeEmbeddings(ctx, { repositoryId, itemTypes: ['issue'] });
};

export const prEmbedding: JobHandler = async (ctx, payload) => {
  const prId = asString(payload.prId);
  if (!prId) throw new NonRetriableJobError('embedding/pr.generate requires prId');
  const repositoryId = asString(payload.repositoryId) ??
    await repositoryOfItem(ctx, 'pull_requests', prId);
  return computeEmbeddings(ctx, { repositoryId, itemTypes: ['pull_request'] });
};

export const repositoryEmbeddings: JobHandler = (ctx, payload: JobPayload) => {
  const repositoryId = asString(payload.repositoryId);
  if (!repositoryId) {
    throw new NonRetriableJobError('repository embedding jobs require repositoryId');
  }
  return computeEmbeddings(ctx, { repositoryId, itemTypes: ['issue', 'pull_request'] });
};
