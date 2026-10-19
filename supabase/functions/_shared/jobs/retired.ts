/**
 * Former Inngest events that no longer do anything.
 *
 * Their consumers wrote to tables dropped by
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

/**
 * Dedupe windows applied by queue-event, keyed by job type. Replaces the
 * per-repository concurrency/throttle settings the Inngest functions had.
 * Values are Postgres intervals.
 */
export const DEDUPE_WINDOWS: Record<string, string> = {
  'embeddings/compute.requested': '10 minutes',
  'embeddings.generate': '10 minutes',
  'embedding/issue.generate': '10 minutes',
  'embedding/pr.generate': '10 minutes',
  'embedding/batch.process': '10 minutes',
  'similarity/repository.recalculate': '10 minutes',
  'workspace/priorities.sync': '10 minutes',
  'classify/repository.single': '1 hour',
  'classify/repository.size': '6 hours',
};
