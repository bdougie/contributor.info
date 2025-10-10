/**
 * Time range utilities for workspace analytics
 */

export const TIME_RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 730, // 2 years for "all" to limit data size
} as const;

export type TimeRange = keyof typeof TIME_RANGE_DAYS;

/**
 * Calculate start date for a given time range
 */
export function getStartDateForTimeRange(timeRange: TimeRange): Date {
  const days = TIME_RANGE_DAYS[timeRange];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Ensure startDate is valid and not in the future
  if (startDate.getTime() > Date.now()) {
    console.warn('Start date is in the future, using 30 days ago as fallback');
    startDate.setTime(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return startDate;
}

/**
 * Get date buckets for a time range
 */
export function getDateBuckets(days: number): string[] {
  const labels = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  
  return labels;
}

/**
 * Filter data by time range
 */
export function filterByTimeRange<T extends { created_at: string }>(
  data: T[],
  timeRange: TimeRange
): T[] {
  const startDate = getStartDateForTimeRange(timeRange);
  return data.filter((item) => {
    const itemDate = new Date(item.created_at);
    return itemDate >= startDate;
  });
}
