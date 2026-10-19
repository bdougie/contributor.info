/**
 * datapipe_jobs: job state for gh-datapipe runs, stored in Supabase.
 *
 * The old gh-datapipe FastAPI app kept jobs in process memory and lost them on
 * every restart. Now contributor.info creates the row, starts a Fly machine
 * with the row id, and the machine writes progress back. Status is read from
 * here, never from Fly.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createMachine,
  destroyMachine,
  FlyMachinesError,
  isConfigured as flyConfigured,
} from './fly-machines.mts';

export type DatapipeJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DatapipeJobType = 'sync' | 'daily' | 'backfill' | 'capture';

export interface DatapipeJobParams {
  repository?: string;
  days?: number;
  sources?: string[];
  config?: string;
  reason?: string;
  /** Supabase user id that requested an on-demand job (cancel is limited to them). */
  requested_by?: string;
  [key: string]: unknown;
}

export interface DatapipeJobProgress {
  step?: string;
  source?: string;
  sources_done?: number;
  sources_total?: number;
  total_records?: number;
  errors?: number;
  [key: string]: unknown;
}

export interface DatapipeJob {
  id: string;
  type: DatapipeJobType;
  status: DatapipeJobStatus;
  params: DatapipeJobParams;
  fly_machine_id: string | null;
  progress: DatapipeJobProgress | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** Shape the ManualBackfill UI polls for (kept from the old API). */
export interface JobStatusView {
  id: string;
  status: DatapipeJobStatus;
  progress: number;
  message: string;
  data: { repository: string; days: number };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface TriggerBackfillOptions {
  repository: string;
  days?: number;
  sources?: string[];
  config?: string;
  reason?: string;
  requestedBy?: string;
}

export interface TriggerBackfillResult {
  job_id: string;
  status: DatapipeJobStatus;
  repository: string;
  days: number;
  estimated_completion: string;
  status_url: string;
  fly_machine_id: string | null;
}

const TABLE = 'datapipe_jobs';
const DEFAULT_DAYS = 30;
const DEFAULT_CONFIG = 'production';
const DEFAULT_SOURCES = ['pull_requests', 'issues_with_authors', 'comments', 'extended_events'];

export class DatapipeJobsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DatapipeJobsError';
    this.status = status;
  }
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** True when both Supabase (service role) and Fly are configured. */
export function isConfigured(): boolean {
  return getSupabaseAdmin() !== null && flyConfigured();
}

function requireSupabase(): SupabaseClient {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new DatapipeJobsError(
      'Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      503
    );
  }
  return client;
}

export function isValidRepository(repository: string): boolean {
  return /^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(repository);
}

export async function createJob(
  type: DatapipeJobType,
  params: DatapipeJobParams,
  client: SupabaseClient = requireSupabase()
): Promise<DatapipeJob> {
  const { data, error } = await client
    .from(TABLE)
    .insert({ type, params, status: 'queued' })
    .select('*')
    .single();

  if (error || !data) {
    throw new DatapipeJobsError(`Failed to create job: ${error?.message ?? 'no row'}`, 500);
  }
  return data as DatapipeJob;
}

export async function getJob(
  jobId: string,
  client: SupabaseClient = requireSupabase()
): Promise<DatapipeJob | null> {
  const { data, error } = await client.from(TABLE).select('*').eq('id', jobId).maybeSingle();
  if (error) {
    throw new DatapipeJobsError(`Failed to read job: ${error.message}`, 500);
  }
  return (data as DatapipeJob | null) ?? null;
}

export async function updateJob(
  jobId: string,
  fields: Partial<Omit<DatapipeJob, 'id' | 'created_at'>>,
  client: SupabaseClient = requireSupabase()
): Promise<void> {
  const { error } = await client.from(TABLE).update(fields).eq('id', jobId);
  if (error) {
    throw new DatapipeJobsError(`Failed to update job: ${error.message}`, 500);
  }
}

export async function listJobs(
  options: { status?: DatapipeJobStatus; type?: DatapipeJobType; limit?: number } = {},
  client: SupabaseClient = requireSupabase()
): Promise<DatapipeJob[]> {
  let query = client
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 10, 1), 100));
  if (options.status) query = query.eq('status', options.status);
  if (options.type) query = query.eq('type', options.type);

  const { data, error } = await query;
  if (error) {
    throw new DatapipeJobsError(`Failed to list jobs: ${error.message}`, 500);
  }
  return (data ?? []) as DatapipeJob[];
}

/**
 * Build the command for a backfill machine. Exported so process-job's capture
 * routing and tests share one definition.
 */
export function backfillCommand(jobId: string, params: DatapipeJobParams): string[] {
  const cmd = [
    'python',
    'scripts/unified_workspace_backfill.py',
    '--config',
    params.config ?? DEFAULT_CONFIG,
    '--job-id',
    jobId,
  ];
  if (params.repository) cmd.push('--repository', params.repository);
  if (params.days) cmd.push('--days', String(params.days));
  if (params.sources && params.sources.length > 0) cmd.push('--sources', params.sources.join(','));
  return cmd;
}

/**
 * Create a datapipe_jobs row, then a Fly machine that runs it. The machine
 * reports back with --job-id. If Fly refuses the machine the row is marked
 * failed so the UI never polls forever.
 */
export async function triggerBackfill(
  options: TriggerBackfillOptions,
  client: SupabaseClient = requireSupabase()
): Promise<TriggerBackfillResult> {
  if (!isValidRepository(options.repository)) {
    throw new DatapipeJobsError('Invalid repository format. Expected: owner/name', 400);
  }
  if (!flyConfigured()) {
    throw new DatapipeJobsError(
      'Fly datapipe not configured: set FLY_DATAPIPE_TOKEN and FLY_DATAPIPE_IMAGE',
      503
    );
  }

  const days = Math.min(Math.max(options.days ?? DEFAULT_DAYS, 1), 3650);
  const params: DatapipeJobParams = {
    repository: options.repository,
    days,
    sources: options.sources ?? DEFAULT_SOURCES,
    config: options.config ?? DEFAULT_CONFIG,
    reason: options.reason ?? 'manual',
  };
  if (options.requestedBy) params.requested_by = options.requestedBy;

  const job = await createJob('backfill', params, client);

  let machineId: string | null = null;
  try {
    const machine = await createMachine({
      name: `backfill-${job.id.slice(0, 8)}`,
      cmd: backfillCommand(job.id, params),
      env: { JOB_ID: job.id },
    });
    machineId = machine.id;
    try {
      await updateJob(
        job.id,
        { fly_machine_id: machine.id, progress: { step: 'machine_created' } },
        client
      );
    } catch (updateError) {
      // The row would never learn the machine id, so cancel could not stop
      // it. Destroy the machine now rather than leave it running untracked.
      await destroyMachine(machine.id).catch((destroyError) => {
        console.error(
          '[datapipe-jobs] could not destroy machine %s after update failure: %s',
          machine.id,
          destroyError
        );
      });
      const message = updateError instanceof Error ? updateError.message : String(updateError);
      throw new DatapipeJobsError(
        `Machine ${machine.id} was destroyed because the job row could not be updated: ${message}`,
        500
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(
      job.id,
      {
        status: 'failed',
        error: `Could not start Fly machine: ${message}`,
        completed_at: new Date().toISOString(),
      },
      client
    ).catch((updateError) => {
      console.error('[datapipe-jobs] failed to mark job %s failed: %s', job.id, updateError);
    });
    throw error;
  }

  // Rough: ~2 minutes per source plus startup. Only shown to the user.
  const estimateMs = (2 + 2 * (params.sources?.length ?? 1)) * 60_000;

  return {
    job_id: job.id,
    status: 'queued',
    repository: options.repository,
    days,
    estimated_completion: new Date(Date.now() + estimateMs).toISOString(),
    status_url: `/api/backfill/status/${job.id}`,
    fly_machine_id: machineId,
  };
}

/**
 * Cancel a job: mark the row cancelled and destroy its machine if one exists.
 * Terminal jobs are left alone.
 */
export async function cancelJob(
  jobId: string,
  client: SupabaseClient = requireSupabase()
): Promise<{ job_id: string; status: DatapipeJobStatus; message: string }> {
  const job = await getJob(jobId, client);
  if (!job) {
    throw new DatapipeJobsError(`Job ${jobId} not found`, 404);
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { job_id: job.id, status: job.status, message: `Job already ${job.status}` };
  }

  if (job.fly_machine_id && flyConfigured()) {
    try {
      await destroyMachine(job.fly_machine_id);
    } catch (error) {
      if (error instanceof FlyMachinesError && error.status === 404) {
        // Already exited and auto-destroyed; the row can be closed.
      } else {
        // Anything else means the machine may still be running. Leave the
        // row as it is so the caller can retry instead of reporting a
        // cancellation that did not happen.
        const message = error instanceof Error ? error.message : String(error);
        throw new DatapipeJobsError(
          `Could not stop machine ${job.fly_machine_id}: ${message}`,
          502
        );
      }
    }
  }

  await updateJob(
    job.id,
    { status: 'cancelled', completed_at: new Date().toISOString(), error: 'Cancelled by user' },
    client
  );

  return { job_id: job.id, status: 'cancelled', message: 'Job cancelled' };
}

function progressPercent(job: DatapipeJob): number {
  if (job.status === 'completed') return 100;
  if (job.status === 'failed' || job.status === 'cancelled') return 0;
  if (job.status === 'queued') return 0;

  const p = job.progress ?? {};
  if (p.step === 'sync_to_supabase') return 90;
  if (
    typeof p.sources_done === 'number' &&
    typeof p.sources_total === 'number' &&
    p.sources_total > 0
  ) {
    return Math.min(85, Math.round(5 + (80 * p.sources_done) / p.sources_total));
  }
  return 5;
}

function progressMessage(job: DatapipeJob): string {
  const p = job.progress ?? {};
  switch (job.status) {
    case 'queued':
      return p.step === 'machine_created' ? 'Machine starting' : 'Backfill queued';
    case 'running':
      if (p.step === 'sync_to_supabase') return 'Syncing to Supabase';
      if (p.source) return `Fetching ${String(p.source)}`;
      return 'Running';
    case 'completed':
      return typeof p.total_records === 'number'
        ? `Completed: ${p.total_records} records synced`
        : 'Completed';
    case 'failed':
      return job.error ?? 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return job.status;
  }
}

/** Convert a row into the view the ManualBackfill component expects. */
export function toJobStatusView(job: DatapipeJob): JobStatusView {
  const view: JobStatusView = {
    id: job.id,
    status: job.status,
    progress: progressPercent(job),
    message: progressMessage(job),
    data: {
      repository: typeof job.params.repository === 'string' ? job.params.repository : 'all',
      days: typeof job.params.days === 'number' ? job.params.days : DEFAULT_DAYS,
    },
    created_at: job.created_at,
  };
  if (job.started_at) view.started_at = job.started_at;
  if (job.completed_at) view.completed_at = job.completed_at;
  if (job.error) view.error = job.error;
  return view;
}
