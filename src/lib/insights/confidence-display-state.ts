import type { SyncStatus } from '@/hooks/use-on-demand-sync';

// Confidence calculations are cached for at most one hour.
export const CONFIDENCE_STALE_AFTER_MS = 60 * 60 * 1000;

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
  loading?: boolean;
  error?: string | null;
  syncStatus?: Pick<SyncStatus, 'isTriggering' | 'isInProgress' | 'isStalled' | 'error'>;
}

export function hasConfidenceScore(score: number | null): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
}

export function getConfidenceDisplayState(
  { score, calculatedAt, loading, error, syncStatus }: ConfidenceDisplayInput,
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
  return now - calculated >= CONFIDENCE_STALE_AFTER_MS ? 'stale' : 'ready';
}
