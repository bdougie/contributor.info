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

/** The query shape findRecentCapture uses, kept apart so the overloads stay simple. */
export interface CaptureLookupDb {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        in(column: string, values: string[]): {
          gte(column: string, value: string): {
            order(column: string, options: { ascending: boolean }): {
              limit(n: number): PromiseLike<DbResult<RecentCaptureRow[]>>;
            };
          };
        };
      };
    };
  };
}

export interface RecentCaptureRow {
  id: string;
  fly_machine_id: string | null;
  params: { repository?: string; days?: number; sources?: string[] } | null;
}

/** GitHub owner and repository names: letters, digits, '-', '_', '.'. */
const GITHUB_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

export function isValidRepositoryName(fullName: string): boolean {
  const parts = fullName.split('/');
  return parts.length === 2 && GITHUB_NAME.test(parts[0]) && GITHUB_NAME.test(parts[1]);
}

/**
 * A capture that is already queued or running for the same repository within
 * this window is reused instead of starting another machine. Public callers
 * (a page load, the sync button) can otherwise start one Fly machine per
 * request; the datapipe syncs the whole window anyway, so a second machine
 * inside ten minutes would only repeat the first.
 */
export const CAPTURE_DEDUPE_MINUTES = 10;

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
  fly_machine_id: string;
  repository: string;
  sources: string[];
  days: number;
};

export function isCaptureEvent(eventName: string): boolean {
  return eventName in CAPTURE_SOURCES;
}

export async function findRecentCapture(
  supabase: CaptureLookupDb,
  repository: string,
  sources: string[],
): Promise<RecentCaptureRow | null> {
  const since = new Date(Date.now() - CAPTURE_DEDUPE_MINUTES * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('datapipe_jobs')
    .select('id, fly_machine_id, params')
    .eq('type', 'capture')
    .in('status', ['queued', 'running'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  const wanted = new Set(sources);
  for (const row of data ?? []) {
    if (row.params?.repository !== repository) continue;
    const covered = (row.params?.sources ?? []).filter((s) => wanted.has(s));
    if (covered.length === wanted.size) return row;
  }
  return null;
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
  supabase: DatapipeDb & CaptureLookupDb,
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

  const recent = await findRecentCapture(supabase, repository, sources);
  if (recent?.fly_machine_id && (recent.params?.days ?? 0) >= days) {
    console.log(
      'capture for %s reuses job %s started within %d min',
      repository,
      recent.id,
      CAPTURE_DEDUPE_MINUTES,
    );
    return {
      datapipe_job_id: recent.id,
      fly_machine_id: recent.fly_machine_id,
      repository,
      sources,
      days: recent.params?.days ?? days,
    };
  }

  const { data: job, error } = await supabase
    .from('datapipe_jobs')
    .insert({
      type: 'capture',
      status: 'queued',
      params: {
        repository,
        days,
        sources,
        config: 'production',
        reason: eventName,
        ...(selectors.prs.length > 0 ? { pr_numbers: selectors.prs } : {}),
        ...(selectors.issues.length > 0 ? { issue_numbers: selectors.issues } : {}),
      },
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
