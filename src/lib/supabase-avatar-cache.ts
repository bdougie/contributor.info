/**
 * Supabase-based avatar caching service
 * Provides fast, cached avatar URLs with fallback to GitHub API
 * Reduces GitHub API calls and improves chart performance
 */

import { supabase } from './supabase';
import { avatarCache as localCache } from './avatar-cache';

interface CachedAvatarResult {
  url: string;
  isCached: boolean;
  source: 'supabase' | 'localStorage' | 'github';
}

interface ContributorAvatarData {
  github_id: number;
  username: string;
  avatar_url: string | null;
  avatar_cached_at: string | null;
  avatar_cache_expires_at: string | null;
}

const CACHE_DURATION_DAYS = 7;
const BATCH_SIZE = 100;

class SupabaseAvatarCache {
  private memoryCache: Map<number, CachedAvatarResult> = new Map();
  private batchQueue: Set<number> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Get cached avatar URL for a contributor
   * Checks Supabase cache first, then localStorage, finally GitHub
   */
  async getAvatarUrl(
    githubId: number, 
    username: string, 
    fallbackUrl?: string
  ): Promise<CachedAvatarResult> {
    // Check memory cache first
    const memCached = this.memoryCache.get(githubId);
    if (memCached) {
      return memCached;
    }

    try {
      // Check Supabase cache
      const { data: contributor, error } = await supabase
        .from('contributors')
        .select('github_id, username, avatar_url, avatar_cached_at, avatar_cache_expires_at')
        .eq('github_id', githubId)
        .maybeSingle();

      if (!error && contributor && this.isCacheValid(contributor)) {
        const result: CachedAvatarResult = {
          url: contributor.avatar_url!,
          isCached: true,
          source: 'supabase'
        };
        this.memoryCache.set(githubId, result);
        return result;
      }

      // Fallback to localStorage cache
      const localCached = localCache.get(username);
      if (localCached) {
        // Update Supabase cache with localStorage data
        this.queueCacheUpdate(githubId, username, localCached);
        
        const result: CachedAvatarResult = {
          url: localCached,
          isCached: true,
          source: 'localStorage'
        };
        this.memoryCache.set(githubId, result);
        return result;
      }

      // Use fallback URL if provided
      if (fallbackUrl) {
        // Queue background update
        this.queueCacheUpdate(githubId, username, fallbackUrl);
        
        const result: CachedAvatarResult = {
          url: fallbackUrl,
          isCached: false,
          source: 'github'
        };
        this.memoryCache.set(githubId, result);
        return result;
      }

      // Return GitHub default avatar as last resort
      const defaultUrl = `https://github.com/identicons/${username}.png`;
      const result: CachedAvatarResult = {
        url: defaultUrl,
        isCached: false,
        source: 'github'
      };
      this.memoryCache.set(githubId, result);
      return result;

    } catch (error) {
      // On error, use fallback or localStorage
      const localCached = localCache.get(username);
      if (localCached) {
        return {
          url: localCached,
          isCached: true,
          source: 'localStorage'
        };
      }

      if (fallbackUrl) {
        return {
          url: fallbackUrl,
          isCached: false,
          source: 'github'
        };
      }

      // Final fallback
      return {
        url: `https://github.com/identicons/${username}.png`,
        isCached: false,
        source: 'github'
      };
    }
  }

  /**
   * Batch get avatar URLs for multiple contributors
   * Optimizes database queries for chart rendering
   */
  async getAvatarUrls(
    contributors: Array<{ githubId: number; username: string; fallbackUrl?: string }>
  ): Promise<Map<number, CachedAvatarResult>> {
    const results = new Map<number, CachedAvatarResult>();
    
    // Check memory cache first
    const uncachedContributors = contributors.filter(c => {
      const cached = this.memoryCache.get(c.githubId);
      if (cached) {
        results.set(c.githubId, cached);
        return false;
      }
      return true;
    });

    if (uncachedContributors.length === 0) {
      return results;
    }

    try {
      // Batch query Supabase
      const githubIds = uncachedContributors.map(c => c.githubId);
      const { data: dbContributors, error } = await supabase
        .from('contributors')
        .select('github_id, username, avatar_url, avatar_cached_at, avatar_cache_expires_at')
        .in('github_id', githubIds);

      if (!error && dbContributors) {
        const dbMap = new Map<number, ContributorAvatarData>();
        dbContributors.forEach(contrib => {
          dbMap.set(contrib.github_id, contrib);
        });

        // Process each contributor
        for (const contributor of uncachedContributors) {
          const dbData = dbMap.get(contributor.githubId);
          
          if (dbData && this.isCacheValid(dbData)) {
            // Use Supabase cache
            const result: CachedAvatarResult = {
              url: dbData.avatar_url!,
              isCached: true,
              source: 'supabase'
            };
            results.set(contributor.githubId, result);
            this.memoryCache.set(contributor.githubId, result);
          } else {
            // Check localStorage and fallback
            const localCached = localCache.get(contributor.username);
            if (localCached) {
              const result: CachedAvatarResult = {
                url: localCached,
                isCached: true,
                source: 'localStorage'
              };
              results.set(contributor.githubId, result);
              this.memoryCache.set(contributor.githubId, result);
              
              // Queue update
              this.queueCacheUpdate(contributor.githubId, contributor.username, localCached);
            } else if (contributor.fallbackUrl) {
              const result: CachedAvatarResult = {
                url: contributor.fallbackUrl,
                isCached: false,
                source: 'github'
              };
              results.set(contributor.githubId, result);
              this.memoryCache.set(contributor.githubId, result);
              
              // Queue update
              this.queueCacheUpdate(contributor.githubId, contributor.username, contributor.fallbackUrl);
            } else {
              // Use GitHub default
              const defaultUrl = `https://github.com/identicons/${contributor.username}.png`;
              const result: CachedAvatarResult = {
                url: defaultUrl,
                isCached: false,
                source: 'github'
              };
              results.set(contributor.githubId, result);
              this.memoryCache.set(contributor.githubId, result);
            }
          }
        }
      }
    } catch (error) {
      // On error, use fallbacks for remaining contributors
      for (const contributor of uncachedContributors) {
        if (!results.has(contributor.githubId)) {
          const localCached = localCache.get(contributor.username);
          const url = localCached || contributor.fallbackUrl || 
                     `https://github.com/identicons/${contributor.username}.png`;
          const result: CachedAvatarResult = {
            url,
            isCached: !!localCached,
            source: localCached ? 'localStorage' : 'github'
          };
          results.set(contributor.githubId, result);
          this.memoryCache.set(contributor.githubId, result);
        }
      }
    }

    return results;
  }

  /**
   * Update avatar cache in Supabase
   */
  async updateAvatarCache(githubId: number, username: string, avatarUrl: string): Promise<void> {
    try {
      // Update Supabase
      await supabase
        .from('contributors')
        .update({
          avatar_url: avatarUrl,
          avatar_cached_at: new Date().toISOString(),
          avatar_cache_expires_at: new Date(Date.now() + CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          last_updated_at: new Date().toISOString()
        })
        .eq('github_id', githubId);

      // Update localStorage cache
      localCache.set(username, avatarUrl);

      // Update memory cache
      const result: CachedAvatarResult = {
        url: avatarUrl,
        isCached: true,
        source: 'supabase'
      };
      this.memoryCache.set(githubId, result);

    } catch (error) {
      // Fallback to localStorage only
      localCache.set(username, avatarUrl);
    }
  }

  /**
   * Check if cache is valid (not expired)
   */
  private isCacheValid(contributor: ContributorAvatarData): boolean {
    if (!contributor.avatar_url || !contributor.avatar_cached_at || !contributor.avatar_cache_expires_at) {
      return false;
    }

    const expiresAt = new Date(contributor.avatar_cache_expires_at);
    return expiresAt > new Date();
  }

  /**
   * Queue cache update for batch processing
   */
  private queueCacheUpdate(githubId: number, username: string, avatarUrl: string): void {
    this.batchQueue.add(githubId);

    // Store the update data
    const updateKey = `update_${githubId}`;
    sessionStorage.setItem(updateKey, JSON.stringify({ username, avatarUrl }));

    // Debounce batch processing
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatchUpdates();
    }, 1000); // Process after 1 second of inactivity
  }

  /**
   * Process queued cache updates in batch
   */
  private async processBatchUpdates(): Promise<void> {
    if (this.batchQueue.size === 0) return;

    const updates = Array.from(this.batchQueue).map(githubId => {
      const updateKey = `update_${githubId}`;
      const updateData = sessionStorage.getItem(updateKey);
      sessionStorage.removeItem(updateKey);
      
      if (updateData) {
        const { username, avatarUrl } = JSON.parse(updateData);
        return { githubId, username, avatarUrl };
      }
      return null;
    }).filter(Boolean);

    this.batchQueue.clear();

    // Process updates in batches
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      // Process batch updates
      await Promise.allSettled(
        batch.map(update => 
          this.updateAvatarCache(update!.githubId, update!.username, update!.avatarUrl)
        )
      );
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.memoryCache.clear();
    localCache.clearAll();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { memorySize: number; hasLocalStorage: boolean } {
    return {
      memorySize: this.memoryCache.size,
      hasLocalStorage: typeof localStorage !== 'undefined'
    };
  }
}

// Export singleton instance
export const supabaseAvatarCache = new SupabaseAvatarCache();
export type { CachedAvatarResult };