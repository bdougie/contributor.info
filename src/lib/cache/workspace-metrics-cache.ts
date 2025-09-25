/**
 * Workspace Metrics Cache Manager
 * Provides multi-tier caching for workspace metrics with automatic invalidation
 */

import type { WorkspaceMetrics, MetricsTimeRange } from '@/types/workspace';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  isStale?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  memoryUsage: number;
}

export interface CacheOptions {
  defaultTtl?: number;
  maxSize?: number;
  staleWhileRevalidate?: boolean;
  namespace?: string;
}

/**
 * In-memory cache for workspace metrics
 * Provides fast access with automatic TTL management
 */
export class WorkspaceMetricsCache {
  private memoryCache = new Map<string, CacheEntry<WorkspaceMetrics>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    memoryUsage: 0,
  };

  private readonly options: Required<CacheOptions>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxSize: 100, // Max 100 workspace metrics in memory
      staleWhileRevalidate: true,
      namespace: 'workspace-metrics',
      ...options,
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate cache key for workspace metrics
   */
  private generateKey(workspaceId: string, timeRange: MetricsTimeRange): string {
    return `${this.options.namespace}:${workspaceId}:${timeRange}`;
  }

  /**
   * Get metrics from cache
   */
  get(workspaceId: string, timeRange: MetricsTimeRange): WorkspaceMetrics | null {
    const key = this.generateKey(workspaceId, timeRange);
    const entry = this.memoryCache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if expired
    if (age > entry.ttl) {
      if (this.options.staleWhileRevalidate) {
        // Return stale data but mark for revalidation
        entry.isStale = true;
        this.recordHit();
        return { ...entry.data, is_stale: true };
      } else {
        // Remove expired entry
        this.memoryCache.delete(key);
        this.recordMiss();
        return null;
      }
    }

    this.recordHit();
    return entry.data;
  }

  /**
   * Set metrics in cache
   */
  set(
    workspaceId: string,
    timeRange: MetricsTimeRange,
    metrics: WorkspaceMetrics,
    ttl?: number
  ): void {
    const key = this.generateKey(workspaceId, timeRange);

    // Enforce cache size limit
    if (this.memoryCache.size >= this.options.maxSize && !this.memoryCache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry<WorkspaceMetrics> = {
      data: metrics,
      timestamp: Date.now(),
      ttl: ttl || this.getTtlForTimeRange(timeRange),
      isStale: false,
    };

    this.memoryCache.set(key, entry);
    this.updateStats();
  }

  /**
   * Invalidate cache entry
   */
  invalidate(workspaceId: string, timeRange?: MetricsTimeRange): void {
    if (timeRange) {
      // Invalidate specific time range
      const key = this.generateKey(workspaceId, timeRange);
      this.memoryCache.delete(key);
    } else {
      // Invalidate all time ranges for workspace
      const prefix = `${this.options.namespace}:${workspaceId}:`;
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
    }
    this.updateStats();
  }

  /**
   * Mark cache entry as stale
   */
  markStale(workspaceId: string, timeRange?: MetricsTimeRange): void {
    if (timeRange) {
      const key = this.generateKey(workspaceId, timeRange);
      const entry = this.memoryCache.get(key);
      if (entry) {
        entry.isStale = true;
      }
    } else {
      // Mark all time ranges as stale
      const prefix = `${this.options.namespace}:${workspaceId}:`;
      for (const [key, entry] of this.memoryCache.entries()) {
        if (key.startsWith(prefix)) {
          entry.isStale = true;
        }
      }
    }
  }

  /**
   * Check if cache has valid (non-stale) entry
   */
  has(workspaceId: string, timeRange: MetricsTimeRange): boolean {
    const key = this.generateKey(workspaceId, timeRange);
    const entry = this.memoryCache.get(key);

    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl && !entry.isStale;
  }

  /**
   * Get all cached metrics for a workspace
   */
  getAll(workspaceId: string): Map<MetricsTimeRange, WorkspaceMetrics> {
    const result = new Map<MetricsTimeRange, WorkspaceMetrics>();
    const prefix = `${this.options.namespace}:${workspaceId}:`;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.startsWith(prefix)) {
        const timeRange = key.replace(prefix, '') as MetricsTimeRange;
        const age = Date.now() - entry.timestamp;

        if (age <= entry.ttl || this.options.staleWhileRevalidate) {
          result.set(timeRange, entry.data);
        }
      }
    }

    return result;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: this.calculateHitRate(),
    };
  }

  /**
   * Warm cache with data
   */
  async warm(workspaceId: string, data: Map<MetricsTimeRange, WorkspaceMetrics>): Promise<void> {
    for (const [timeRange, metrics] of data.entries()) {
      this.set(workspaceId, timeRange, metrics);
    }
  }

  /**
   * Get TTL for specific time range
   */
  private getTtlForTimeRange(timeRange: MetricsTimeRange): number {
    const ttlMap: Record<MetricsTimeRange, number> = {
      '7d': 5 * 60 * 1000, // 5 minutes
      '30d': 10 * 60 * 1000, // 10 minutes
      '90d': 30 * 60 * 1000, // 30 minutes
      '1y': 60 * 60 * 1000, // 1 hour
      all: 2 * 60 * 60 * 1000, // 2 hours
    };

    return ttlMap[timeRange] || this.options.defaultTtl;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);

    // Ensure cleanup stops when process exits
    if (typeof process !== 'undefined') {
      process.on('exit', () => this.stopCleanupInterval());
    }
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      const age = now - entry.timestamp;

      // Remove if expired and stale-while-revalidate is disabled
      // or if it's been stale for too long
      if (age > entry.ttl * 2 || (!this.options.staleWhileRevalidate && age > entry.ttl)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.updateStats();
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(): void {
    this.stats.hits++;
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.stats.misses++;
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.size = this.memoryCache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * Calculate hit rate
   */
  private calculateHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each metrics object is about 10KB
    return this.memoryCache.size * 10 * 1024; // in bytes
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Destroy cache and clean up
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.clear();
  }
}

// Create a singleton instance for the application
export const workspaceMetricsCache = new WorkspaceMetricsCache();

/**
 * Cache warming utility
 * Preloads frequently accessed metrics
 */
export class CacheWarmer {
  private cache: WorkspaceMetricsCache;

  constructor(cache: WorkspaceMetricsCache = workspaceMetricsCache) {
    this.cache = cache;
  }

  /**
   * Warm cache for a specific workspace
   */
  async warmWorkspace(
    workspaceId: string,
    fetchFn: (timeRange: MetricsTimeRange) => Promise<WorkspaceMetrics>
  ): Promise<void> {
    const timeRanges: MetricsTimeRange[] = ['7d', '30d', '90d'];

    // Fetch all time ranges in parallel
    const promises = timeRanges.map(async (timeRange) => {
      try {
        const metrics = await fetchFn(timeRange);
        this.cache.set(workspaceId, timeRange, metrics);
      } catch (error) {
        console.error('Failed to warm cache for %s:%s:', error, workspaceId, timeRange);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Warm cache for multiple workspaces
   */
  async warmWorkspaces(
    workspaceIds: string[],
    fetchFn: (workspaceId: string, timeRange: MetricsTimeRange) => Promise<WorkspaceMetrics>
  ): Promise<void> {
    // Process workspaces in batches to avoid overwhelming the system
    const batchSize = 3;

    for (let i = 0; i < workspaceIds.length; i += batchSize) {
      const batch = workspaceIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map((workspaceId) =>
          this.warmWorkspace(workspaceId, (timeRange) => fetchFn(workspaceId, timeRange))
        )
      );
    }
  }
}

/**
 * Cache invalidation manager
 * Handles cache invalidation on data changes
 */
export class CacheInvalidator {
  private cache: WorkspaceMetricsCache;

  constructor(cache: WorkspaceMetricsCache = workspaceMetricsCache) {
    this.cache = cache;
  }

  /**
   * Invalidate on repository added
   */
  onRepositoryAdded(workspaceId: string): void {
    this.cache.markStale(workspaceId);
  }

  /**
   * Invalidate on repository removed
   */
  onRepositoryRemoved(workspaceId: string): void {
    this.cache.markStale(workspaceId);
  }

  /**
   * Invalidate on data update
   */
  onDataUpdate(workspaceId: string, affectedTimeRanges?: MetricsTimeRange[]): void {
    if (affectedTimeRanges) {
      affectedTimeRanges.forEach((timeRange) => {
        this.cache.markStale(workspaceId, timeRange);
      });
    } else {
      this.cache.markStale(workspaceId);
    }
  }

  /**
   * Force refresh
   */
  forceRefresh(workspaceId: string): void {
    this.cache.invalidate(workspaceId);
  }
}

// Export singleton instances
export const cacheWarmer = new CacheWarmer();
export const cacheInvalidator = new CacheInvalidator();
