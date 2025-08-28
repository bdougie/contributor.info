/**
 * Utility functions for score-based styling to replace nested ternary expressions
 */

/**
 * Get background color class based on score thresholds (0-100)
 */
export const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

/**
 * Get text color class based on score thresholds (0-100)
 */
export const getScoreTextColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Get hit rate color class for cache debug displays
 */
export const getHitRateColor = (hitRate: number): string => {
  if (hitRate >= 80) return 'text-green-600';
  if (hitRate >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Get status text color based on score thresholds
 */
export const getScoreStatusColor = (score: number): string => {
  if (score >= 80) return 'text-green-800 dark:text-green-200';
  if (score >= 60) return 'text-yellow-800 dark:text-yellow-200';
  return 'text-red-800 dark:text-red-200';
};