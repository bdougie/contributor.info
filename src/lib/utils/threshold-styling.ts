/**
 * Utility functions for threshold-based styling to replace nested ternary expressions
 */

/**
 * Get background color based on percentage threshold
 * Used for progress bars and performance indicators
 * 
 * @param percentage - Numeric percentage value (0-100)
 * @returns Tailwind CSS background color class based on thresholds
 * 
 * @example
 * getPercentageBgColor(95) // returns 'bg-red-500' (critical)
 * getPercentageBgColor(80) // returns 'bg-amber-500' (warning)
 * getPercentageBgColor(50) // returns 'bg-green-500' (good)
 */
export const getPercentageBgColor = (percentage: number): string => {
  if (percentage > 90) return 'bg-red-500';
  if (percentage > 75) return 'bg-amber-500';
  return 'bg-green-500';
};

/**
 * Get value category color name based on range thresholds
 * Maps numeric values to color names for visualization purposes
 * 
 * @param value - Numeric value to categorize (0-100 range typical)
 * @returns Color name string for chart/visual displays
 * 
 * @example
 * getValueCategoryColor(25) // returns 'Red' (low range)
 * getValueCategoryColor(45) // returns 'Orange' (medium-low range)
 * getValueCategoryColor(65) // returns 'Blue' (medium-high range)
 * getValueCategoryColor(85) // returns 'Green' (high range)
 */
export const getValueCategoryColor = (value: number): string => {
  if (value <= 30) return 'Red';
  if (value <= 50) return 'Orange';
  if (value <= 70) return 'Blue';
  return 'Green';
};

/**
 * Get validation border class based on errors and value state
 * Used for form inputs to show validation state
 * 
 * @param hasErrors - Whether there are validation errors
 * @param isValid - Whether the current value is valid (e.g., meets minimum length)
 * @returns Tailwind CSS border color class or empty string
 * 
 * @example
 * getValidationBorderClass(true, false) // returns 'border-red-500' (has errors)
 * getValidationBorderClass(false, true) // returns 'border-green-500' (valid)
 * getValidationBorderClass(false, false) // returns '' (neutral/default)
 */
export const getValidationBorderClass = (hasErrors: boolean, isValid: boolean): string => {
  if (hasErrors) return 'border-red-500';
  if (isValid) return 'border-green-500';
  return '';
};