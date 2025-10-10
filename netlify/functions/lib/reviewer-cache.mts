import { createClient } from '@supabase/supabase-js';

interface CachedSuggestion {
  repository_id: string;
  file_hash: string;
  suggestions: unknown;
  created_at: string;
  expires_at: string;
}

export class ReviewerCache {
  private supabase: ReturnType<typeof createClient>;
  private cacheTable = 'reviewer_suggestions_cache';
  private ttl: number;

  constructor(supabaseUrl: string, supabaseKey: string, ttlMinutes = 30) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Generate a hash from the files array to use as cache key
   */
  private generateFileHash(files: string[], prAuthor?: string): string {
    const sortedFiles = [...files].sort();
    const cacheKey = JSON.stringify({ files: sortedFiles, author: prAuthor || 'unknown' });

    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < cacheKey.length; i++) {
      const char = cacheKey.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached suggestions if they exist and haven't expired
   */
  async get(repositoryId: string, files: string[], prAuthor?: string): Promise<unknown | null> {
    try {
      const fileHash = this.generateFileHash(files, prAuthor);
      const now = new Date().toISOString();

      const { data, error } = await this.supabase
        .from(this.cacheTable)
        .select('suggestions')
        .eq('repository_id', repositoryId)
        .eq('file_hash', fileHash)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Cache lookup error:', error);
        return null;
      }

      if (data) {
        console.log(`Cache hit for repository ${repositoryId}, hash ${fileHash}`);
        return data.suggestions;
      }

      console.log(`Cache miss for repository ${repositoryId}, hash ${fileHash}`);
      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Store suggestions in cache
   */
  async set(
    repositoryId: string,
    files: string[],
    suggestions: unknown,
    prAuthor?: string
  ): Promise<void> {
    try {
      const fileHash = this.generateFileHash(files, prAuthor);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttl);

      // First, delete any existing cache entries for this repository/hash combo
      await this.supabase
        .from(this.cacheTable)
        .delete()
        .eq('repository_id', repositoryId)
        .eq('file_hash', fileHash);

      // Insert new cache entry
      const { error } = await this.supabase.from(this.cacheTable).insert({
        repository_id: repositoryId,
        file_hash: fileHash,
        suggestions,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        console.warn('Cache write error:', error);
      } else {
        console.log(`Cached suggestions for repository ${repositoryId}, hash ${fileHash}`);
      }
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  /**
   * Clear expired cache entries (maintenance operation)
   */
  async clearExpired(): Promise<void> {
    try {
      const now = new Date().toISOString();

      const { error } = await this.supabase.from(this.cacheTable).delete().lt('expires_at', now);

      if (error) {
        console.warn('Error clearing expired cache entries:', error);
      }
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Clear all cache entries for a specific repository
   */
  async invalidate(repositoryId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.cacheTable)
        .delete()
        .eq('repository_id', repositoryId);

      if (error) {
        console.warn('Error invalidating cache:', error);
      } else {
        console.log(`Invalidated cache for repository ${repositoryId}`);
      }
    } catch (error) {
      console.error('Error during cache invalidation:', error);
    }
  }
}
