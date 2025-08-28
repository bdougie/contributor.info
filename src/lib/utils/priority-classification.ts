/**
 * Utility functions for priority classification to replace nested ternary expressions
 */

export type PriorityLevel = 'low' | 'medium' | 'high';

/**
 * Get priority level based on score thresholds (0-100)
 * 
 * @param score - Numeric score between 0-100
 * @returns Priority level: 'high' (≥70), 'medium' (≥50), or 'low' (<50)
 * 
 * @example
 * getPriorityLevel(80) // returns 'high'
 * getPriorityLevel(60) // returns 'medium'
 * getPriorityLevel(30) // returns 'low'
 */
export const getPriorityLevel = (score: number): PriorityLevel => {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

/**
 * Confidence levels by variant type
 * Maps variant names to confidence percentage scores
 */
export const CONFIDENCE_BY_VARIANT = {
  'low-confidence': 40,
  'high-priority': 95,
  'default': 85,
} as const;

/**
 * Get confidence score by variant type
 * 
 * @param variant - Variant type ('low-confidence', 'high-priority', or custom string)
 * @returns Confidence score: 40 for low-confidence, 95 for high-priority, 85 default
 * 
 * @example
 * getConfidenceByVariant('high-priority') // returns 95
 * getConfidenceByVariant('low-confidence') // returns 40
 * getConfidenceByVariant('custom') // returns 85 (default)
 */
export const getConfidenceByVariant = (
  variant: keyof typeof CONFIDENCE_BY_VARIANT | string
): number => {
  return CONFIDENCE_BY_VARIANT[variant as keyof typeof CONFIDENCE_BY_VARIANT] ?? CONFIDENCE_BY_VARIANT.default;
};

/**
 * Get image loading strategy based on priority and lazy settings
 * Determines whether an image should be loaded eagerly or lazily based on multiple factors
 * 
 * @param priority - If true, forces eager loading regardless of other settings
 * @param loading - Explicit loading strategy to use if provided
 * @param lazy - If true and no higher priority settings, uses lazy loading
 * @returns Loading strategy: 'eager' or 'lazy'
 * 
 * @example
 * getImageLoadingStrategy(true) // returns 'eager' (priority overrides)
 * getImageLoadingStrategy(false, 'lazy') // returns 'lazy' (explicit loading)
 * getImageLoadingStrategy(false, undefined, true) // returns 'lazy'
 * getImageLoadingStrategy() // returns 'eager' (default)
 */
export const getImageLoadingStrategy = (
  priority?: boolean,
  loading?: 'lazy' | 'eager',
  lazy?: boolean
): 'lazy' | 'eager' => {
  if (priority) return 'eager';
  if (loading) return loading;
  if (lazy) return 'lazy';
  return 'eager';
};
