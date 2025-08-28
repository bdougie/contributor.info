/**
 * Utility functions for score-based styling to replace nested ternary expressions
 */

/**
 * Get background color class based on score thresholds (0-100)
 * 
 * @param score - Numeric score between 0-100
 * @returns Tailwind CSS background color class
 * 
 * @example
 * getScoreBgColor(85) // returns 'bg-green-500'
 * getScoreBgColor(65) // returns 'bg-yellow-500'
 * getScoreBgColor(40) // returns 'bg-red-500'
 */
export const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

/**
 * Get text color class based on score thresholds (0-100)
 * 
 * @param score - Numeric score between 0-100
 * @returns Tailwind CSS text color class
 * 
 * @example
 * getScoreTextColor(85) // returns 'text-green-600'
 * getScoreTextColor(65) // returns 'text-yellow-600'
 * getScoreTextColor(40) // returns 'text-red-600'
 */
export const getScoreTextColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Get hit rate color class for cache debug displays
 * 
 * @param hitRate - Cache hit rate percentage (0-100)
 * @returns Tailwind CSS text color class based on performance thresholds
 * 
 * @example
 * getHitRateColor(85) // returns 'text-green-600' (good performance)
 * getHitRateColor(70) // returns 'text-yellow-600' (moderate performance)
 * getHitRateColor(50) // returns 'text-red-600' (poor performance)
 */
export const getHitRateColor = (hitRate: number): string => {
  if (hitRate >= 80) return 'text-green-600';
  if (hitRate >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Get status text color based on score thresholds
 * Includes dark mode support for better visibility
 * 
 * @param score - Numeric score between 0-100
 * @returns Tailwind CSS text color classes with dark mode variants
 * 
 * @example
 * getScoreStatusColor(85) // returns 'text-green-800 dark:text-green-200'
 * getScoreStatusColor(65) // returns 'text-yellow-800 dark:text-yellow-200'
 * getScoreStatusColor(40) // returns 'text-red-800 dark:text-red-200'
 */
export const getScoreStatusColor = (score: number): string => {
  if (score >= 80) return 'text-green-800 dark:text-green-200';
  if (score >= 60) return 'text-yellow-800 dark:text-yellow-200';
  return 'text-red-800 dark:text-red-200';
};
EOF < /dev/null