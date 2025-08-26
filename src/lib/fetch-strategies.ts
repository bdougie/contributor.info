import { RepositorySize } from './validation/database-schemas';

/**
 * Fetch strategy configuration based on repository size
 */
export interface FetchStrategy {
  /** Number of days of data to fetch for live queries */
  liveDataDays: number;
  /** Whether to fetch data immediately or defer to background */
  immediate: boolean;
  /** Whether to chunk the data fetching */
  chunked: boolean;
  /** Whether to apply aggressive rate limiting */
  rateLimit: boolean;
  /** Maximum number of PRs to fetch in live query */
  maxPRsLive: number;
  /** Maximum number of PRs from cache */
  maxPRsCache: number;
  /** Whether to trigger background capture */
  triggerCapture: boolean;
  /** Priority for background capture */
  capturePriority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Get fetch strategy based on repository size
 */
export function getFetchStrategy(size: RepositorySize | null): FetchStrategy {
  // Default strategy for unclassified repositories
  if (!size) {
    return {
      liveDataDays: 14,
      immediate: true,
      chunked: false,
      rateLimit: false,
      maxPRsLive: 100,
      maxPRsCache: 200,
      triggerCapture: true,
      capturePriority: 'medium',
    };
  }

  const strategies: Record<RepositorySize, FetchStrategy> = {
    small: {
      liveDataDays: 30,
      immediate: true,
      chunked: false,
      rateLimit: false,
      maxPRsLive: 200,
      maxPRsCache: 300,
      triggerCapture: true,
      capturePriority: 'low',
    },
    medium: {
      liveDataDays: 14,
      immediate: true,
      chunked: false,
      rateLimit: false,
      maxPRsLive: 150,
      maxPRsCache: 300,
      triggerCapture: true,
      capturePriority: 'medium',
    },
    large: {
      liveDataDays: 7,
      immediate: true,
      chunked: true,
      rateLimit: false,
      maxPRsLive: 100,
      maxPRsCache: 300,
      triggerCapture: true,
      capturePriority: 'high',
    },
    xl: {
      liveDataDays: 3,
      immediate: true,
      chunked: true,
      rateLimit: true,
      maxPRsLive: 50,
      maxPRsCache: 300,
      triggerCapture: true,
      capturePriority: 'critical',
    },
  };

  return strategies[size];
}

/**
 * Calculate fetch window based on strategy and user request
 */
export function calculateFetchWindow(
  strategy: FetchStrategy,
  requestedDays: number,
): { since: Date; days: number } {
  // For XL repos, cap the live fetch window
  const effectiveDays = Math.min(requestedDays, strategy.liveDataDays);

  const since = new Date();
  since.setDate(since.getDate() - effectiveDays);

  return { since, days: effectiveDays };
}

/**
 * Determine if we should use cached data based on its age
 */
export function shouldUseCachedData(lastUpdated: Date | null, strategy: FetchStrategy): boolean {
  if (!lastUpdated) return false;

  const ageInHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

  // XL repos: use cache if less than 6 hours old
  if (strategy.rateLimit && ageInHours < 6) return true;

  // Large repos: use cache if less than 12 hours old
  if (strategy.chunked && ageInHours < 12) return true;

  // Medium/Small: use cache if less than 24 hours old
  return ageInHours < 24;
}

/**
 * Get rate limit delay based on strategy
 */
export function getRateLimitDelay(strategy: FetchStrategy): number {
  if (strategy.rateLimit) {
    return 2000; // 2 seconds between requests for XL repos
  }
  if (strategy.chunked) {
    return 1000; // 1 second for large repos
  }
  return 500; // 500ms for medium/small repos
}
