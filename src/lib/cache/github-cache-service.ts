/**
 * Enhanced GitHub API caching layer for improved performance
 * Builds on existing rate limit management and cache infrastructure
 */

import { RateLimitInfo } from '@/lib/github-rate-limit';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  lastModified?: string;
  rateLimitInfo?: RateLimitInfo;
}

export interface CacheConfig {
  defaultTtl: number;
  maxSize: number;
  compressionEnabled: boolean;
  persistenceEnabled: boolean;
  namespace: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
}

/**
 * Multi-tier cache for GitHub API responses
 * - Tier 1: In-memory cache (fastest)
 * - Tier 2: LocalStorage cache (persistent)
 * - Tier 3: IndexedDB cache (large data)
 */
export class GitHubCacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      compressionEnabled: true,
      persistenceEnabled: true,
      namespace: 'github-api-cache',
      ...config,
    };

    // Initialize cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get data from cache with multi-tier lookup
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Tier 1: Memory cache
      const memoryResult = this.getFromMemory<T>(key);
      if (memoryResult !== null) {
        this.recordHit(performance.now() - startTime);
        return memoryResult;
      }

      // Tier 2: LocalStorage cache
      if (this.config.persistenceEnabled) {
        const storageResult = await this.getFromStorage<T>(key);
        if (storageResult !== null) {
          // Promote to memory cache
          this.setInMemory(key, storageResult, this.config.defaultTtl);
          this.recordHit(performance.now() - startTime);
          return storageResult;
        }
      }

      this.recordMiss(performance.now() - startTime);
      return null;
    } catch (error) {
      this.recordMiss(performance.now() - startTime);
      return null;
    }
  }

  /**
   * Set data in cache with multi-tier storage
   */
  async set<T>(
    key: string,
    data: T,
    ttl: number = this.config.defaultTtl,
    metadata?: { etag?: string; lastModified?: string; rateLimitInfo?: RateLimitInfo }
  ): Promise<void> {
    try {
      // Always store in memory cache
      this.setInMemory(key, data, ttl, metadata);

      // Store in persistent cache for larger data
      if (this.config.persistenceEnabled) {
        await this.setInStorage(key, data, ttl, metadata);
      }

      this.updateStats();
    } catch (error) {
      // Silently handle cache set errors
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(key);

    // Remove from storage
    if (this.config.persistenceEnabled) {
      try {
        localStorage.removeItem(this.getStorageKey(key));
      } catch (error) {
        // Silently handle localStorage removal errors
      }
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.config.persistenceEnabled) {
      try {
        const keys = Object.keys(localStorage);
        const namespacePrefix = `${this.config.namespace}:`;

        keys.forEach((key) => {
          if (key.startsWith(namespacePrefix)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        // Silently handle localStorage clearing errors
      }
    }

    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Check if key exists in cache and is valid
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Create cache key with repository, endpoint, and parameters
   */
  createKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (sorted, key) => {
          sorted[key] = params[key];
          return sorted;
        },
        {} as Record<string, any>
      );

    const paramString = Object.keys(sortedParams).length > 0 ? JSON.stringify(sortedParams) : '';

    return `${endpoint}:${paramString}`;
  }

  /**
   * Conditional request helper for ETags and Last-Modified
   */
  getConditionalHeaders(key: string): Record<string, string> {
    const entry = this.memoryCache.get(key);
    const headers: Record<string, string> = {};

    if (entry?.etag) {
      headers['If-None-Match'] = entry.etag;
    }

    if (entry?.lastModified) {
      headers['If-Modified-Since'] = entry.lastModified;
    }

    return headers;
  }

  /**
   * Memory cache operations
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setInMemory<T>(
    key: string,
    data: T,
    ttl: number,
    metadata?: { etag?: string; lastModified?: string; rateLimitInfo?: RateLimitInfo }
  ): void {
    // Enforce cache size limit
    if (this.memoryCache.size >= this.config.maxSize) {
      this.evictOldestEntries();
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      etag: metadata?.etag,
      lastModified: metadata?.lastModified,
      rateLimitInfo: metadata?.rateLimitInfo,
    });
  }

  /**
   * Storage cache operations
   */
  private async getFromStorage<T>(key: string): Promise<T | null> {
    try {
      const stored = localStorage.getItem(this.getStorageKey(key));
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);

      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(this.getStorageKey(key));
        return null;
      }

      return entry.data;
    } catch (error) {
      return null;
    }
  }

  private async setInStorage<T>(
    key: string,
    data: T,
    ttl: number,
    metadata?: { etag?: string; lastModified?: string; rateLimitInfo?: RateLimitInfo }
  ): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        etag: metadata?.etag,
        lastModified: metadata?.lastModified,
        rateLimitInfo: metadata?.rateLimitInfo,
      };

      localStorage.setItem(this.getStorageKey(key), JSON.stringify(entry));
    } catch (error) {
      // If storage is full, try to clear some space
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.cleanupStorage();
      }
    }
  }

  /**
   * Utility methods
   */
  private getStorageKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  private evictOldestEntries(): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
      this.stats.evictions++;
    }
  }

  private cleanupStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      const namespacePrefix = `${this.config.namespace}:`;
      const entries: Array<{ key: string; timestamp: number }> = [];

      keys.forEach((key) => {
        if (key.startsWith(namespacePrefix)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const entry = JSON.parse(stored);
              entries.push({ key, timestamp: entry.timestamp });
            }
          } catch {
            // Remove invalid entries
            localStorage.removeItem(key);
          }
        }
      });

      // Remove oldest 50% of entries
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = Math.floor(entries.length * 0.5);

      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(entries[i].key);
      }
    } catch (error) {
      // Silently handle storage cleanup errors
    }
  }

  private startCleanupInterval(): void {
    // Cleanup expired entries every 5 minutes
    setInterval(
      () => {
        this.cleanupExpiredEntries();
      },
      5 * 60 * 1000
    );
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
      }
    }

    // Clean storage cache
    if (this.config.persistenceEnabled) {
      try {
        const keys = Object.keys(localStorage);
        const namespacePrefix = `${this.config.namespace}:`;

        keys.forEach((key) => {
          if (key.startsWith(namespacePrefix)) {
            try {
              const stored = localStorage.getItem(key);
              if (stored) {
                const entry = JSON.parse(stored);
                if (now - entry.timestamp > entry.ttl) {
                  localStorage.removeItem(key);
                }
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        });
      } catch (error) {
        // Silently handle expired storage cleanup errors
      }
    }
  }

  /**
   * Statistics tracking
   */
  private recordHit(responseTime: number): void {
    this.stats.hits++;
    this.updateAvgResponseTime(responseTime);
  }

  private recordMiss(responseTime: number): void {
    this.stats.misses++;
    this.updateAvgResponseTime(responseTime);
  }

  private updateAvgResponseTime(responseTime: number): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  private updateStats(): void {
    this.stats.size = this.memoryCache.size;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry).length * 2;
    }
    return size;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
    };
  }
}

// Global cache instance
export const githubCache = new GitHubCacheService({
  defaultTtl: 5 * 60 * 1000, // 5 minutes for most data
  maxSize: 2000, // Increased memory cache size
  compressionEnabled: true,
  persistenceEnabled: true,
  namespace: 'github-api-cache',
});

// Specialized cache instances for different data types
export const repositoryCache = new GitHubCacheService({
  defaultTtl: 15 * 60 * 1000, // 15 minutes for repo data
  maxSize: 500,
  namespace: 'github-repo-cache',
});

export const userCache = new GitHubCacheService({
  defaultTtl: 30 * 60 * 1000, // 30 minutes for user data
  maxSize: 1000,
  namespace: 'github-user-cache',
});

export const contributorCache = new GitHubCacheService({
  defaultTtl: 10 * 60 * 1000, // 10 minutes for contributor data
  maxSize: 1500,
  namespace: 'github-contributor-cache',
});
