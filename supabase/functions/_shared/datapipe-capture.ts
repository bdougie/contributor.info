/**
 * Route former Inngest `capture/*` events to gh-datapipe machines.
 *
 * Each event becomes one `datapipe_jobs` row plus one Fly machine that runs
 * `unified_workspace_backfill.py --job-id <row>`. The mapping to `--sources`
 * is documented in gh-datapipe/docs/capture-event-mapping.md.
 */

import { createMachine, destroyMachine, isFlyConfigured } from './fly-machines.ts';

/**
 * The slice of a supabase-js client this module uses. Structural so that
 * callers pinned to different supabase-js versions (2.39.7 in process-job and
 * queue-event, latest in _shared/database.ts) all type-check.
 */
interface DbResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface DatapipeDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult<unknown>>;
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): { single(): PromiseLike<DbResult<{ id: string }>> };
    };
    update(fields: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<DbResult<unknown>>;
    };
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<DbResult<{ full_name?: string | null; id?: string }>>;
        in(column: string, values: number[]): PromiseLike<DbResult<{ created_at: string }[]>>;
      };
    };
  };
}

/** GitHub owner and repository names: letters, digits, '-', '_', '.'. */
const GITHUB_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

export function isValidRepositoryName(fullName: string): boolean {
  const parts = fullName.split('/');
  return parts.length === 2 && GITHUB_NAME.test(parts[0]) && GITHUB_NAME.test(parts[1]);
}

/**
 * Whether a capture needs a new machine is decided in Postgres by
 * `datapipe_claim_capture()` (migration 20261020000000): it serialises
 * callers per repository with an advisory lock, reuses a queued (< 20 min) or
 * running (< 3 h) capture that already covers the requested sources and
 * window, and refuses to start more than `CAPTURE_MAX_ACTIVE` capture
 * machines at once. These constants mirror the function for callers and
 * tests; the SQL is the source of truth.
 */
export const CAPTURE_QUEUED_WINDOW_MINUTES = 20;
export const CAPTURE_RUNNING_WINDOW_HOURS = 3;
export const CAPTURE_MAX_ACTIVE = 2;

/** Message prefix datapipe_claim_capture raises when the cap is hit. */
export const CAPTURE_CAPACITY_MESSAGE = 'capture_capacity_reached';

/** Thrown by startCapture with the HTTP status the edge function should answer with. */
export class CaptureError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CaptureError';
  }
}

/** Event name -> unified_workspace_backfill.py --sources */
export const CAPTURE_SOURCES: Record<string, string[]> = {
  'capture/repository.events': ['github_events', 'extended_events'],
  'capture/repository.sync': ['pull_requests'],
  'capture/repository.sync.graphql': ['pull_requests'],
  'capture/repository.sync.enhanced': ['pull_requests', 'comments', 'extended_events'],
  'capture/pr.details': ['pull_requests'],
  'capture/pr.details.graphql': ['pull_requests'],
  'capture/pr.reviews': ['extended_events'],
  'capture/pr.comments': ['comments'],
  'capture/issue.comments': ['comments'],
  'capture/repository.comments.all': ['comments'],
  'capture/repository.issues': ['issues_with_authors'],
  'capture/repository.discussions': ['discussions'],
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 3650;

export interface CapturePayload {
  repositoryId?: string;
  repositoryName?: string;
  repository?: string;
  owner?: string;
  repo?: string;
  name?: string;
  days?: number;
  daysLimit?: number;
  /** Item selectors the Inngest functions used. The datapipe has no per-item
   * mode, so these widen the window far enough to include every item. */
  prNumber?: number;
  prNumbers?: number[];
  issueNumber?: number;
  [key: string]: unknown;
}

/** Object-literal type (not an interface) so it is assignable to Record<string, unknown>. */
export type CaptureResult = {
  datapipe_job_id: string;
  /** null while a reused capture has not had its machine created yet */
  fly_machine_id: string | null;
  repository: string;
  sources: string[];
  days: number;
};

export function isCaptureEvent(eventName: string): boolean {
  return eventName in CAPTURE_SOURCES;
}

interface CaptureClaim {
  job_id: string;
  reused: boolean;
  fly_machine_id: string | null;
  days: number;
}

function isCaptureClaim(value: unknown): value is CaptureClaim {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.job_id === 'string' &&
    typeof row.reused === 'boolean' &&
    (row.fly_machine_id === null || typeof row.fly_machine_id === 'string') &&
    typeof row.days === 'number'
  );
}

/**
 * Ask Postgres for the capture job to use: an active one to reuse, or a fresh
 * queued row this caller must start a machine for. Throws CaptureError(429)
 * when the concurrency cap is reached.
 */
export async function claimCapture(
  supabase: DatapipeDb,
  repository: string,
  sources: string[],
  days: number,
  params: Record<string, unknown>,
): Promise<CaptureClaim> {
  const { data, error } = await supabase.rpc('datapipe_claim_capture', {
    p_repository: repository,
    p_sources: sources,
    p_days: days,
    p_params: params,
  });
  if (error) {
    if (error.message.includes(CAPTURE_CAPACITY_MESSAGE)) {
      throw new CaptureError(429, error.message);
    }
    throw new Error(`datapipe_claim_capture failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!isCaptureClaim(row)) {
    throw new Error('datapipe_claim_capture returned no job');
  }
  return row;
}

export function backfillCommand(
  jobId: string,
  repository: string,
  days: number,
  sources: string[],
): string[] {
  return [
    'python',
    'scripts/unified_workspace_backfill.py',
    '--config',
    'production',
    '--job-id',
    jobId,
    '--repository',
    repository,
    '--days',
    String(days),
    '--sources',
    sources.join(','),
  ];
}

export function selectedNumbers(payload: CapturePayload): { prs: number[]; issues: number[] } {
  const prs = new Set<number>();
  if (typeof payload.prNumber === 'number') prs.add(payload.prNumber);
  for (const n of payload.prNumbers ?? []) if (typeof n === 'number') prs.add(n);
  const issues = typeof payload.issueNumber === 'number' ? [payload.issueNumber] : [];
  return { prs: Array.from(prs), issues };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Widen `days` so that every PR / issue named in the payload falls inside the
 * backfill window. A review event for a PR opened 90 days ago would otherwise
 * run a 30-day window that never touches that PR.
 */
export async function daysCoveringSelectors(
  supabase: DatapipeDb,
  repository: string,
  payload: CapturePayload,
  days: number,
): Promise<number> {
  const { prs, issues } = selectedNumbers(payload);
  if (prs.length === 0 && issues.length === 0) return days;

  let oldest = Date.now();
  const consider = (rows: { created_at: string }[] | null) => {
    for (const row of rows ?? []) {
      const ts = Date.parse(row.created_at);
      if (Number.isFinite(ts) && ts < oldest) oldest = ts;
    }
  };

  if (prs.length > 0) {
    const { data } = await supabase
      .from('pull_requests')
      .select('created_at')
      .eq('repository_full_name', repository)
      .in('number', prs);
    consider(data);
  }
  if (issues.length > 0) {
    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('full_name', repository)
      .maybeSingle();
    if (repo?.id) {
      const { data } = await supabase
        .from('issues')
        .select('created_at')
        .eq('repository_id', repo.id)
        .in('number', issues);
      consider(data);
    }
  }

  const needed = Math.ceil((Date.now() - oldest) / MS_PER_DAY) + 1;
  return Math.min(Math.max(days, needed), MAX_DAYS);
}

export function daysFromPayload(payload: CapturePayload): number {
  const raw = payload.days ?? payload.daysLimit ?? DEFAULT_DAYS;
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_DAYS;
  return Math.min(Math.max(n, 1), MAX_DAYS);
}

/** Resolve "owner/name" from the many payload shapes Inngest events used. */
export async function resolveRepository(
  supabase: DatapipeDb,
  payload: CapturePayload,
): Promise<string | null> {
  const direct = payload.repositoryName ?? payload.repository;
  if (typeof direct === 'string' && direct.includes('/')) return direct;

  const owner = payload.owner;
  const name = payload.repo ?? payload.name;
  if (typeof owner === 'string' && typeof name === 'string') return `${owner}/${name}`;

  if (typeof payload.repositoryId === 'string') {
    const { data } = await supabase
      .from('repositories')
      .select('full_name')
      .eq('id', payload.repositoryId)
      .maybeSingle();
    if (data?.full_name) return data.full_name as string;
  }
  return null;
}

/**
 * Create the job row and the machine. Throws when the event is unknown, the
 * repository cannot be resolved, or Fly is not configured; the row is marked
 * failed if the machine could not be created.
 */
export async function startCapture(
  supabase: DatapipeDb,
  eventName: string,
  payload: CapturePayload,
): Promise<CaptureResult> {
  const sources = CAPTURE_SOURCES[eventName];
  if (!sources) throw new Error(`Not a datapipe capture event: ${eventName}`);
  if (!isFlyConfigured()) {
    throw new Error('Fly datapipe not configured: set FLY_DATAPIPE_TOKEN and FLY_DATAPIPE_IMAGE');
  }

  const repository = await resolveRepository(supabase, payload);
  if (!repository) throw new Error(`Could not resolve repository for ${eventName}`);
  if (!isValidRepositoryName(repository)) {
    throw new Error('Repository must be a GitHub-shaped owner/name');
  }
  const days = await daysCoveringSelectors(supabase, repository, payload, daysFromPayload(payload));
  const selectors = selectedNumbers(payload);

  const params = {
    repository,
    days,
    sources,
    config: 'production',
    reason: eventName,
    ...(selectors.prs.length > 0 ? { pr_numbers: selectors.prs } : {}),
    ...(selectors.issues.length > 0 ? { issue_numbers: selectors.issues } : {}),
  };
  const claim = await claimCapture(supabase, repository, sources, days, params);
  if (claim.reused) {
    console.log('capture for %s reuses active job %s', repository, claim.job_id);
    return {
      datapipe_job_id: claim.job_id,
      fly_machine_id: claim.fly_machine_id,
      repository,
      sources,
      days: claim.days,
    };
  }
  const job = { id: claim.job_id };

  try {
    const machine = await createMachine({
      name: `capture-${String(job.id).slice(0, 8)}`,
      cmd: backfillCommand(job.id, repository, days, sources),
      env: { JOB_ID: job.id },
    });
    const { error: updateError } = await supabase
      .from('datapipe_jobs')
      .update({ fly_machine_id: machine.id, progress: { step: 'machine_created' } })
      .eq('id', job.id);
    if (updateError) {
      // Without the machine id on the row nothing could cancel it later.
      await destroyMachine(machine.id).catch((e) =>
        console.error('could not destroy machine %s after update failure: %s', machine.id, e)
      );
      throw new Error(`Could not record machine id: ${updateError.message}`);
    }
    return { datapipe_job_id: job.id, fly_machine_id: machine.id, repository, sources, days };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('datapipe_jobs')
      .update({
        status: 'failed',
        error: `Could not start Fly machine: ${message}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    throw err;
  }
}
