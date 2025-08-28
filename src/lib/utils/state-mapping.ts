/**
 * Utility functions for state mapping to replace nested ternary expressions
 */

export type PRState = 'open' | 'merged' | 'closed';

/**
 * Map PR state and merged status to standardized state
 */
export const getPRState = (pr: { state: string; merged?: boolean }): PRState => {
  if (pr.state === 'open' || pr.state?.toLowerCase() === 'open') return 'open';
  if (pr.merged) return 'merged';
  return 'closed';
};

/**
 * Get monitoring emoji based on metrics
 */
export const getMonitoringEmoji = (metrics: { success: boolean; timedOut: boolean }): string => {
  if (metrics.success) return '✅';
  if (metrics.timedOut) return '⏰';
  return '❌';
};

/**
 * Get change direction color for trending displays
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