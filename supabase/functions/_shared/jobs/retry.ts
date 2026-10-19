/**
 * Retry policy for the pgmq `jobs` queue.
 *
 * pgmq counts deliveries in `read_ct` (1 on the first delivery). A failed
 * delivery is retried by extending the message's visibility timeout, so the
 * message stays in the queue and reappears after the delay. Once the attempt
 * count passes `max_retries` the message is archived and the row marked failed.
 */

const BASE_DELAY_SECONDS = 60;
const MAX_DELAY_SECONDS = 3600;

/** Delay before the next delivery, exponential from 60 s, capped at 1 h. */
export function retryDelaySeconds(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt));
  return Math.min(BASE_DELAY_SECONDS * 2 ** (n - 1), MAX_DELAY_SECONDS);
}

/**
 * @param attempt the delivery that just failed (pgmq read_ct, 1-based)
 * @param maxRetries background_jobs.max_retries
 */
export function shouldRetry(attempt: number, maxRetries: number, nonRetriable: boolean): boolean {
  if (nonRetriable) return false;
  return attempt <= Math.max(0, maxRetries);
}

/** Visibility timeout handed to pgmq.read: longer than one worker invocation. */
export const VISIBILITY_TIMEOUT_SECONDS = 600;

/**
 * Wall clock budget for one worker invocation. Supabase edge functions are
 * cut off at 400 s; stop taking new messages well before that so the one in
 * flight can finish and report.
 */
export const WORKER_BUDGET_MS = 280_000;

/** Messages read per pgmq call. */
export const READ_BATCH_SIZE = 5;
