import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIntersectionLoaderOptions extends IntersectionObserverInit {
  /**
   * Whether to load immediately without waiting for intersection
   * @default false
   */
  loadImmediately?: boolean;
  
  /**
   * Whether to continue observing after first intersection
   * @default false
   */
  continuous?: boolean;
  
  /**
   * Delay in ms before triggering load after intersection
   * @default 0
   */
  delay?: number;
}

interface UseIntersectionLoaderResult<T> {
  /**
   * Ref to attach to the element that should trigger loading
   */
  ref: React.RefObject<HTMLDivElement>;
  
  /**
   * The loaded data
   */
  data: T | null;
  
  /**
   * Loading state
   */
  isLoading: boolean;
  
  /**
   * Error state
   */
  error: Error | null;
  
  /**
   * Whether the element is currently intersecting
   */
  isIntersecting: boolean;
  
  /**
   * Manually trigger loading
   */
  load: () => Promise<void>;
  
  /**
   * Reset the loader state
   */
  reset: () => void;
}

/**
 * Hook for lazy loading data when an element enters the viewport
 * Perfect for implementing progressive loading of below-the-fold content
 * 
 * @example
 * ```tsx
 * const { ref, data, isLoading } = useIntersectionLoader(
 *   () => fetchContributorData(repo),
 *   { rootMargin: '100px' } // Start loading 100px before element is visible
 * );
 * 
 * return (
 *   <div ref={ref}>
 *     {isLoading && <Skeleton />}
 *     {data && <ContributorList data={data} />}
 *   </div>
 * );
 * ```
 */
export function useIntersectionLoader<T>(
  loadFn: () => Promise<T>,
  options: UseIntersectionLoaderOptions = {}
): UseIntersectionLoaderResult<T> {
  const {
    loadImmediately = false,
    continuous = false,
    delay = 0,
    root = null,
    rootMargin = '0px',
    threshold = 0,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);

  const load = useCallback(async () => {
    if (loadingRef.current || (hasLoaded && !continuous)) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await loadFn();
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setData(result);
        setHasLoaded(true);
      }
    } catch (err) {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to load data'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      loadingRef.current = false;
    }
  }, [loadFn, hasLoaded, continuous]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setHasLoaded(false);
    setIsIntersecting(false);
    loadingRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (loadImmediately && !hasLoaded) {
      load();
    }
  }, [loadImmediately, hasLoaded, load]);

  useEffect(() => {
    if (!ref.current || loadImmediately) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const intersecting = entry.isIntersecting;
        setIsIntersecting(intersecting);
        
        if (intersecting && (!hasLoaded || continuous)) {
          if (delay > 0) {
            timeoutRef.current = setTimeout(() => {
              load();
            }, delay);
          } else {
            load();
          }
        } else if (!intersecting && timeoutRef.current) {
          // Cancel loading if element leaves viewport before delay
          clearTimeout(timeoutRef.current);
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [root, rootMargin, threshold, delay, hasLoaded, continuous, load, loadImmediately]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    ref,
    data,
    isLoading,
    error,
    isIntersecting,
    load,
    reset,
  };
}

/**
 * Simple hook for tracking element visibility without data loading
 * Useful for analytics or triggering animations
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): {
  ref: React.RefObject<HTMLDivElement>;
  isIntersecting: boolean;
  hasIntersected: boolean;
} {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const intersecting = entry.isIntersecting;
        setIsIntersecting(intersecting);
        
        if (intersecting) {
          setHasIntersected(true);
        }
      },
      options
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [options.root, options.rootMargin, options.threshold]);

  return { ref, isIntersecting, hasIntersected };
}