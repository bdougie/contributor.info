/**
 * Advanced caching service for LLM responses
 * Supports both memory and localStorage with smart invalidation
 */

import type { LLMInsight } from './llm-service';

export interface CacheConfig {
  enableMemoryCache: boolean;
  enablePersistentCache: boolean;
  defaultExpiryMinutes: number;
  maxCacheSize: number;
}

export interface CacheEntry {
  insight: LLMInsight;
  key: string;
  createdAt: Date;
  expiresAt: Date;
  dataHash: string;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheStats {
  memorySize: number;
  persistentSize: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

class CacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enableMemoryCache: true,
      enablePersistentCache: true,
      defaultExpiryMinutes: 60,
      maxCacheSize: 100,
      ...config,
    };

    // Clean up expired entries on initialization
    this.cleanup();
  }

  /**
   * Get cached insight if available and not expired
   */
  get(key: string, _dataHash: string): LLMInsight | null {
    // Try memory cache first
    if (this.config.enableMemoryCache) {
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isValidEntry(memoryEntry, _dataHash)) {
        this.updateAccessStats(memoryEntry);
        this.stats.hits++;
        return memoryEntry.insight;
      }
    }

    // Try persistent cache
    if (this.config.enablePersistentCache) {
      const persistentEntry = this.getPersistentEntry(key);
      if (persistentEntry && this.isValidEntry(persistentEntry, _dataHash)) {
        // Move to memory cache for faster future access
        if (this.config.enableMemoryCache) {
          this.memoryCache.set(key, persistentEntry);
        }
        this.updateAccessStats(persistentEntry);
        this.stats.hits++;
        return persistentEntry.insight;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store insight in cache with smart expiry
   */
  set(key: string, insight: LLMInsight, _dataHash: string, customExpiryMinutes?: number): void {
    const now = new Date();
    const expiryMinutes = customExpiryMinutes || this.getSmartExpiry(insight);
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    const entry: CacheEntry = {
      insight,
      key,
      createdAt: now,
      expiresAt,
      dataHash,
      accessCount: 1,
      lastAccessed: now,
    };

    // Store in memory cache
    if (this.config.enableMemoryCache) {
      this.memoryCache.set(key, entry);
      this.enforceMemoryCacheSize();
    }

    // Store in persistent cache
    if (this.config.enablePersistentCache) {
      this.setPersistentEntry(key, entry);
    }
  }

  /**
   * Invalidate cache entries for a specific repository
   */
  invalidateRepository(owner: string, repo: string): void {
    const repoPrefix = `${owner}/${repo}`;

    // Invalidate memory cache
    for (const [key] of this.memoryCache) {
      if (key.includes(repoPrefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate persistent cache
    if (this.config.enablePersistentCache) {
      this.invalidatePersistentByPrefix(repoPrefix);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    if (this.config.enablePersistentCache) {
      this.clearPersistentCache();
    }
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryEntries = Array.from(this.memoryCache.values());
    const persistentKeys = this.getPersistentKeys();

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    if (memoryEntries.length > 0) {
      const dates = memoryEntries.map((e) => e.createdAt);
      oldestEntry = new Date(Math.min(...dates.map((d) => d.getTime())));
      newestEntry = new Date(Math.max(...dates.map((d) => d.getTime())));
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      memorySize: this.memoryCache.size,
      persistentSize: persistentKeys.length,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = new Date();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }

    // Clean persistent cache
    if (this.config.enablePersistentCache) {
      this.cleanupPersistentCache();
    }
  }

  /**
   * Check if cache entry is valid (not expired and _data hasn't changed)
   */
  private isValidEntry(entry: CacheEntry, currentDataHash: string): boolean {
    const now = new Date();
    return now <= entry.expiresAt && entry.dataHash === currentDataHash;
  }

  /**
   * Update access statistics for cache entry
   */
  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = new Date();
  }

  /**
   * Determine smart expiry time based on insight type and confidence
   */
  private getSmartExpiry(insight: LLMInsight): number {
    let baseMinutes = this.config.defaultExpiryMinutes;

    // Adjust based on insight type
    switch (insight.type) {
      case 'health':
        baseMinutes = 90; // Health insights change more slowly
        break;
      case 'recommendation':
        baseMinutes = 120; // Recommendations have longer relevance
        break;
      case 'pattern':
        baseMinutes = 180; // Pattern analysis is most stable
        break;
      case 'trend':
        baseMinutes = 45; // Trends change more frequently
        break;
    }

    // Adjust based on confidence (higher confidence = longer cache)
    const confidenceMultiplier = 0.5 + insight.confidence * 0.5;
    baseMinutes *= confidenceMultiplier;

    return Math.round(baseMinutes);
  }

  /**
   * Enforce memory cache size limit using LRU eviction
   */
  private enforceMemoryCacheSize(): void {
    if (this.memoryCache.size <= this.config.maxCacheSize) {
      return;
    }

    // Sort by last accessed time (LRU)
    const entries = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastAccessed.getTime() - b.entry.lastAccessed.getTime());

    // Remove oldest entries
    const toRemove = this.memoryCache.size - this.config.maxCacheSize;
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i].key);
    }
  }

  /**
   * Get entry from localStorage
   */
  private getPersistentEntry(key: string): CacheEntry | null {
    try {
      const cached = localStorage.getItem(`llm_cache_${key}`);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt),
        lastAccessed: new Date(parsed.lastAccessed),
      };
    } catch (error) {
      console.warn('Failed to parse cached entry:', error);
      localStorage.removeItem(`llm_cache_${key}`);
      return null;
    }
  }

  /**
   * Store entry in localStorage
   */
  private setPersistentEntry(key: string, entry: CacheEntry): void {
    try {
      localStorage.setItem(`llm_cache_${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to store cache entry:', error);
      // Clear some space and try again
      this.cleanupPersistentCache();
      try {
        localStorage.setItem(`llm_cache_${key}`, JSON.stringify(entry));
      } catch (retryError) {
        console.error('Failed to store cache entry after cleanup:', retryError);
      }
    }
  }

  /**
   * Get all persistent cache keys
   */
  private getPersistentKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('llm_cache_')) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Invalidate persistent cache entries by prefix
   */
  private invalidatePersistentByPrefix(prefix: string): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('llm_cache_') && key.includes(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Clear all persistent cache
   */
  private clearPersistentCache(): void {
    const keysToRemove = this.getPersistentKeys();
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Clean up expired persistent cache entries
   */
  private cleanupPersistentCache(): void {
    const now = new Date();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('llm_cache_')) {
        try {
          const entry = this.getPersistentEntry(key.replace('llm_cache_', ''));
          if (entry && now > entry.expiresAt) {
            keysToRemove.push(key);
          }
        } catch (error) {
          // Remove corrupted entries
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

// Export singleton instance
export const cacheService = new CacheService();
