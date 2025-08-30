import { useState, useRef, useEffect } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

interface OrganizationAvatarProps {
  src?: string;
  alt: string;
  className?: string;
  size?: 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 | 128;
  lazy?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Organization Avatar component with square design and rounded corners
 * Following GitHub's design language for organization/repository avatars
 *
 * Features:
 * - Square aspect ratio with rounded corners
 * - Lazy loading with intersection observer
 * - Optimized GitHub avatar URLs with size parameters
 * - Proper fallback handling
 * - Aspect ratio preservation to prevent CLS
 * - Priority loading for above-the-fold avatars
 */
export function OrganizationAvatar({
  src,
  alt,
  className,
  size = 40,
  lazy = true,
  priority = false,
  onLoad,
  onError,
}: OrganizationAvatarProps) {
  // Use plant sprite as default placeholder for organizations
  const placeholderSrc = '/org-placeholder.png';
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy || priority);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLSpanElement>(null);

  // Generate optimized organization avatar URLs with WebP support
  const generateAvatarUrls = (originalSrc?: string) => {
    if (!originalSrc) return { webp: undefined, fallback: undefined };

    try {
      const url = new URL(originalSrc);
      if (url.hostname === 'avatars.githubusercontent.com') {
        // GitHub avatars don't support WebP directly, but we optimize the size
        const optimizedUrl = `${url.origin}${url.pathname}?s=${size}&v=4`;
        return {
          webp: optimizedUrl,
          fallback: optimizedUrl,
        };
      }
    } catch {
      // Invalid URL, fallback to original src
    }

    // For other images, try to generate WebP version
    return {
      webp: originalSrc.includes('?')
        ? `${originalSrc}&format=webp&quality=80`
        : `${originalSrc}?format=webp&quality=80`,
      fallback: originalSrc,
    };
  };

  const avatarUrls = generateAvatarUrls(src);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || shouldLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [lazy, priority, shouldLoad]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  return (
    <AvatarPrimitive.Root
      ref={imgRef}
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-md', // rounded-md for square with rounded corners
        // Set explicit dimensions to prevent CLS
        size === 16 && 'h-4 w-4',
        size === 20 && 'h-5 w-5',
        size === 24 && 'h-6 w-6',
        size === 32 && 'h-8 w-8',
        size === 40 && 'h-10 w-10',
        size === 48 && 'h-12 w-12',
        size === 64 && 'h-16 w-16',
        size === 80 && 'h-20 w-20',
        size === 96 && 'h-24 w-24',
        size === 128 && 'h-32 w-32',
        className
      )}
      style={{
        // Prevent layout shift by setting explicit dimensions
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {shouldLoad && (avatarUrls.fallback || placeholderSrc) && !error && (
        <AvatarPrimitive.Image
          src={avatarUrls.fallback || placeholderSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          width={size}
          height={size}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'aspect-square h-full w-full object-cover transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0',
            // Add pixelated style for the plant placeholder
            (!avatarUrls.fallback || src === placeholderSrc) && 'image-rendering-pixelated'
          )}
          style={{
            imageRendering: !avatarUrls.fallback || src === placeholderSrc ? 'pixelated' : 'auto',
          }}
        />
      )}
      <AvatarPrimitive.Fallback
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md',
          // Show fallback when loading or on error
          !shouldLoad || error || !isLoaded ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Use plant image as fallback */}
        <img
          src={placeholderSrc}
          alt={alt}
          className="aspect-square h-full w-full object-cover rounded-md"
          style={{ imageRendering: 'pixelated' }}
        />
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
