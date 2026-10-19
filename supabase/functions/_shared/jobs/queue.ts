/**
 * Producer side of the pgmq `jobs` queue.
 *
 * `enqueueJob` calls the SECURITY DEFINER `enqueue_job()` function from
 * 20261019000002_jobs_queue.sql, which writes the background_jobs row and the
 * queue message in one transaction. `kickProcessJob` asks the worker to run
 * now instead of waiting for the one-minute cron.
 */

import type { EnqueueOptions, JobPayload } from './types.ts';

/** The slice of supabase-js used here; structural so client versions can differ. */
export interface QueueDb {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export async function enqueueJob(
  db: QueueDb,
  type: string,
  payload: JobPayload,
  options: EnqueueOptions = {},
): Promise<string> {
  const { data, error } = await db.rpc('enqueue_job', {
    job_type: type,
    job_payload: payload,
    p_repository_id: options.repositoryId ?? null,
    p_source: options.source ?? null,
    dedupe_window: options.dedupeWindow ?? null,
  });
  if (error) {
    throw new Error(`enqueue_job(${type}) failed: ${error.message}`);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(`enqueue_job(${type}) returned no job id`);
  }
  return data;
}

interface EdgeRuntimeLike {
  waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * Invoke process-job without waiting for it. Inside Supabase Edge Runtime the
 * promise is handed to `EdgeRuntime.waitUntil`, which keeps the isolate alive
 * after the response; elsewhere the request is simply not awaited.
 */
export function kickProcessJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  reason: string,
): void {
  const request = fetch(`${supabaseUrl}/functions/v1/process-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ source: reason }),
  })
    .then((res) => {
      if (!res.ok) console.warn('process-job kick returned %d', res.status);
      return res.body?.cancel();
    })
    .catch((err) => console.warn('process-job kick failed: %s', err));

  const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(request);
  }
}
