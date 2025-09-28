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
   * Generate content hash for cache invalidation using Web Crypto API
   */
  public async generateContentHash(title: string, body: string | null): Promise<string> {
    const content = `${title || ''}:${body || ''}`;

    // Use Web Crypto API for browser compatibility
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 16);
    } else {
      // Fallback for Node.js environments (e.g., during SSR)
      const { createHash } = await import('crypto');
      return createHash('sha256').update(content).digest('hex').substring(0, 16);
    }
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
    try {
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
    } catch (error) {
      console.error('Error in cache get operation:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
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
    try {
      const key = this.generateCacheKey(repositoryId, itemType, itemId, contentHash);
      const entry: CachedEmbedding = {
        id: this.generateUUID(),
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
      throw error;
    }
    } catch (error) {
      console.error('Error in cache set operation:', error);
      throw error;
    }
  }

  /**
   * Generate UUID using Web Crypto API or fallback
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    } else {
      // Fallback UUID generation
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
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
   * Check if cache entry is still valid based on TTL
   */
  private isValid(entry: CachedEmbedding | any): boolean {
    const now = new Date();
    const created = new Date(entry.created_at);
    const expiryHours = entry.ttl_hours || this.defaultTTLHours;
    const expiryTime = created.getTime() + expiryHours * 60 * 60 * 1000;

    // Check if entry has expired
    const isNotExpired = now.getTime() < expiryTime;

    // If expired, schedule for removal (async)
    if (!isNotExpired && entry.id) {
      this.scheduleRemoval(entry.id);
    }

    return isNotExpired;
  }

  /**
   * Schedule removal of expired entry
   */
  private async scheduleRemoval(entryId: string): Promise<void> {
    try {
      // Remove from database asynchronously
      await supabase
        .from('similarity_cache')
        .delete()
        .eq('id', entryId);
    } catch (error) {
      console.error('Failed to remove expired cache entry:', error);
    }
  }

  /**
   * Add entry to memory cache with proper LRU eviction
   */
  private addToMemoryCache(key: string, entry: CachedEmbedding): void {
    // Remove entry if it already exists (will be re-added at the end)
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
    }

    // Implement proper LRU eviction if at capacity
    if (this.memoryCache.size >= this.maxMemorySize) {
      // The first entry in Map is the oldest (least recently used)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    // Add to end of Map (most recently used)
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