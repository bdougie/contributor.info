/**
 * Former Inngest events that no longer do anything, and the dedupe policy
 * queue-event applies per job type.
 *
 * Retired consumers wrote to tables dropped by
 * supabase/migrations/20260428000007_drop_dead_tables.sql, or had no consumer
 * at all. Callers (frontend, webhooks) still emit them; queue-event answers
 * success without creating a job so nothing fails and nothing is stored.
 */

export const RETIRED_EVENTS: Record<string, string> = {
  'workspace.metrics.aggregate': 'workspace_metrics_cache was dropped 2026-04-28',
  'workspace.metrics.aggregate.scheduled': 'workspace_metrics_cache was dropped 2026-04-28',
  'workspace.repository.changed':
    'cache invalidation target dropped 2026-04-28; mark_workspace_cache_stale() is a no-op',
  'embedding/progress.update': 'never had a consumer',
  'capture/commits.initial':
    'no consumer since the Netlify Inngest app was paused; commits come from gh-datapipe',
  'capture/commits.update':
    'no consumer since the Netlify Inngest app was paused; commits come from gh-datapipe',
  'update/pr.activity': 'no caller; gh-datapipe hourly-sync refreshes PR activity',
  'capture/commits.analyze':
    'consumer only existed in the paused Netlify Inngest app; commits come from gh-datapipe',
};

export function isRetiredEvent(eventName: string): boolean {
  return eventName in RETIRED_EVENTS;
}

export interface DedupePolicy {
  /** Postgres interval. */
  window: string;
  /**
   * `queued`: only merge into a job that has not started, because a running
   * job has already chosen its items. `active`: also merge into a running job,
   * for whole-table sweeps where a second run would only repeat the first.
   */
  against: 'queued' | 'active';
}

/**
 * Replaces the per-repository concurrency/throttle settings the Inngest
 * functions had. Item-level embedding events (an issue webhook) carry
 * `repositoryId`, so two issues in the same repository within the window
 * share one queued job; once that job is running the next issue gets a new
 * one and is picked up because the selection query runs at execution time.
 */
export const DEDUPE_POLICIES: Record<string, DedupePolicy> = {
  'embeddings/compute.requested': { window: '10 minutes', against: 'queued' },
  'embeddings.generate': { window: '10 minutes', against: 'queued' },
  'embedding/issue.generate': { window: '10 minutes', against: 'queued' },
  'embedding/pr.generate': { window: '10 minutes', against: 'queued' },
  'embedding/batch.process': { window: '10 minutes', against: 'queued' },
  'similarity/repository.recalculate': { window: '10 minutes', against: 'queued' },
  'workspace/priorities.sync': { window: '10 minutes', against: 'active' },
  'classify/repository.single': { window: '1 hour', against: 'active' },
  'classify/repository.size': { window: '6 hours', against: 'active' },
};

export function dedupeStatuses(policy: DedupePolicy): string[] {
  return policy.against === 'queued' ? ['queued'] : ['queued', 'processing'];
}
