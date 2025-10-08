import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useSimilaritySearchCache,
  useDebouncedSimilaritySearch,
} from '@/hooks/use-similarity-search-cache';
import type { SimilarItem } from '@/services/similarity-search';

describe('Similarity Search Performance Optimizations', () => {
  describe('useSimilaritySearchCache', () => {
    const mockSimilarItems: SimilarItem[] = [
      {
        id: '1',
        type: 'pr',
        number: 123,
        title: 'Test PR',
        repository: 'org/repo',
        url: 'https://github.com/org/repo/pull/123',
        similarity: 0.95,
        status: 'open',
      },
      {
        id: '2',
        type: 'issue',
        number: 456,
        title: 'Test Issue',
        repository: 'org/repo',
        url: 'https://github.com/org/repo/issues/456',
        similarity: 0.89,
        status: 'closed',
      },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should cache and retrieve similarity search results', () => {
      const { result } = renderHook(() => useSimilaritySearchCache({ maxSize: 5, ttlMs: 1000 }));

      // Store items in cache
      act(() => {
        result.current.set('workspace-1', 'item-1', 'pr', mockSimilarItems);
      });

      // Retrieve from cache
      const cached = result.current.get('workspace-1', 'item-1', 'pr');
      expect(cached).toEqual(mockSimilarItems);
    });

    it('should return null for cache miss', () => {
      const { result } = renderHook(() => useSimilaritySearchCache());

      const cached = result.current.get('workspace-1', 'item-not-exists', 'pr');
      expect(cached).toBeNull();
    });

    it('should evict oldest entries when cache is full', () => {
      const { result } = renderHook(() => useSimilaritySearchCache({ maxSize: 2 }));

      // Fill cache beyond max size
      act(() => {
        result.current.set('workspace-1', 'item-1', 'pr', mockSimilarItems);
        result.current.set('workspace-1', 'item-2', 'issue', mockSimilarItems);
        result.current.set('workspace-1', 'item-3', 'discussion', mockSimilarItems);
      });

      // First item should be evicted
      expect(result.current.get('workspace-1', 'item-1', 'pr')).toBeNull();
      // Last two should remain
      expect(result.current.get('workspace-1', 'item-2', 'issue')).toEqual(mockSimilarItems);
      expect(result.current.get('workspace-1', 'item-3', 'discussion')).toEqual(mockSimilarItems);
    });

    it('should respect TTL and invalidate expired entries', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useSimilaritySearchCache({ ttlMs: 100 }));

      act(() => {
        result.current.set('workspace-1', 'item-1', 'pr', mockSimilarItems);
      });

      // Should be in cache initially
      expect(result.current.get('workspace-1', 'item-1', 'pr')).toEqual(mockSimilarItems);

      // Advance time to expire TTL
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Should be expired and return null
      expect(result.current.get('workspace-1', 'item-1', 'pr')).toBeNull();
      vi.useRealTimers();
    });

    it('should update access order for LRU eviction', () => {
      const { result } = renderHook(() => useSimilaritySearchCache({ maxSize: 2 }));

      act(() => {
        result.current.set('workspace-1', 'item-1', 'pr', mockSimilarItems);
        result.current.set('workspace-1', 'item-2', 'issue', mockSimilarItems);
      });

      // Access item-1 to make it more recently used
      act(() => {
        result.current.get('workspace-1', 'item-1', 'pr');
      });

      // Add a third item
      act(() => {
        result.current.set('workspace-1', 'item-3', 'discussion', mockSimilarItems);
      });

      // item-2 should be evicted (least recently used)
      expect(result.current.get('workspace-1', 'item-2', 'issue')).toBeNull();
      // item-1 and item-3 should remain
      expect(result.current.get('workspace-1', 'item-1', 'pr')).toEqual(mockSimilarItems);
      expect(result.current.get('workspace-1', 'item-3', 'discussion')).toEqual(mockSimilarItems);
    });

    it('should provide cache statistics', () => {
      const { result } = renderHook(() => useSimilaritySearchCache({ maxSize: 10 }));

      act(() => {
        result.current.set('workspace-1', 'item-1', 'pr', mockSimilarItems);
        result.current.set('workspace-1', 'item-2', 'issue', mockSimilarItems);
      });

      const stats = result.current.stats;
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].itemCount).toBe(2); // Two similar items in each cache entry
    });

    it('should clear entire cache', () => {
      const { result } = renderHook(() => useSimilaritySearchCache());

      act(() => {
        result.current.set('workspace-1', 'item-1', 'pr', mockSimilarItems);
        result.current.set('workspace-1', 'item-2', 'issue', mockSimilarItems);
      });

      expect(result.current.stats.size).toBe(2);

      act(() => {
        result.current.clear();
      });

      expect(result.current.stats.size).toBe(0);
      expect(result.current.get('workspace-1', 'item-1', 'pr')).toBeNull();
    });
  });

  describe('useDebouncedSimilaritySearch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should debounce repeated searches for the same key', () => {
      const { result } = renderHook(() => useDebouncedSimilaritySearch(300));
      const searchFn1 = vi.fn().mockResolvedValue('search result 1');
      const searchFn2 = vi.fn().mockResolvedValue('search result 2');
      const searchFn3 = vi.fn().mockResolvedValue('search result 3');

      // First search for a key executes immediately (returns promise)
      result.current.debouncedSearch('key-1', searchFn1);
      expect(searchFn1).toHaveBeenCalledTimes(1);

      // Subsequent searches for the same key are debounced
      result.current.debouncedSearch('key-1', searchFn2);
      result.current.debouncedSearch('key-1', searchFn3);

      // Should not have been called yet (debounced)
      expect(searchFn2).not.toHaveBeenCalled();
      expect(searchFn3).not.toHaveBeenCalled();

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Only the last debounced function should be called
      expect(searchFn2).not.toHaveBeenCalled();
      expect(searchFn3).toHaveBeenCalledTimes(1);
    });

    it('should execute immediately for different search keys', () => {
      const { result } = renderHook(() => useDebouncedSimilaritySearch(300));
      const searchFn1 = vi.fn().mockResolvedValue('result 1');
      const searchFn2 = vi.fn().mockResolvedValue('result 2');

      // Trigger searches for different keys
      result.current.debouncedSearch('key-1', searchFn1);
      result.current.debouncedSearch('key-2', searchFn2);

      // Both should execute immediately since keys are different
      expect(searchFn1).toHaveBeenCalledTimes(1);
      expect(searchFn2).toHaveBeenCalledTimes(1);
    });

    it('should cleanup timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useDebouncedSimilaritySearch(300));
      const searchFn = vi.fn().mockResolvedValue('result');

      // Start a debounced search for the same key (to trigger debounce)
      result.current.debouncedSearch('key-1', () => Promise.resolve('first'));
      result.current.debouncedSearch('key-1', searchFn); // This should be debounced

      // Clean up before timeout
      act(() => {
        result.current.cleanup();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Search function should not have been called due to cleanup
      expect(searchFn).not.toHaveBeenCalled();

      unmount();
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  });
});
