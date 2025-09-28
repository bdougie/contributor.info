import { createHash } from 'crypto';
import { supabase } from '../../src/lib/supabase';

export interface CachedEmbedding {
  id: string;
  item_type: 'issue' | 'pull_request';
  item_id: string;
  repository_id: string;
  embedding: number[];
  content_hash: string;
  created_at: Date;
  accessed_at: Date;
  access_count: number;
  ttl_hours: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  memorySize: number;
  dbSize: number;
  hitRate: number;
}

export class SimilarityCacheService {
  private memoryCache: Map<string, CachedEmbedding>;
  private maxMemorySize = 500;
  private defaultTTLHours = 24;
  private stats: CacheStats;

  constructor() {
    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      memorySize: 0,
      dbSize: 0,
      hitRate: 0,
    };
  }

  /**
   * Generate a unique cache key for an item
   */
  private generateCacheKey(
    repositoryId: string,
    itemType: 'issue' | 'pull_request',
    itemId: string,
    contentHash?: string
  ): string {
    const parts = [repositoryId, itemType, itemId];
    if (contentHash) parts.push(contentHash);
    return parts.join(':');
  }

  /**
   * Generate content hash for cache invalidation
   */
  public generateContentHash(title: string, body: string | null): string {
    const content = `${title || ''}:${body || ''}`;
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get embedding from cache (memory first, then database)
   */
  async get(
    repositoryId: string,
    itemType: 'issue' | 'pull_request',
    itemId: string,
    contentHash: string
  ): Promise<number[] | null> {
    const key = this.generateCacheKey(repositoryId, itemType, itemId, contentHash);

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      this.stats.hits++;
      this.updateAccessStats(memoryEntry);
      this.updateHitRate();
      return memoryEntry.embedding;
    }

    // Check database cache
    try {
      const { data, error } = await supabase
        .from('similarity_cache')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .eq('content_hash', contentHash)
        .single();

      if (!error && data && this.isValid(data)) {
        this.stats.hits++;
        // Promote to memory cache
        this.addToMemoryCache(key, data);
        // Update access stats in DB
        await this.updateDatabaseAccessStats(data.id);
        this.updateHitRate();
        return data.embedding;
      }
    } catch (error) {
      console.error('Cache lookup error:', error);
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Store embedding in cache
   */
  async set(
    repositoryId: string,
    itemType: 'issue' | 'pull_request',
    itemId: string,
    contentHash: string,
    embedding: number[],
    ttlHours?: number
  ): Promise<void> {
    const key = this.generateCacheKey(repositoryId, itemType, itemId, contentHash);
    const entry: CachedEmbedding = {
      id: crypto.randomUUID(),
      item_type: itemType,
      item_id: itemId,
      repository_id: repositoryId,
      embedding,
      content_hash: contentHash,
      created_at: new Date(),
      accessed_at: new Date(),
      access_count: 1,
      ttl_hours: ttlHours || this.defaultTTLHours,
    };

    // Add to memory cache
    this.addToMemoryCache(key, entry);

    // Store in database
    try {
      await supabase.from('similarity_cache').upsert(
        {
          item_type: itemType,
          item_id: itemId,
          repository_id: repositoryId,
          embedding,
          content_hash: contentHash,
          ttl_hours: ttlHours || this.defaultTTLHours,
          accessed_at: new Date().toISOString(),
          access_count: 1,
        },
        {
          onConflict: 'repository_id,item_type,item_id',
        }
      );
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  /**
   * Batch get embeddings from cache
   */
  async getBatch(
    items: Array<{
      repositoryId: string;
      itemType: 'issue' | 'pull_request';
      itemId: string;
      contentHash: string;
    }>
  ): Promise<Map<string, number[] | null>> {
    const results = new Map<string, number[] | null>();
    const uncachedItems: typeof items = [];

    // Check memory cache first
    for (const item of items) {
      const key = this.generateCacheKey(
        item.repositoryId,
        item.itemType,
        item.itemId,
        item.contentHash
      );
      const cached = this.memoryCache.get(key);
      if (cached && this.isValid(cached)) {
        results.set(item.itemId, cached.embedding);
        this.stats.hits++;
      } else {
        uncachedItems.push(item);
      }
    }

    // Batch fetch from database for uncached items
    if (uncachedItems.length > 0) {
      try {
        const { data, error } = await supabase
          .from('similarity_cache')
          .select('*')
          .in(
            'item_id',
            uncachedItems.map((i) => i.itemId)
          );

        if (!error && data) {
          for (const cacheEntry of data) {
            if (this.isValid(cacheEntry)) {
              results.set(cacheEntry.item_id, cacheEntry.embedding);
              this.stats.hits++;
              // Promote to memory cache
              const key = this.generateCacheKey(
                cacheEntry.repository_id,
                cacheEntry.item_type,
                cacheEntry.item_id,
                cacheEntry.content_hash
              );
              this.addToMemoryCache(key, cacheEntry);
            } else {
              results.set(cacheEntry.item_id, null);
              this.stats.misses++;
            }
          }
        }

        // Mark remaining as misses
        for (const item of uncachedItems) {
          if (!results.has(item.itemId)) {
            results.set(item.itemId, null);
            this.stats.misses++;
          }
        }
      } catch (error) {
        console.error('Batch cache lookup error:', error);
        // Mark all as misses on error
        for (const item of uncachedItems) {
          results.set(item.itemId, null);
          this.stats.misses++;
        }
      }
    }

    this.updateHitRate();
    return results;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CachedEmbedding | any): boolean {
    const now = new Date();
    const created = new Date(entry.created_at);
    const expiryHours = entry.ttl_hours || this.defaultTTLHours;
    const expiryTime = created.getTime() + expiryHours * 60 * 60 * 1000;
    return now.getTime() < expiryTime;
  }

  /**
   * Add entry to memory cache with LRU eviction
   */
  private addToMemoryCache(key: string, entry: CachedEmbedding): void {
    // Implement LRU eviction if at capacity
    if (this.memoryCache.size >= this.maxMemorySize) {
      // Find least recently accessed entry
      let oldestKey: string | null = null;
      let oldestTime = new Date();
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.accessed_at < oldestTime) {
          oldestTime = v.accessed_at;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(key, entry);
    this.stats.memorySize = this.memoryCache.size;
  }

  /**
   * Update access statistics for memory entry
   */
  private updateAccessStats(entry: CachedEmbedding): void {
    entry.accessed_at = new Date();
    entry.access_count++;
  }

  /**
   * Update access statistics in database
   */
  private async updateDatabaseAccessStats(id: string): Promise<void> {
    try {
      await supabase.rpc('increment_cache_access', {
        cache_id: id,
      });
    } catch (error) {
      // Non-critical error, log but don't throw
      console.error('Failed to update cache access stats:', error);
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear expired entries from cache
   */
  async cleanup(): Promise<number> {
    let removed = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
        removed++;
      }
    }

    // Clean database cache
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_cache');
      if (!error && data) {
        removed += data;
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }

    this.stats.memorySize = this.memoryCache.size;
    return removed;
  }

  /**
   * Invalidate cache for specific items
   */
  async invalidate(
    repositoryId: string,
    itemType: 'issue' | 'pull_request',
    itemId: string
  ): Promise<void> {
    // Remove from memory cache
    for (const [key] of this.memoryCache.entries()) {
      if (key.startsWith(`${repositoryId}:${itemType}:${itemId}`)) {
        this.memoryCache.delete(key);
      }
    }

    // Remove from database
    try {
      await supabase
        .from('similarity_cache')
        .delete()
        .eq('repository_id', repositoryId)
        .eq('item_type', itemType)
        .eq('item_id', itemId);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const similarityCache = new SimilarityCacheService();