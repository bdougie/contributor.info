import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  optimizeAvatarUrl,
  generateFallbackText,
  getAvatarSizeConfig,
  getFallbackTextSize,
  shouldLoadImmediately,
  getLoadingAttribute,
} from '@/lib/optimized-avatar-utils';

export interface OptimizedAvatarSimpleProps {
  src?: string;
  alt: string;
  fallback?: string;
  className?: string;
  size?: 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 | 128;
  lazy?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  // Dependency injection for testing
  renderAvatar?: (props: {
    ref: React.RefObject<HTMLDivElement>;
    className: string;
    style: React.CSSProperties;
    children: React.ReactNode;
  }) => React.ReactNode;
  renderImage?: (props: {
    src: string;
    alt: string;
    loading: 'eager' | 'lazy';
    width: number;
    height: number;
    onLoad: () => void;
    onError: () => void;
    className: string;
  }) => React.ReactNode;
  renderFallback?: (props: {
    className: string;
    children: React.ReactNode;
  }) => React.ReactNode;
}

/**
 * Simplified OptimizedAvatar component with injected dependencies
 * This version is designed for easy testing without mocking external libraries
 */
export function OptimizedAvatarSimple({
  src,
  alt,
  fallback,
  className,
  size = 40,
  lazy = true,
  priority = false,
  onLoad,
  onError,
  renderAvatar,
  renderImage,
  renderFallback,
}: OptimizedAvatarSimpleProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(shouldLoadImmediately(lazy, priority));
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Optimize the avatar URL
  const optimizedSrc = optimizeAvatarUrl(src, size);

  // Get size configuration
  const sizeConfig = getAvatarSizeConfig(size);

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

  // Generate fallback text
  const fallbackText = generateFallbackText(alt, fallback, error);
  const fallbackTextSize = getFallbackTextSize(size);

  // Default renderers (for production use)
  const avatarRenderer = renderAvatar || ((props) => (
    <div ref={props.ref} className={props.className} style={props.style}>
      {props.children}
    </div>
  ));

  const imageRenderer = renderImage || ((props) => (
    <img
      src={props.src}
      alt={props.alt}
      loading={props.loading}
      width={props.width}
      height={props.height}
      onLoad={props.onLoad}
      onError={props.onError}
      className={props.className}
    />
  ));

  const fallbackRenderer = renderFallback || ((props) => (
    <div className={props.className}>
      {props.children}
    </div>
  ));

  return avatarRenderer({
    ref: imgRef,
    className: cn(
      'relative flex shrink-0 overflow-hidden rounded-full',
      sizeConfig.className,
      className
    ),
    style: sizeConfig.style,
    children: (
      <>
        {shouldLoad && optimizedSrc && !error && imageRenderer({
          src: optimizedSrc,
          alt,
          loading: getLoadingAttribute(priority),
          width: size,
          height: size,
          onLoad: handleLoad,
          onError: handleError,
          className: cn(
            'aspect-square h-full w-full transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0'
          ),
        })}
        {fallbackRenderer({
          className: cn(
            'flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium',
            fallbackTextSize,
            (!shouldLoad || error || !isLoaded) ? 'opacity-100' : 'opacity-0'
          ),
          children: fallbackText,
        })}
      </>
    ),
  });
}