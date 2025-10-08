import { useCallback, useRef } from 'react';
import type { SimilarItem } from '@/services/similarity-search';

interface CacheEntry {
  key: string;
  items: SimilarItem[];
  timestamp: number;
  accessCount: number;
}

interface UseSimilaritySearchCacheOptions {
  maxSize?: number;
  ttlMs?: number;
}

/**
 * LRU cache hook for similarity search results
 * Prevents redundant API calls for recently searched items
 */
export function useSimilaritySearchCache(options: UseSimilaritySearchCacheOptions = {}) {
  const { maxSize = 20, ttlMs = 5 * 60 * 1000 } = options; // 5 minutes default TTL

  // Use ref to maintain cache across renders
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const accessOrderRef = useRef<string[]>([]);

  // Generate cache key from search parameters
  const getCacheKey = useCallback(
    (workspaceId: string, itemId: string, itemType: string): string => {
      return `${workspaceId}:${itemType}:${itemId}`;
    },
    []
  );

  // Check if cache entry is still valid
  const isValidEntry = useCallback(
    (entry: CacheEntry): boolean => {
      return Date.now() - entry.timestamp < ttlMs;
    },
    [ttlMs]
  );

  // Update access order for LRU
  const updateAccessOrder = useCallback((key: string) => {
    const index = accessOrderRef.current.indexOf(key);
    if (index > -1) {
      accessOrderRef.current.splice(index, 1);
    }
    accessOrderRef.current.unshift(key);
  }, []);

  // Evict least recently used entries if cache is full
  const evictIfNeeded = useCallback(() => {
    const cache = cacheRef.current;
    const accessOrder = accessOrderRef.current;

    while (cache.size >= maxSize && accessOrder.length > 0) {
      const oldestKey = accessOrder.pop();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
  }, [maxSize]);

  // Get cached result if available and valid
  const get = useCallback(
    (workspaceId: string, itemId: string, itemType: string): SimilarItem[] | null => {
      const key = getCacheKey(workspaceId, itemId, itemType);
      const entry = cacheRef.current.get(key);

      if (entry && isValidEntry(entry)) {
        // Update access count and order
        entry.accessCount++;
        updateAccessOrder(key);
        return entry.items;
      }

      // Remove invalid entry
      if (entry) {
        cacheRef.current.delete(key);
        const index = accessOrderRef.current.indexOf(key);
        if (index > -1) {
          accessOrderRef.current.splice(index, 1);
        }
      }

      return null;
    },
    [getCacheKey, isValidEntry, updateAccessOrder]
  );

  // Set cache entry
  const set = useCallback(
    (workspaceId: string, itemId: string, itemType: string, items: SimilarItem[]) => {
      const key = getCacheKey(workspaceId, itemId, itemType);

      // Evict old entries if needed
      evictIfNeeded();

      // Add new entry
      cacheRef.current.set(key, {
        key,
        items,
        timestamp: Date.now(),
        accessCount: 1,
      });

      updateAccessOrder(key);
    },
    [getCacheKey, evictIfNeeded, updateAccessOrder]
  );

  // Clear entire cache
  const clear = useCallback(() => {
    cacheRef.current.clear();
    accessOrderRef.current = [];
  }, []);

  // Get cache statistics - use a getter for real-time stats
  const stats = {
    get size() {
      return cacheRef.current.size;
    },
    maxSize,
    get entries() {
      return Array.from(cacheRef.current.values()).map((entry) => ({
        key: entry.key,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        itemCount: entry.items.length,
      }));
    },
  };

  return {
    get,
    set,
    clear,
    stats,
    getCacheKey,
  };
}

/**
 * Debounced similarity search hook
 * Prevents rapid repeated searches for the same item
 */
export function useDebouncedSimilaritySearch(delayMs: number = 300) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingRejectRef = useRef<((reason: Error) => void) | null>(null);

  const debouncedSearch = useCallback(
    async <T>(searchKey: string, searchFn: () => Promise<T>): Promise<T | null> => {
      // Cancel any pending operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reject any pending promise before clearing timeout
      if (pendingRejectRef.current) {
        pendingRejectRef.current(new Error('Search cancelled by new request'));
        pendingRejectRef.current = null;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Create new abort controller for this search
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // If searching for the same item, debounce
      if (lastSearchRef.current === searchKey) {
        return new Promise((resolve, reject) => {
          // Store reject function so we can call it if this promise gets cancelled
          pendingRejectRef.current = reject;

          timeoutRef.current = setTimeout(async () => {
            // Clear the pending reject since we're executing now
            pendingRejectRef.current = null;

            // Check if this operation was aborted
            if (abortController.signal.aborted) {
              reject(new Error('Search cancelled'));
              return;
            }

            try {
              const result = await searchFn();

              // Check again if aborted during async operation
              if (abortController.signal.aborted) {
                reject(new Error('Search cancelled'));
                return;
              }

              resolve(result);
            } catch (error) {
              if (!abortController.signal.aborted) {
                reject(error);
              }
            } finally {
              timeoutRef.current = null;
            }
          }, delayMs);
        });
      }

      // New search, execute immediately
      lastSearchRef.current = searchKey;

      try {
        const result = await searchFn();

        // Check if aborted during execution
        if (abortController.signal.aborted) {
          return null;
        }

        return result;
      } catch (error) {
        if (!abortController.signal.aborted) {
          throw error;
        }
        return null;
      }
    },
    [delayMs]
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    // Reject any pending promise
    if (pendingRejectRef.current) {
      pendingRejectRef.current(new Error('Component unmounted'));
      pendingRejectRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { debouncedSearch, cleanup };
}
