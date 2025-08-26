import { useEffect, useRef, useState, RefObject, useCallback } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
  delay?: number;
}

interface UseIntersectionObserverReturn {
  ref: RefObject<HTMLDivElement>;
  isIntersecting: boolean;
  hasIntersected: boolean;
}

/**
 * Hook for lazy loading components with Intersection Observer
 * Optimized for Core Web Vitals performance
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverReturn {
  const {
    threshold = 0,
    root = null,
    rootMargin = '50px',
    triggerOnce = true,
    delay = 0,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasIntersectedRef = useRef(false);

  // Use callback to memoize the observer callback
  const handleIntersection = useCallback<IntersectionObserverCallback>(
    (entries) => {
      entries.forEach((entry) => {
        const shouldLoad = entry.isIntersecting;

        if (shouldLoad && delay > 0) {
          // Apply delay if specified (useful for staggered loading)
          timeoutRef.current = setTimeout(() => {
            setIsIntersecting(true);
            if (!hasIntersectedRef.current) {
              hasIntersectedRef.current = true;
              setHasIntersected(true);
            }
          }, delay);
        } else if (shouldLoad) {
          setIsIntersecting(true);
          if (!hasIntersectedRef.current) {
            hasIntersectedRef.current = true;
            setHasIntersected(true);
          }
        } else if (!triggerOnce) {
          // Only update if not triggerOnce mode
          setIsIntersecting(false);
        }

        // Disconnect after first intersection if triggerOnce
        if (shouldLoad && triggerOnce && observerRef.current) {
          observerRef.current.disconnect();
        }
      });
    },
    [triggerOnce, delay],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If already intersected and triggerOnce is true, don't observe again
    if (hasIntersectedRef.current && triggerOnce) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold,
      root,
      rootMargin,
    });

    observerRef.current.observe(element);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, root, rootMargin, triggerOnce, handleIntersection]);

  return { ref, isIntersecting, hasIntersected };
}

/**
 * Hook for lazy loading data when component is visible
 */
export function useLazyLoadData<T>(
  loadFn: () => Promise<T>,
  options: UseIntersectionObserverOptions = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { ref, hasIntersected } = useIntersectionObserver(options);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (hasIntersected && !_data && !loadingRef.current) {
      loadingRef.current = true;
      setLoading(true);

      loadFn()
        .then(setData)
        .catch(setError)
        .finally(() => {
          setLoading(false);
        });
    }
  }, [hasIntersected, data, loadFn]);

  return { ref, data, loading, _error, hasIntersected };
}

/**
 * Hook for progressively loading list items
 * Useful for large contributor lists
 */
export function useProgressiveList<T>(
  items: T[],
  initialCount: number = 10,
  incrementCount: number = 20,
) {
  const [displayCount, setDisplayCount] = useState(initialCount);
  const { ref, hasIntersected } = useIntersectionObserver({
    triggerOnce: false,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (hasIntersected && displayCount < items.length) {
      // Load more items
      setDisplayCount((prev) => Math.min(prev + incrementCount, items.length));
    }
  }, [hasIntersected, displayCount, items.length, incrementCount]);

  const visibleItems = items.slice(0, displayCount);
  const hasMore = displayCount < items.length;

  return {
    visibleItems,
    loadMoreRef: ref,
    hasMore,
    totalCount: items.length,
    displayedCount: displayCount,
  };
}
