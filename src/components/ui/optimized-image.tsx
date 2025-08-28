import { useState, useRef, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { getImageLoadingStrategy, getOptimizedImageUrls } from '@/lib/utils/image-optimization';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  lazy?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
}

/**
 * OptimizedImage component with WebP support, fallbacks, and lazy loading
 *
 * Features:
 * - WebP format with PNG/JPG fallbacks using <picture> element
 * - Lazy loading with intersection observer
 * - GitHub avatar URL optimization
 * - Proper aspect ratio preservation to prevent CLS
 * - Priority loading for above-the-fold images
 * - Error handling with fallback images
 */
export const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  (
    {
      src,
      alt,
      width,
      height,
      sizes,
      priority = false,
      lazy = true,
      className,
      onLoad,
      onError,
      fallbackSrc,
      ...props
    },
    ref
  ) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [shouldLoad, setShouldLoad] = useState(!lazy || priority);
    const [error, setError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const imageUrls = getOptimizedImageUrls(src, width, height);

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

    // Generate skeleton placeholder based on dimensions
    const skeletonStyle = {
      width: width ? `${width}px` : '100%',
      height: height ? `${height}px` : '100%',
      aspectRatio: width && height ? `${width}/${height}` : undefined,
    };

    if (!shouldLoad) {
      return (
        <div
          ref={imgRef}
          className={cn('bg-muted animate-pulse rounded', className)}
          style={skeletonStyle}
          aria-label={`Loading ${alt}`}
        />
      );
    }

    if (error && fallbackSrc) {
      return (
        <img
          ref={ref}
          src={fallbackSrc}
          alt={alt}
          width={width}
          height={height}
          loading={getImageLoadingStrategy(priority, lazy)}
          className={cn('transition-opacity duration-200', className)}
          onLoad={handleLoad}
          {...props}
        />
      );
    }

    // For GitHub avatars or when WebP support is uncertain, use picture element
    if (!imageUrls.isGitHubAvatar && imageUrls.webp !== imageUrls.fallback) {
      return (
        <picture className={cn('block', className)}>
          <source srcSet={imageUrls.webp} type="image/webp" sizes={sizes} />
          <source srcSet={imageUrls.fallback} type="image/jpeg" sizes={sizes} />
          <img
            ref={ref}
            src={imageUrls.fallback}
            alt={alt}
            width={width}
            height={height}
            loading={getImageLoadingStrategy(priority, lazy)}
            className={cn(
              'transition-opacity duration-200',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={handleLoad}
            onError={handleError}
            {...props}
          />
        </picture>
      );
    }

    // Simple img element for GitHub avatars and other cases
    return (
      <img
        ref={ref}
        src={imageUrls.fallback}
        alt={alt}
        width={width}
        height={height}
        loading={getImageLoadingStrategy(priority, lazy)}
        sizes={sizes}
        className={cn(
          'transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';
