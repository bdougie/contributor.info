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
const MAX_MEMORY_CACHE_SIZE = 500; // Limit memory cache to prevent unbounded growth
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for memory cache

class SupabaseAvatarCache {
  private memoryCache: Map<number, { result: CachedAvatarResult; timestamp: number }> = new Map();
  private batchQueue: Set<number> = new Set();
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Validates avatar URL to prevent XSS and ensure it's from trusted sources
   */
  private isValidAvatarUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only allow HTTPS URLs from trusted domains
      const trustedDomains = [
        'avatars.githubusercontent.com',
        'github.com',
        'secure.gravatar.com',
        'www.gravatar.com',
      ];
      return (
        parsed.protocol === 'https:' &&
        trustedDomains.some(
          (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
        )
      );
    } catch {
      return false;
    }
  }

  /**
   * Manages memory cache size and TTL
   */
  private addToMemoryCache(githubId: number, result: CachedAvatarResult): void {
    // Evict oldest entries if cache is full
    if (this.memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(githubId, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets from memory cache with TTL check
   */
  private getFromMemoryCache(githubId: number): CachedAvatarResult | null {
    const cached = this.memoryCache.get(githubId);
    if (cached) {
      // Check if cache entry has expired
      if (Date.now() - cached.timestamp > MEMORY_CACHE_TTL_MS) {
        this.memoryCache.delete(githubId);
        return null;
      }
      return cached.result;
    }
    return null;
  }

  /**
   * Get cached avatar URL for a contributor
   * Checks Supabase cache first, then localStorage, finally GitHub
   */
  async getAvatarUrl(
    githubId: number,
    username: string,
    fallbackUrl?: string,
  ): Promise<CachedAvatarResult> {
    // Check memory cache first
    const memCached = this.getFromMemoryCache(githubId);
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
          source: 'supabase',
        };
        this.addToMemoryCache(githubId, result);
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
          source: 'localStorage',
        };
        this.addToMemoryCache(githubId, result);
        return result;
      }

      // Use fallback URL if provided
      if (fallbackUrl) {
        // Queue background update
        this.queueCacheUpdate(githubId, username, fallbackUrl);

        const result: CachedAvatarResult = {
          url: fallbackUrl,
          isCached: false,
          source: 'github',
        };
        this.addToMemoryCache(githubId, result);
        return result;
      }

      // Return GitHub default avatar as last resort
      // Use avatars.githubusercontent.com which provides CORS headers
      const defaultUrl = `https://avatars.githubusercontent.com/u/${githubId}?v=4`;
      const result: CachedAvatarResult = {
        url: defaultUrl,
        isCached: false,
        source: 'github',
      };
      this.addToMemoryCache(githubId, result);
      return result;
    } catch (error) {
      // On error, use fallback or localStorage
      const localCached = localCache.get(username);
      if (localCached) {
        return {
          url: localCached,
          isCached: true,
          source: 'localStorage',
        };
      }

      if (fallbackUrl) {
        return {
          url: fallbackUrl,
          isCached: false,
          source: 'github',
        };
      }

      // Final fallback - use GitHub avatar API with CORS headers
      return {
        url: `https://avatars.githubusercontent.com/u/${githubId}?v=4`,
        isCached: false,
        source: 'github',
      };
    }
  }

  /**
   * Batch get avatar URLs for multiple contributors
   * Optimizes database queries for chart rendering
   */
  async getAvatarUrls(
    contributors: Array<{ githubId: number; username: string; fallbackUrl?: string }>,
  ): Promise<Map<number, CachedAvatarResult>> {
    const results = new Map<number, CachedAvatarResult>();

    // Check memory cache first
    const uncachedContributors = contributors.filter((c) => {
      const cached = this.getFromMemoryCache(c.githubId);
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
      const githubIds = uncachedContributors.map((c) => c.githubId);
      const { data: dbContributors, error } = await supabase
        .from('contributors')
        .select('github_id, username, avatar_url, avatar_cached_at, avatar_cache_expires_at')
        .in('github_id', githubIds);

      if (!error && dbContributors) {
        const dbMap = new Map<number, ContributorAvatarData>();
        dbContributors.forEach((contrib) => {
          dbMap.set(contrib.github_id, contrib);
        });

        // Process each contributor
        for (const contributor of uncachedContributors) {
          const dbData = dbMap.get(contributor.githubId);

          if (dbData && this.isCacheValid(dbData) && dbData.avatar_url) {
            // Use Supabase cache
            const result: CachedAvatarResult = {
              url: dbData.avatar_url,
              isCached: true,
              source: 'supabase',
            };
            results.set(contributor.githubId, result);
            this.addToMemoryCache(contributor.githubId, result);
          } else {
            // Check localStorage and fallback
            const localCached = localCache.get(contributor.username);
            if (localCached) {
              const result: CachedAvatarResult = {
                url: localCached,
                isCached: true,
                source: 'localStorage',
              };
              results.set(contributor.githubId, result);
              this.addToMemoryCache(contributor.githubId, result);

              // Queue update if URL is valid
              if (this.isValidAvatarUrl(localCached)) {
                this.queueCacheUpdate(contributor.githubId, contributor.username, localCached);
              }
            } else if (contributor.fallbackUrl) {
              const result: CachedAvatarResult = {
                url: contributor.fallbackUrl,
                isCached: false,
                source: 'github',
              };
              results.set(contributor.githubId, result);
              this.addToMemoryCache(contributor.githubId, result);

              // Queue update if URL is valid
              if (this.isValidAvatarUrl(contributor.fallbackUrl)) {
                this.queueCacheUpdate(
                  contributor.githubId,
                  contributor.username,
                  contributor.fallbackUrl,
                );
              }
            } else {
              // Use GitHub default - avatars API with CORS headers
              const defaultUrl = `https://avatars.githubusercontent.com/u/${contributor.githubId}?v=4`;
              const result: CachedAvatarResult = {
                url: defaultUrl,
                isCached: false,
                source: 'github',
              };
              results.set(contributor.githubId, result);
              this.addToMemoryCache(contributor.githubId, result);
            }
          }
        }
      }
    } catch (error) {
      // On error, use fallbacks for remaining contributors
      for (const contributor of uncachedContributors) {
        if (!results.has(contributor.githubId)) {
          const localCached = localCache.get(contributor.username);
          // Use GitHub avatar API with CORS headers as final fallback
          const url =
            localCached ||
            contributor.fallbackUrl ||
            `https://avatars.githubusercontent.com/u/${contributor.githubId}?v=4`;
          const result: CachedAvatarResult = {
            url,
            isCached: !!localCached,
            source: localCached ? 'localStorage' : 'github',
          };
          results.set(contributor.githubId, result);
          this.addToMemoryCache(contributor.githubId, result);
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
          avatar_cache_expires_at: new Date(
            Date.now() + CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString(),
          last_updated_at: new Date().toISOString(),
        })
        .eq('github_id', githubId);

      // Update localStorage cache
      localCache.set(username, avatarUrl);

      // Update memory cache
      const result: CachedAvatarResult = {
        url: avatarUrl,
        isCached: true,
        source: 'supabase',
      };
      this.addToMemoryCache(githubId, result);
    } catch (error) {
      // Fallback to localStorage only
      localCache.set(username, avatarUrl);
    }
  }

  /**
   * Check if cache is valid (not expired)
   */
  private isCacheValid(contributor: ContributorAvatarData): boolean {
    if (
      !contributor.avatar_url ||
      !contributor.avatar_cached_at ||
      !contributor.avatar_cache_expires_at
    ) {
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

    // Store the update data (check if sessionStorage exists for SSR safety)
    if (typeof sessionStorage !== 'undefined') {
      const updateKey = `update_${githubId}`;
      sessionStorage.setItem(updateKey, JSON.stringify({ username, avatarUrl }));
    }

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

    const updates = Array.from(this.batchQueue)
      .map((githubId) => {
        // Check if sessionStorage exists for SSR safety
        if (typeof sessionStorage === 'undefined') return null;

        const updateKey = `update_${githubId}`;
        const updateData = sessionStorage.getItem(updateKey);
        sessionStorage.removeItem(updateKey);

        if (updateData) {
          try {
            const parsed = JSON.parse(updateData);
            // Validate the parsed shape
            if (
              parsed &&
              typeof parsed.username === 'string' &&
              typeof parsed.avatarUrl === 'string'
            ) {
              return { githubId, username: parsed.username, avatarUrl: parsed.avatarUrl };
            }
          } catch (error) {
            console.error("Error:", error);
          }
        }
        return null;
      })
      .filter(Boolean);

    this.batchQueue.clear();

    // Process updates in batches
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      // Process batch updates
      await Promise.allSettled(
        batch.map((update) =>
          this.updateAvatarCache(update!.githubId, update!.username, update!.avatarUrl),
        ),
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
      hasLocalStorage: typeof localStorage !== 'undefined',
    };
  }
}

// Export singleton instance
export const supabaseAvatarCache = new SupabaseAvatarCache();
export type { CachedAvatarResult };
