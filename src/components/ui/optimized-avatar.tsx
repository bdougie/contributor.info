import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface OptimizedAvatarProps {
  src?: string;
  alt: string;
  fallback?: string;
  className?: string;
  size?: 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 | 128;
  lazy?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized Avatar component with lazy loading, proper sizing, and GitHub avatar optimization
 * 
 * Features:
 * - Lazy loading with intersection observer
 * - Optimized GitHub avatar URLs with size parameters
 * - Proper fallback handling
 * - Aspect ratio preservation to prevent CLS
 * - Priority loading for above-the-fold avatars
 */
export function OptimizedAvatar({
  src,
  alt,
  fallback,
  className,
  size = 40,
  lazy = true,
  priority = false,
  onLoad,
  onError,
}: OptimizedAvatarProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy || priority);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Optimize GitHub avatar URLs with size parameters
  const optimizedSrc = src && src.includes('avatars.githubusercontent.com') 
    ? `${src.split('?')[0]}?s=${size}&v=4`
    : src;

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

  // Generate fallback initials from alt text
  const generateFallback = () => {
    if (fallback) return fallback;
    if (error) return '?';
    
    const words = alt.split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return alt.slice(0, 2).toUpperCase();
  };

  return (
    <Avatar 
      ref={imgRef}
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
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
      {shouldLoad && optimizedSrc && !error && (
        <AvatarImage
          src={optimizedSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          width={size}
          height={size}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'aspect-square h-full w-full transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
      <AvatarFallback 
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium',
          // Adjust text size based on avatar size
          size <= 24 && 'text-xs',
          size <= 32 && 'text-xs',
          size >= 80 && 'text-base',
          // Show fallback when loading or on error
          (!shouldLoad || error || !isLoaded) ? 'opacity-100' : 'opacity-0'
        )}
      >
        {generateFallback()}
      </AvatarFallback>
    </Avatar>
  );
}