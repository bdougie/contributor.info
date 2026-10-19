/**
 * Repository size classification.
 *
 * `classify/repository.single`: one repository (the webhook / discovery path).
 * `classify/repository.size`: the former Inngest cron. Picks tracked
 * repositories that were never classified or whose classification is older
 * than 30 days (7 days for high priority) and classifies a bounded batch per
 * run; the rest wait for the next 6-hourly run.
 */

import { RepositorySizeClassifier } from '../repository-classifier.ts';
import { asString, NonRetriableJobError } from './types.ts';
import type { JobContext, JobPayload, JobResult } from './types.ts';

const RECLASSIFY_AFTER_DAYS = 30;
const HIGH_PRIORITY_RECLASSIFY_AFTER_DAYS = 7;
const MAX_PER_RUN = 25;

interface TrackedRow {
  repository_id: string;
  priority: string | null;
  size: string | null;
  size_calculated_at: string | null;
  repositories: { owner: string; name: string } | { owner: string; name: string }[] | null;
}

export interface ClassifyCandidate {
  id: string;
  owner: string;
  name: string;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Pure selection rule, exported for tests. */
export function needsClassification(
  row: Pick<TrackedRow, 'priority' | 'size' | 'size_calculated_at'>,
  now = new Date(),
): boolean {
  if (!row.size || !row.size_calculated_at) return true;
  const age = now.getTime() - new Date(row.size_calculated_at).getTime();
  const limitDays = row.priority === 'high'
    ? HIGH_PRIORITY_RECLASSIFY_AFTER_DAYS
    : RECLASSIFY_AFTER_DAYS;
  return age > limitDays * 24 * 60 * 60 * 1000;
}

export async function classifyRepositoryBatch(
  ctx: JobContext,
  _payload: JobPayload,
): Promise<JobResult> {
  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');

  // The same rule as needsClassification(), applied in SQL so the limit only
  // counts eligible rows: never classified, older than 30 days, or high
  // priority and older than 7 days.
  const staleCutoff = daysAgo(RECLASSIFY_AFTER_DAYS).toISOString();
  const highCutoff = daysAgo(HIGH_PRIORITY_RECLASSIFY_AFTER_DAYS).toISOString();
  const { data, error } = await ctx.supabase
    .from('tracked_repositories')
    .select('repository_id, priority, size, size_calculated_at, repositories!inner(owner, name)')
    .eq('tracking_enabled', true)
    .or(
      `size.is.null,size_calculated_at.is.null,size_calculated_at.lt.${staleCutoff},` +
        `and(priority.eq.high,size_calculated_at.lt.${highCutoff})`,
    )
    .order('size_calculated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN);
  if (error) throw new Error(`Failed to list tracked repositories: ${error.message}`);

  const candidates: ClassifyCandidate[] = [];
  for (const row of (data ?? []) as TrackedRow[]) {
    if (!needsClassification(row)) continue;
    const repo = Array.isArray(row.repositories) ? row.repositories[0] : row.repositories;
    if (!repo) continue;
    candidates.push({ id: row.repository_id, owner: repo.owner, name: repo.name });
    if (candidates.length >= MAX_PER_RUN) break;
  }

  if (candidates.length === 0) {
    return { classified: 0, failed: 0, message: 'Nothing to classify' };
  }

  const classifier = new RepositorySizeClassifier(ctx.githubToken, ctx.supabase);
  let classified = 0;
  let failed = 0;
  const failures: string[] = [];
  for (const candidate of candidates) {
    if (ctx.remainingMs() < 20_000) {
      console.warn(
        '[classify] stopping early with %d candidates left',
        candidates.length - classified - failed,
      );
      break;
    }
    try {
      await classifier.classifyAndUpdateRepository(candidate.id, candidate.owner, candidate.name);
      classified++;
    } catch (err) {
      failed++;
      failures.push(
        `${candidate.owner}/${candidate.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { candidates: candidates.length, classified, failed, failures };
}

export async function classifySingleRepository(
  ctx: JobContext,
  payload: JobPayload,
): Promise<JobResult> {
  const repositoryId = asString(payload.repositoryId);
  const owner = asString(payload.owner);
  const repo = asString(payload.repo) ?? asString(payload.name);
  if (!repositoryId || !owner || !repo) {
    throw new NonRetriableJobError(
      'classify/repository.single requires repositoryId, owner and repo',
    );
  }
  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');
  const classifier = new RepositorySizeClassifier(ctx.githubToken, ctx.supabase);
  const size = await classifier.classifyAndUpdateRepository(repositoryId, owner, repo);
  return { repositoryId, size, classified_at: new Date().toISOString() };
}
