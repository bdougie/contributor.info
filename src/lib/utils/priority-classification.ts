/**
 * Utility functions for priority classification to replace nested ternary expressions
 */

export type PriorityLevel = 'low' | 'medium' | 'high';

/**
 * Get priority level based on score thresholds (0-100)
 */
export const getPriorityLevel = (score: number): PriorityLevel => {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

/**
 * Confidence levels by variant type
 */
export const CONFIDENCE_BY_VARIANT = {
  'low-confidence': 40,
  'high-priority': 95,
  'default': 85,
} as const;

/**
 * Get confidence score by variant type
 */
export const getConfidenceByVariant = (
  variant: keyof typeof CONFIDENCE_BY_VARIANT | string
): number => {
  return CONFIDENCE_BY_VARIANT[variant as keyof typeof CONFIDENCE_BY_VARIANT] ?? CONFIDENCE_BY_VARIANT.default;
};

/**
 * Get image loading strategy based on priority and lazy settings
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