/**
 * Component State Management Utilities
 *
 * Utilities for handling complex component state patterns that typically
 * require nested ternary expressions. These utilities provide cleaner,
 * more maintainable ways to handle multi-state component logic.
 *
 * NOTE: Image optimization functions have been moved to image-optimization.ts
 * to consolidate all image-related logic in one place.
 */

/**
 * Handles form field error message display with proper fallback logic
 *
 * @param error - The error object from form validation
 * @param children - The fallback content to display if no error message
 * @returns The appropriate content to display
 *
 * @example
 * ```tsx
 * const body = getFormErrorContent(error, children);
 * // Instead of: const body = error ? String(error?.message) : children;
 * ```
 */
export const getFormErrorContent = (
  error?: { message?: string },
  children?: React.ReactNode
): React.ReactNode => {
  if (error?.message) return String(error.message);
  return children;
};

/**
 * Configuration for carousel orientation based on axis
 */
export const CAROUSEL_ORIENTATION_MAP = {
  y: 'vertical',
  vertical: 'vertical',
  default: 'horizontal',
} as const;

/**
 * Gets the carousel orientation based on options and explicit orientation
 *
 * @param orientation - Explicitly set orientation
 * @param opts - Carousel options that might contain axis setting
 * @returns The appropriate orientation value
 *
 * @example
 * ```tsx
 * orientation: getCarouselOrientation(orientation, opts)
 * // Instead of: orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal')
 * ```
 */
export const getCarouselOrientation = (
  orientation?: string,
  opts?: { axis?: string }
): 'horizontal' | 'vertical' => {
  if (orientation) {
    return orientation === 'vertical' ? 'vertical' : 'horizontal';
  }

  if (opts?.axis === 'y') {
    return CAROUSEL_ORIENTATION_MAP.y;
  }

  return CAROUSEL_ORIENTATION_MAP.default;
};

/**
 * Gets the appropriate hover opacity for interactive elements
 *
 * @param isQuadrant - Whether the element is a quadrant/section
 * @param isHovered - Whether the element is currently hovered
 * @returns The opacity value to apply
 *
 * @example
 * ```tsx
 * opacity: getHoverOpacity(isQuadrant, isHovered)
 * // Instead of: opacity: isQuadrant ? (isHovered ? 1 : 0.92) : 1
 * ```
 */
export const getHoverOpacity = (isQuadrant: boolean, isHovered: boolean): number => {
  if (!isQuadrant) return 1;
  return isHovered ? 1 : 0.92;
};

/**
 * Gets the appropriate hover filter effect for interactive elements
 *
 * @param isQuadrant - Whether the element is a quadrant/section
 * @param isHovered - Whether the element is currently hovered
 * @returns The filter CSS value to apply
 *
 * @example
 * ```tsx
 * filter: getHoverFilter(isQuadrant, isHovered)
 * // Instead of: filter: isQuadrant && isHovered ? 'brightness(1.1)' : 'none'
 * ```
 */
export const getHoverFilter = (isQuadrant: boolean, isHovered: boolean): string => {
  return isQuadrant && isHovered ? 'brightness(1.1)' : 'none';
};
