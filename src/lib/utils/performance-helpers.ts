/**
 * Helper functions to replace nested ternaries and improve tree shaking
 */

// Score rating helpers
export function getRatingClass(score: number): string {
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

export function getRatingColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getRatingTextColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function getRatingBadgeVariant(rating: string): 'default' | 'secondary' | 'destructive' {
  if (rating === 'good') return 'default';
  if (rating === 'needs-improvement') return 'secondary';
  return 'destructive';
}

// Trend direction helpers
export function getTrendDirection(change: number): 'up' | 'down' | 'stable' {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'stable';
}

export function getTrendDirectionReverse(change: number): 'up' | 'down' | 'stable' {
  // For metrics where lower is better (like review time)
  if (change < 0) return 'down';
  if (change > 0) return 'up';
  return 'stable';
}

// Time range helpers
export const TIME_RANGE_HOURS: Record<string, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

export function getTimeRangeHours(timeRange: string): number {
  return TIME_RANGE_HOURS[timeRange] || 24;
}

// Period label helpers
export function getPeriodPrefix(periodLabel: string): string {
  if (periodLabel === 'week') return 'Weekly';
  if (periodLabel === 'month') return 'Monthly';
  return 'Daily';
}

// Variant value helpers
export function getVariantValue<T>(variant: string, lowValue: T, highValue: T, defaultValue: T): T {
  if (variant === 'low-confidence' || variant === 'low-activity') return lowValue;
  if (variant === 'high-priority' || variant === 'high-activity') return highValue;
  return defaultValue;
}

// Queue status helpers
export function getQueueHealthStatus(pending: number, completed: number, failed: number): string {
  if (pending > 0) return '🟡 Active';
  if (completed > 0) return '✅ Processed';
  if (failed > 0) return '❌ Failed';
  return '⚪ Idle';
}

// PR state helpers
export function getPRActivityType(pr: { merged?: boolean; state: string }): string {
  if (pr.merged) return 'merged';
  if (pr.state === 'closed') return 'closed';
  return 'opened';
}

// Batch processing helpers
export function getBatchCapabilityMessage(
  canMake100: boolean,
  canMake10: boolean,
  cannotMake: boolean
): string {
  if (canMake100) return '  • ✅ Good to process large batches';
  if (canMake10) return '  • ⚡ Process small batches';
  if (cannotMake) return '  • ⏸️ Wait for rate limit reset';
  return '  • ⚠️ Limited capacity';
}

// Time sensitivity factors
export function getTimeSensitivityFactor(timeRange: number): number {
  if (timeRange <= 1) return 0.9;
  if (timeRange <= 7) return 0.5;
  return 0.1;
}

export function getBatchSizeFactor(maxItems: number): number {
  if (maxItems <= 50) return 0.8;
  if (maxItems <= 200) return 0.5;
  return 0.2;
}

export function getPriorityFactor(priority: string): number {
  if (priority === 'high') return 0.7;
  if (priority === 'low') return 0.3;
  return 0.5;
}

// Mergeable state helpers
export function getMergeableStatus(mergeable: string): boolean | null {
  if (mergeable === 'MERGEABLE') return true;
  if (mergeable === 'CONFLICTING') return false;
  return null;
}
