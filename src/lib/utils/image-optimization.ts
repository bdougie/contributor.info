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
 * Determines if an image should be loaded eagerly based on position
 * @param isAboveFold - Whether the image is above the fold
 * @param priority - High priority images should be eager
 * @returns Loading strategy
 */
export function getImageLoadingStrategy(
  isAboveFold: boolean = false,
  priority: boolean = false
): 'eager' | 'lazy' {
  return isAboveFold || priority ? 'eager' : 'lazy';
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
