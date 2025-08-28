/**
 * Image optimization utilities for better performance
 */

/**
 * Optimizes GitHub avatar URLs by adding size parameter
 * @param avatarUrl - The original GitHub avatar URL
 * @param size - The desired size in pixels
 * @returns Optimized avatar URL
 */
export function optimizeGitHubAvatar(avatarUrl: string, size: number): string {
  if (!avatarUrl) return '';

  // Check if URL already has parameters
  const hasParams = avatarUrl.includes('?');
  const separator = hasParams ? '&' : '?';

  return `${avatarUrl}${separator}s=${size}`;
}

/**
 * Gets the appropriate avatar size based on display size
 * @param displaySize - The CSS display size (e.g., 'h-8 w-8')
 * @returns Optimized pixel size for the avatar
 */
export function getOptimalAvatarSize(displaySize: string): number {
  // Map common Tailwind sizes to optimal pixel sizes
  const sizeMap: Record<string, number> = {
    'h-8 w-8': 64,
    'h-10 w-10': 80,
    'h-12 w-12': 96,
    'h-16 w-16': 128,
  };

  return sizeMap[displaySize] || 80; // Default to 80px
}

/**
 * Determines if an image should be loaded eagerly based on priority
 * NOTE: Preserves original behavior from optimized-image.tsx: priority ? 'eager' : 'lazy'
 * @param priority - High priority images should be eager
 * @param lazy - Unused parameter (kept for API compatibility)
 * @returns Loading strategy
 */
export function getImageLoadingStrategy(
  priority: boolean = false,
  lazy?: boolean
): 'eager' | 'lazy' {
  // Preserve original behavior: priority ? 'eager' : 'lazy'
  // The lazy parameter is unused but kept for API compatibility
  void lazy; // Mark as intentionally unused
  return priority ? 'eager' : 'lazy';
}

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
 * This consolidates the image optimization logic that was previously scattered
 *
 * @param originalSrc - The original image source URL
 * @param width - Optional width for optimization
 * @param height - Optional height for optimization
 * @returns Optimized image URLs with WebP and fallback variants
 *
 * @example
 * ```tsx
 * const imageUrls = getOptimizedImageUrls(src, width, height);
 * ```
 */
export function getOptimizedImageUrls(originalSrc: string, width?: number, height?: number) {
  // Check if it's a relative path or local image first
  const isRelativePath =
    !originalSrc.startsWith('http://') &&
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
}

/**
 * Creates a picture element with WebP fallback for static images
 * @param imagePath - Path to the image
 * @param alt - Alt text
 * @param className - CSS classes
 * @returns Picture element JSX
 */
export function createOptimizedImage(imagePath: string, alt: string, className?: string) {
  const webpPath = imagePath.replace(/\.(png|jpg|jpeg)$/, '.webp');

  return {
    webpSrc: webpPath,
    fallbackSrc: imagePath,
    alt,
    className,
  };
}
