/**
 * Utility functions for code and diff styling to replace nested ternary expressions
 */

export type LineType = 'addition' | 'deletion' | 'unchanged';

/**
 * Get diff line symbol based on line type
 * Provides consistent symbols for code diff displays
 * 
 * @param type - Type of diff line ('addition', 'deletion', 'unchanged')
 * @returns Symbol character: '+' for additions, '-' for deletions, ' ' for unchanged
 * 
 * @example
 * getDiffSymbol('addition') // returns '+'
 * getDiffSymbol('deletion') // returns '-'
 * getDiffSymbol('unchanged') // returns ' '
 */
export const getDiffSymbol = (type: LineType): string => {
  if (type === 'addition') return '+';
  if (type === 'deletion') return '-';
  return ' ';
};

/**
 * Get diff line background color based on line type
 * Provides consistent background colors for code diff displays
 * 
 * @param type - Type of diff line ('addition', 'deletion', 'unchanged')
 * @returns Tailwind CSS background color class
 * 
 * @example
 * getDiffBackgroundColor('addition') // returns 'bg-green-50 dark:bg-green-950'
 * getDiffBackgroundColor('deletion') // returns 'bg-red-50 dark:bg-red-950'
 * getDiffBackgroundColor('unchanged') // returns 'bg-transparent'
 */
export const getDiffBackgroundColor = (type: LineType): string => {
  if (type === 'addition') return 'bg-green-50 dark:bg-green-950';
  if (type === 'deletion') return 'bg-red-50 dark:bg-red-950';
  return 'bg-transparent';
};

/**
 * Get diff line text color based on line type
 * Provides consistent text colors for code diff displays
 * 
 * @param type - Type of diff line ('addition', 'deletion', 'unchanged')
 * @returns Tailwind CSS text color class
 * 
 * @example
 * getDiffTextColor('addition') // returns 'text-green-700 dark:text-green-300'
 * getDiffTextColor('deletion') // returns 'text-red-700 dark:text-red-300'
 * getDiffTextColor('unchanged') // returns 'text-foreground'
 */
export const getDiffTextColor = (type: LineType): string => {
  if (type === 'addition') return 'text-green-700 dark:text-green-300';
  if (type === 'deletion') return 'text-red-700 dark:text-red-300';
  return 'text-foreground';
};

/**
 * Get diff line border color based on line type
 * Provides consistent border colors for code diff displays
 * 
 * @param type - Type of diff line ('addition', 'deletion', 'unchanged')
 * @returns Tailwind CSS border color class
 * 
 * @example
 * getDiffBorderColor('addition') // returns 'border-l-green-500'
 * getDiffBorderColor('deletion') // returns 'border-l-red-500'
 * getDiffBorderColor('unchanged') // returns 'border-l-transparent'
 */
export const getDiffBorderColor = (type: LineType): string => {
  if (type === 'addition') return 'border-l-green-500';
  if (type === 'deletion') return 'border-l-red-500';
  return 'border-l-transparent';
};