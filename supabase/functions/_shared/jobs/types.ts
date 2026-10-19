/**
 * Types shared by the pgmq `jobs` worker (process-job) and its handlers.
 *
 * Job types use the former Inngest event names so callers did not have to
 * change: `capture/*`, `classify/*`, `embeddings/*`, `workspace/*`, plus
 * `cron/*` for the schedules that have no event-driven counterpart.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export type JobPayload = Record<string, unknown>;
export type JobResult = Record<string, unknown>;

export interface EnqueueOptions {
  repositoryId?: string;
  source?: string;
  /** Postgres interval, e.g. '10 minutes'. Skips an identical job in dedupeStatuses. */
  dedupeWindow?: string;
  /** Statuses the dedupe looks at; default queued and processing. */
  dedupeStatuses?: string[];
}

/** GitHub owner and repository names: letters, digits, '-', '_', '.'. */
const GITHUB_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

/**
 * Validate an owner/name pair that came from a caller before it reaches a
 * URL, a query or a log line. Throws NonRetriableJobError on anything that
 * is not a GitHub-shaped name.
 */
export function assertRepositoryName(owner: unknown, name: unknown): [string, string] {
  if (
    typeof owner !== 'string' || typeof name !== 'string' || !GITHUB_NAME.test(owner) ||
    !GITHUB_NAME.test(name)
  ) {
    throw new NonRetriableJobError('owner and repository must be GitHub-shaped names');
  }
  return [owner, name];
}

export interface JobContext {
  supabase: SupabaseClient;
  jobId: string;
  type: string;
  githubToken: string;
  /** Queue a follow-up job. Returns the background_jobs id. */
  enqueue: (type: string, payload: JobPayload, options?: EnqueueOptions) => Promise<string>;
  /** Milliseconds left before the worker stops taking new work. */
  remainingMs: () => number;
}

export type JobHandler = (ctx: JobContext, payload: JobPayload) => Promise<JobResult>;

/** Thrown by a handler when retrying cannot help (bad payload, missing row). */
export class NonRetriableJobError extends Error {
  readonly nonRetriable = true;
  constructor(message: string) {
    super(message);
    this.name = 'NonRetriableJobError';
  }
}

export function isNonRetriable(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    (error as { nonRetriable?: boolean }).nonRetriable === true;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
