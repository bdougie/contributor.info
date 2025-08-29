/**
 * Utility functions for size-based styling to replace nested ternary expressions
 */

export type Size = 'small' | 'medium' | 'large';

/**
 * Get icon size classes based on size variant
 * Provides consistent icon sizing across components
 *
 * @param size - Size variant ('small', 'medium', 'large')
 * @returns Tailwind CSS size classes
 *
 * @example
 * getIconSize('small') // returns 'h-3 w-3'
 * getIconSize('medium') // returns 'h-4 w-4'
 * getIconSize('large') // returns 'h-6 w-6'
 */
export const getIconSize = (size: Size = 'medium'): string => {
  if (size === 'small') return 'h-3 w-3';
  if (size === 'large') return 'h-6 w-6';
  return 'h-4 w-4';
};

/**
 * Get text size classes based on size variant
 * Provides consistent text sizing for different component sizes
 *
 * @param size - Size variant ('small', 'medium', 'large')
 * @returns Tailwind CSS text size classes
 *
 * @example
 * getTextSize('small') // returns 'text-sm'
 * getTextSize('medium') // returns 'text-base'
 * getTextSize('large') // returns 'text-lg'
 */
export const getTextSize = (size: Size = 'medium'): string => {
  if (size === 'small') return 'text-sm';
  if (size === 'large') return 'text-lg';
  return 'text-base';
};

/**
 * Get padding classes based on size variant
 * Provides consistent padding across different component sizes
 *
 * @param size - Size variant ('small', 'medium', 'large')
 * @returns Tailwind CSS padding classes
 *
 * @example
 * getPadding('small') // returns 'p-1'
 * getPadding('medium') // returns 'p-2'
 * getPadding('large') // returns 'p-4'
 */
export const getPadding = (size: Size = 'medium'): string => {
  if (size === 'small') return 'p-1';
  if (size === 'large') return 'p-4';
  return 'p-2';
};

/**
 * Get spacing gap classes based on size variant
 * Provides consistent spacing between elements
 *
 * @param size - Size variant ('small', 'medium', 'large')
 * @returns Tailwind CSS gap classes
 *
 * @example
 * getSpacing('small') // returns 'gap-1'
 * getSpacing('medium') // returns 'gap-2'
 * getSpacing('large') // returns 'gap-4'
 */
export const getSpacing = (size: Size = 'medium'): string => {
  if (size === 'small') return 'gap-1';
  if (size === 'large') return 'gap-4';
  return 'gap-2';
};
