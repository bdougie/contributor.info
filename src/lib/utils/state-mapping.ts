/**
 * Utility functions for state mapping to replace nested ternary expressions
 */

export type PRState = 'open' | 'merged' | 'closed';

/**
 * Map PR state and merged status to standardized state
 * Handles various input formats and normalizes them to a consistent state
 * 
 * @param pr - Pull request object with state and optional merged flag
 * @param pr.state - Current state of the PR (case-insensitive)
 * @param pr.merged - Optional boolean indicating if PR was merged
 * @returns Normalized PR state: 'open', 'merged', or 'closed'
 * 
 * @example
 * getPRState({ state: 'open' }) // returns 'open'
 * getPRState({ state: 'OPEN' }) // returns 'open' (case-insensitive)
 * getPRState({ state: 'closed', merged: true }) // returns 'merged'
 * getPRState({ state: 'closed', merged: false }) // returns 'closed'
 */
export const getPRState = (pr: { state: string; merged?: boolean }): PRState => {
  if (pr.state === 'open' || pr.state?.toLowerCase() === 'open') return 'open';
  if (pr.merged) return 'merged';
  return 'closed';
};

/**
 * Get monitoring emoji based on metrics
 * Visual indicator for operation status in monitoring displays
 * 
 * @param metrics - Object containing success and timeout status
 * @param metrics.success - Whether the operation completed successfully
 * @param metrics.timedOut - Whether the operation timed out
 * @returns Emoji indicator: '✅' for success, '⏰' for timeout, '❌' for failure
 * 
 * @example
 * getMonitoringEmoji({ success: true, timedOut: false }) // returns '✅'
 * getMonitoringEmoji({ success: false, timedOut: true }) // returns '⏰'
 * getMonitoringEmoji({ success: false, timedOut: false }) // returns '❌'
 */
export const getMonitoringEmoji = (metrics: { success: boolean; timedOut: boolean }): string => {
  if (metrics.success) return '✅';
  if (metrics.timedOut) return '⏰';
  return '❌';
};

/**
 * Get change direction color for trending displays
 * Determines text color based on whether a change is positive, neutral, or negative
 * 
 * @param isPositive - Whether the change represents an improvement
 * @param isNeutral - Whether there was no significant change
 * @returns Tailwind CSS text color class
 * 
 * @example
 * getChangeDirectionColor(true, false) // returns 'text-green-600' (positive)
 * getChangeDirectionColor(false, true) // returns 'text-muted-foreground' (neutral)
 * getChangeDirectionColor(false, false) // returns 'text-red-600' (negative)
 */
export const getChangeDirectionColor = (
  isPositive: boolean,
  isNeutral: boolean
): string => {
  if (isPositive) return 'text-green-600';
  if (isNeutral) return 'text-muted-foreground';
  return 'text-red-600';
};

/**
 * Format percentage change display
 * Creates a formatted string with appropriate sign prefix for percentage changes
 * 
 * @param isNeutral - Whether the change is neutral (no change)
 * @param isPositive - Whether the change is positive
 * @param displayValue - The numeric or string value to display
 * @returns Formatted percentage string with appropriate sign
 * 
 * @example
 * formatPercentageChange(true, false, 5) // returns '0%' (neutral overrides)
 * formatPercentageChange(false, true, 5) // returns '+5'
 * formatPercentageChange(false, false, 5) // returns '-5'
 */
export const formatPercentageChange = (
  isNeutral: boolean,
  isPositive: boolean,
  displayValue: string | number
): string => {
  if (isNeutral) return '0%';
  const prefix = isPositive ? '+' : '-';
  return `${prefix}${displayValue}`;
};

/**
 * Get trend color based on numeric trend value
 * Determines text color class based on positive, negative, or zero trend
 * 
 * @param trend - Numeric trend value (positive = good, negative = bad, zero = neutral)
 * @returns Tailwind CSS text color class
 * 
 * @example
 * getTrendColor(5) // returns 'text-green-600' (positive trend)
 * getTrendColor(-3) // returns 'text-red-600' (negative trend)  
 * getTrendColor(0) // returns 'text-muted-foreground' (neutral)
 */
export const getTrendColor = (trend: number): string => {
  if (trend > 0) return 'text-green-600';
  if (trend < 0) return 'text-red-600';
  return 'text-muted-foreground';
};
