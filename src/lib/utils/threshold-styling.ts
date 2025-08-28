/**
 * Utility functions for threshold-based styling to replace nested ternary expressions
 */

// Threshold constants for percentage-based color coding
const PERCENTAGE_THRESHOLD_CRITICAL = 90;
const PERCENTAGE_THRESHOLD_WARNING = 75;

// Threshold constants for value categorization
const VALUE_THRESHOLD_LOW = 30;
const VALUE_THRESHOLD_MEDIUM = 50;
const VALUE_THRESHOLD_HIGH = 70;

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
  if (percentage > PERCENTAGE_THRESHOLD_CRITICAL) return 'bg-red-500';
  if (percentage > PERCENTAGE_THRESHOLD_WARNING) return 'bg-amber-500';
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
  if (value <= VALUE_THRESHOLD_LOW) return 'Red';
  if (value <= VALUE_THRESHOLD_MEDIUM) return 'Orange';
  if (value <= VALUE_THRESHOLD_HIGH) return 'Blue';
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
