/**
 * Route former Inngest `capture/*` events to gh-datapipe machines.
 *
 * Each event becomes one `datapipe_jobs` row plus one Fly machine that runs
 * `unified_workspace_backfill.py --job-id <row>`. The mapping to `--sources`
 * is documented in gh-datapipe/docs/capture-event-mapping.md.
 */

import { createMachine, isFlyConfigured } from './fly-machines.ts';

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
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): { single(): PromiseLike<DbResult<{ id: string }>> };
    };
    update(fields: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<DbResult<unknown>>;
    };
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<DbResult<{ full_name?: string | null }>>;
      };
    };
  };
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
  [key: string]: unknown;
}

/** Object-literal type (not an interface) so it is assignable to Record<string, unknown>. */
export type CaptureResult = {
  datapipe_job_id: string;
  fly_machine_id: string;
  repository: string;
  sources: string[];
  days: number;
};

export function isCaptureEvent(eventName: string): boolean {
  return eventName in CAPTURE_SOURCES;
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
  const days = daysFromPayload(payload);

  const { data: job, error } = await supabase
    .from('datapipe_jobs')
    .insert({
      type: 'capture',
      status: 'queued',
      params: { repository, days, sources, config: 'production', reason: eventName },
    })
    .select('id')
    .single();
  if (error || !job) throw new Error(`Failed to create datapipe job: ${error?.message}`);

  try {
    const machine = await createMachine({
      name: `capture-${String(job.id).slice(0, 8)}`,
      cmd: backfillCommand(job.id, repository, days, sources),
      env: { JOB_ID: job.id },
    });
    await supabase
      .from('datapipe_jobs')
      .update({ fly_machine_id: machine.id, progress: { step: 'machine_created' } })
      .eq('id', job.id);
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
