/**
 * process-job: worker for the pgmq `jobs` queue.
 *
 * Phase 3b of docs/infrastructure/cost-reduction-plan.md. Called every minute
 * by pg_cron (`drain_jobs_queue()`, only when the queue is non-empty) and
 * kicked by queue-event after an enqueue. Each invocation reads messages in
 * small batches and runs them until the queue is empty or the wall-clock
 * budget is spent, then responds with counts.
 *
 *   jobs_read(vt, qty) ──▶ background_jobs row → processing
 *     ├─ ok       ──▶ completed, jobs_delete(msg)
 *     ├─ retry    ──▶ queued, retry_count = attempt, jobs_set_vt(msg, backoff)
 *     └─ give up  ──▶ failed, jobs_archive(msg)
 *
 * Body: { source?: string, maxMessages?: number } for a drain run, or
 * { jobId: string } to re-run one failed or completed background_jobs row
 * directly (no queue message is involved; rows that still have a message
 * are refused so the queue and the manual run cannot execute it twice).
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';
import { isCaptureEvent, startCapture } from '../_shared/datapipe-capture.ts';
import { enqueueJob } from '../_shared/jobs/queue.ts';
import { hasHandler, JOB_HANDLERS } from '../_shared/jobs/registry.ts';
import {
  READ_BATCH_SIZE,
  retryDelaySeconds,
  shouldRetry,
  VISIBILITY_TIMEOUT_SECONDS,
  WORKER_BUDGET_MS,
} from '../_shared/jobs/retry.ts';
import { errorMessage, isNonRetriable, NonRetriableJobError } from '../_shared/jobs/types.ts';
import type { JobContext, JobPayload, JobResult } from '../_shared/jobs/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN') || '';

/** Below this much budget, read one message at a time so none sit prefetched. */
const SINGLE_READ_BELOW_MS = 60_000;

// Circuit breaker: after N consecutive failures of one job type, skip that
// type for a minute. Per isolate, so it only dampens tight failure loops.
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT_MS = 60_000;
const circuitBreakers = new Map<
  string,
  { failures: number; lastFailure: number; isOpen: boolean }
>();

function checkCircuitBreaker(jobType: string): string | null {
  const breaker = circuitBreakers.get(jobType);
  if (!breaker?.isOpen) return null;
  if (Date.now() - breaker.lastFailure > CIRCUIT_BREAKER_TIMEOUT_MS) {
    breaker.isOpen = false;
    breaker.failures = 0;
    return null;
  }
  return `Circuit breaker open for ${jobType}: ${breaker.failures} consecutive failures`;
}

function recordFailure(jobType: string) {
  const breaker = circuitBreakers.get(jobType) ?? { failures: 0, lastFailure: 0, isOpen: false };
  breaker.failures++;
  breaker.lastFailure = Date.now();
  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) breaker.isOpen = true;
  circuitBreakers.set(jobType, breaker);
}

function recordSuccess(jobType: string) {
  circuitBreakers.delete(jobType);
}

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  message: { job_id?: string; type?: string; payload?: JobPayload };
}

interface JobRow {
  id: string;
  type: string;
  payload: JobPayload | null;
  status: string;
  max_retries: number;
  pgmq_msg_id: number | null;
}

interface DrainStats {
  processed: number;
  succeeded: number;
  retried: number;
  failed: number;
  skipped: number;
  released: number;
}

function makeContext(jobId: string, type: string, deadline: number): JobContext {
  return {
    supabase,
    jobId,
    type,
    githubToken: GITHUB_TOKEN,
    enqueue: (jobType, payload, options) =>
      enqueueJob(supabase, jobType, payload, { source: `job:${type}`, ...options }),
    remainingMs: () => Math.max(0, deadline - Date.now()),
  };
}

async function dispatch(ctx: JobContext, payload: JobPayload): Promise<JobResult> {
  const { type } = ctx;
  if (isCaptureEvent(type)) {
    const capture = await startCapture(supabase, type, payload);
    return {
      success: true,
      message: `Started gh-datapipe machine ${capture.fly_machine_id}`,
      data: capture,
    };
  }
  if (!hasHandler(type)) {
    throw new NonRetriableJobError(`Unknown job type: ${type}`);
  }
  return JOB_HANDLERS[type](ctx, payload);
}

/** Run one job row to completion and record the outcome. Throws on failure. */
async function runJob(row: JobRow, deadline: number): Promise<JobResult> {
  const open = checkCircuitBreaker(row.type);
  if (open) throw new Error(open);

  await supabase
    .from('background_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), error: null })
    .eq('id', row.id);

  const started = Date.now();
  try {
    const result = await dispatch(makeContext(row.id, row.type, deadline), row.payload ?? {});
    await supabase
      .from('background_jobs')
      .update({ status: 'completed', result, completed_at: new Date().toISOString() })
      .eq('id', row.id);
    recordSuccess(row.type);
    console.log('job %s (%s) completed in %dms', row.id, row.type, Date.now() - started);
    return result;
  } catch (error) {
    recordFailure(row.type);
    console.error(
      'job %s (%s) failed after %dms: %s',
      row.id,
      row.type,
      Date.now() - started,
      errorMessage(error),
    );
    throw error;
  }
}

async function handleMessage(
  msg: QueueMessage,
  deadline: number,
  stats: DrainStats,
): Promise<void> {
  const jobId = msg.message?.job_id;
  if (!jobId) {
    console.warn('message %d has no job_id, archiving', msg.msg_id);
    await supabase.rpc('jobs_archive', { p_msg_id: msg.msg_id });
    stats.skipped++;
    return;
  }

  const { data: row } = await supabase
    .from('background_jobs')
    .select('id, type, payload, status, max_retries, pgmq_msg_id')
    .eq('id', jobId)
    .maybeSingle();

  if (!row) {
    console.warn('message %d points at missing job %s, deleting', msg.msg_id, jobId);
    await supabase.rpc('jobs_delete', { p_msg_id: msg.msg_id });
    stats.skipped++;
    return;
  }
  if (row.status === 'completed' || row.status === 'cancelled') {
    await supabase.rpc('jobs_delete', { p_msg_id: msg.msg_id });
    stats.skipped++;
    return;
  }

  stats.processed++;
  try {
    await runJob(row as JobRow, deadline);
    await supabase.rpc('jobs_delete', { p_msg_id: msg.msg_id });
    stats.succeeded++;
  } catch (error) {
    const attempt = msg.read_ct;
    const message = errorMessage(error);
    if (shouldRetry(attempt, row.max_retries, isNonRetriable(error))) {
      const delay = retryDelaySeconds(attempt);
      await supabase
        .from('background_jobs')
        .update({ status: 'queued', retry_count: attempt, error: message })
        .eq('id', row.id);
      await supabase.rpc('jobs_set_vt', { p_msg_id: msg.msg_id, vt_offset: delay });
      console.log('job %s retry %d scheduled in %ds', row.id, attempt, delay);
      stats.retried++;
    } else {
      await supabase
        .from('background_jobs')
        .update({
          status: 'failed',
          retry_count: Math.max(0, attempt - 1),
          error: message,
          failed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      await supabase.rpc('jobs_archive', { p_msg_id: msg.msg_id });
      stats.failed++;
    }
  }
}

/**
 * Messages read but not handled before the budget ran out would otherwise
 * stay invisible for the full visibility timeout. Make them visible again so
 * the next invocation (the cron tick a minute later) picks them up.
 */
async function releaseUnhandled(messages: QueueMessage[], stats: DrainStats): Promise<void> {
  for (const msg of messages) {
    const { error } = await supabase.rpc('jobs_set_vt', { p_msg_id: msg.msg_id, vt_offset: 1 });
    if (error) {
      console.warn('could not release message %d: %s', msg.msg_id, error.message);
    } else {
      stats.released++;
    }
  }
}

async function drain(maxMessages: number): Promise<DrainStats> {
  const deadline = Date.now() + WORKER_BUDGET_MS;
  const stats: DrainStats = {
    processed: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    released: 0,
  };
  let seen = 0;

  while (Date.now() < deadline && seen < maxMessages) {
    const remaining = deadline - Date.now();
    const qty = remaining < SINGLE_READ_BELOW_MS
      ? 1
      : Math.min(READ_BATCH_SIZE, maxMessages - seen);
    const { data, error } = await supabase.rpc('jobs_read', {
      p_vt: VISIBILITY_TIMEOUT_SECONDS,
      p_qty: qty,
    });
    if (error) throw new Error(`jobs_read failed: ${error.message}`);
    const messages = (data ?? []) as QueueMessage[];
    if (messages.length === 0) break;

    for (let i = 0; i < messages.length; i++) {
      if (Date.now() >= deadline) {
        await releaseUnhandled(messages.slice(i), stats);
        return stats;
      }
      seen++;
      await handleMessage(messages[i], deadline, stats);
    }
  }
  return stats;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

console.log('process-job worker ready: %d handlers', Object.keys(JOB_HANDLERS).length);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const apiKey = req.headers.get('x-api-key');
  if (authHeader !== `Bearer ${supabaseServiceKey}` && apiKey !== supabaseServiceKey) {
    return json(401, { error: 'Unauthorized' });
  }

  let body: { jobId?: unknown; source?: unknown; maxMessages?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is a plain drain request
  }

  try {
    if (typeof body.jobId === 'string') {
      const { data: row, error } = await supabase
        .from('background_jobs')
        .select('id, type, payload, status, max_retries, pgmq_msg_id')
        .eq('id', body.jobId)
        .maybeSingle();
      if (error || !row) return json(404, { error: 'Job not found' });
      if (row.status === 'queued' || row.status === 'processing') {
        return json(409, {
          error: 'Job is still on the queue',
          message:
            'Queued and processing jobs are run by the queue; manual runs are for failed or completed rows',
          status: row.status,
        });
      }
      try {
        const result = await runJob(row as JobRow, Date.now() + WORKER_BUDGET_MS);
        return json(200, { jobId: row.id, status: 'completed', result });
      } catch (err) {
        const message = errorMessage(err);
        await supabase
          .from('background_jobs')
          .update({ status: 'failed', error: message, failed_at: new Date().toISOString() })
          .eq('id', row.id);
        return json(500, { jobId: row.id, status: 'failed', error: message });
      }
    }

    const maxMessages = typeof body.maxMessages === 'number' && body.maxMessages > 0
      ? Math.floor(body.maxMessages)
      : 100;
    const stats = await drain(maxMessages);
    console.log(
      'drain (%s): %s',
      typeof body.source === 'string' ? body.source : 'manual',
      JSON.stringify(stats),
    );
    return json(200, { source: body.source ?? 'manual', ...stats });
  } catch (error) {
    console.error('process-job error:', error);
    return json(500, { error: errorMessage(error) });
  }
});
