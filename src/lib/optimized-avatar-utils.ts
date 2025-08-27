/**
 * Pure utility functions for OptimizedAvatar component
 * Extracted for easier testing and reusability
 */

export interface AvatarConfig {
  src?: string;
  alt: string;
  size: number;
  fallback?: string;
}

/**
 * Optimize GitHub avatar URLs with size parameters
 * @param src - Original avatar URL
 * @param size - Desired avatar size
 * @returns Optimized URL or original if not a GitHub avatar
 */
export function optimizeAvatarUrl(src: string | undefined, size: number): string | undefined {
  if (!src) return src; // Return empty string as-is, undefined as undefined

  try {
    const url = new URL(src);
    if (url.hostname === 'avatars.githubusercontent.com') {
      // GitHub avatars support size parameter for optimization
      return `${url.origin}${url.pathname}?s=${size}&v=4`;
    }
  } catch {
    // Invalid URL or relative path, return as-is
  }

  return src;
}

/**
 * Generate fallback initials from alt text
 * @param alt - Alt text to generate initials from
 * @param fallback - Optional fallback override
 * @param hasError - Whether image loading failed
 * @returns Fallback text to display
 */
export function generateFallbackText(alt: string, fallback?: string, hasError?: boolean): string {
  if (fallback) return fallback;
  if (hasError) return '?';

  // Generate initials from alt text
  const words = alt.split(' ').filter((word) => word.length > 0);

  if (words.length >= 2) {
    // Take first letter of first two words
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  if (words.length === 1 && words[0].length >= 2) {
    // Take first two letters of single word
    return words[0].slice(0, 2).toUpperCase();
  }

  // Fallback to first two characters of entire string
  return alt.slice(0, 2).toUpperCase();
}

/**
 * Get size classes for avatar based on size prop
 * @param size - Avatar size in pixels
 * @returns Object with Tailwind class names and inline styles
 */
export function getAvatarSizeConfig(size: number): {
  className: string;
  style: { width: string; height: string };
} {
  const sizeMap: Record<number, string> = {
    16: 'h-4 w-4',
    20: 'h-5 w-5',
    24: 'h-6 w-6',
    32: 'h-8 w-8',
    40: 'h-10 w-10',
    48: 'h-12 w-12',
    64: 'h-16 w-16',
    80: 'h-20 w-20',
    96: 'h-24 w-24',
    128: 'h-32 w-32',
  };

  return {
    className: sizeMap[size] || 'h-10 w-10',
    style: {
      width: `${size}px`,
      height: `${size}px`,
    },
  };
}

/**
 * Get text size class based on avatar size
 * @param size - Avatar size in pixels
 * @returns Tailwind text size class
 */
export function getFallbackTextSize(size: number): string {
  if (size <= 24) return 'text-xs';
  if (size <= 32) return 'text-xs';
  if (size >= 80) return 'text-base';
  return 'text-sm';
}

/**
 * Determine if avatar should load immediately
 * @param lazy - Whether lazy loading is enabled
 * @param priority - Whether this is a priority image
 * @returns Whether to load immediately
 */
export function shouldLoadImmediately(lazy: boolean, priority: boolean): boolean {
  return !lazy || priority;
}

/**
 * Get loading attribute for image element
 * @param priority - Whether this is a priority image
 * @returns 'eager' or 'lazy' loading attribute
 */
export function getLoadingAttribute(priority: boolean): 'eager' | 'lazy' {
  return priority ? 'eager' : 'lazy';
}
