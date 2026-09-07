import type { SyncStatus } from '@/hooks/use-on-demand-sync';

// In-app confidence calculations are cached for at most one hour.
export const CONFIDENCE_STALE_AFTER_MS = 60 * 60 * 1000;

// Scores from the contributor-roles summary are dated by the last repository
// sync, which only runs on demand. Treat them as stale on a much longer window.
export const SYNCED_CONFIDENCE_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type ConfidenceDisplayState =
  | 'loading'
  | 'refreshing'
  | 'stale'
  | 'unavailable'
  | 'error'
  | 'unknown'
  | 'ready';

interface ConfidenceDisplayInput {
  score: number | null;
  calculatedAt?: string | null;
  /** Age after which the score is considered stale. Defaults to the in-app cache lifetime. */
  staleAfterMs?: number;
  loading?: boolean;
  error?: string | null;
  syncStatus?: Pick<SyncStatus, 'isTriggering' | 'isInProgress' | 'isStalled' | 'error'>;
}

export function hasConfidenceScore(score: number | null): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
}

export function getConfidenceDisplayState(
  {
    score,
    calculatedAt,
    staleAfterMs = CONFIDENCE_STALE_AFTER_MS,
    loading,
    error,
    syncStatus,
  }: ConfidenceDisplayInput,
  now = Date.now()
): ConfidenceDisplayState {
  if (syncStatus?.isStalled) return 'stale';
  if (error || syncStatus?.error) return 'error';
  if (loading || syncStatus?.isTriggering || syncStatus?.isInProgress) {
    return hasConfidenceScore(score) ? 'refreshing' : 'loading';
  }
  if (!hasConfidenceScore(score)) return 'unavailable';
  const calculated = calculatedAt ? Date.parse(calculatedAt) : NaN;
  if (!Number.isFinite(calculated) || calculated > now) return 'unknown';
  return now - calculated >= staleAfterMs ? 'stale' : 'ready';
}
