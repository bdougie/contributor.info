/**
 * Component State Management Utilities
 * 
 * Utilities for handling complex component state patterns that typically
 * require nested ternary expressions. These utilities provide cleaner,
 * more maintainable ways to handle multi-state component logic.
 */

/**
 * Gets the appropriate loading attribute for image elements based on priority and lazy loading settings
 * 
 * @param priority - Whether the image should load with high priority
 * @param lazy - Whether the image should use lazy loading
 * @returns The loading attribute value for img elements
 * 
 * @example
 * ```tsx
 * <img loading={getImageLoadingStrategy(priority, lazy)} />
 * // Instead of: loading={priority ? 'eager' : lazy ? 'lazy' : 'eager'}
 * ```
 */
export const getImageLoadingStrategy = (priority?: boolean, lazy?: boolean): 'eager' | 'lazy' => {
  if (priority) return 'eager';
  if (lazy) return 'lazy';
  return 'eager';
};

/**
 * Configuration object for image URL generation based on type and properties
 */
export const IMAGE_URL_GENERATORS = {
  /**
   * Generates optimized URLs for local/static images with vite-imagetools
   */
  local: (originalSrc: string, width?: number, height?: number) => ({
    webp: `${originalSrc}?format=webp&quality=80${width ? `&w=${width}` : ''}${height ? `&h=${height}` : ''}`,
    fallback: originalSrc,
    isGitHubAvatar: false,
  }),

  /**
   * Generates optimized URLs for GitHub avatars
   */
  githubAvatar: (originalSrc: string, width?: number, height?: number) => {
    const url = new URL(originalSrc);
    const size = width || height || 80;
    return {
      webp: `${url.origin}${url.pathname}?s=${size}&v=4`,
      fallback: `${url.origin}${url.pathname}?s=${size}&v=4`,
      isGitHubAvatar: true,
    };
  },

  /**
   * Fallback for external images
   */
  external: (originalSrc: string) => ({
    webp: originalSrc,
    fallback: originalSrc,
    isGitHubAvatar: false,
  }),
} as const;

/**
 * Determines the appropriate image URL generator and returns optimized URLs
 * 
 * @param originalSrc - The original image source URL
 * @param width - Optional width for optimization
 * @param height - Optional height for optimization
 * @returns Optimized image URLs with WebP and fallback variants
 * 
 * @example
 * ```tsx
 * const imageUrls = getOptimizedImageUrls(src, width, height);
 * // Instead of complex nested ternary logic for URL generation
 * ```
 */
export const getOptimizedImageUrls = (originalSrc: string, width?: number, height?: number) => {
  // Check if it's a relative path or local image first
  const isRelativePath = !originalSrc.startsWith('http://') && 
                        !originalSrc.startsWith('https://') && 
                        !originalSrc.startsWith('//');

  if (isRelativePath) {
    return IMAGE_URL_GENERATORS.local(originalSrc, width, height);
  }

  try {
    const url = new URL(originalSrc);

    // Handle GitHub avatars specially
    if (url.hostname === 'avatars.githubusercontent.com') {
      return IMAGE_URL_GENERATORS.githubAvatar(originalSrc, width, height);
    }

    // For other external images
    return IMAGE_URL_GENERATORS.external(originalSrc);
  } catch {
    // Fallback for any edge cases
    return IMAGE_URL_GENERATORS.external(originalSrc);
  }
};

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
export const getFormErrorContent = (error?: { message?: string }, children?: React.ReactNode): React.ReactNode => {
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