/**
 * Avatar image caching service
 * Stores avatar URLs in localStorage to enable instant loading on repeat visits
 */

interface AvatarCacheEntry {
  url: string;
  timestamp: number;
}

const CACHE_KEY_PREFIX = 'avatar_cache_';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_ENTRIES = 100;

class AvatarCache {
  private memoryCache: Map<string, string> = new Map();

  /**
   * Get cached avatar URL if available and not expired
   */
  get(orgName: string): string | null {
    // Check memory cache first
    if (this.memoryCache.has(orgName)) {
      return this.memoryCache.get(orgName)!;
    }

    try {
      const key = `${CACHE_KEY_PREFIX}${orgName}`;
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;
      
      const entry: AvatarCacheEntry = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }
      
      // Store in memory cache for faster subsequent access
      this.memoryCache.set(orgName, entry.url);
      return entry.url;
    } catch {
      return null;
    }
  }

  /**
   * Store avatar URL in cache
   */
  set(orgName: string, url: string): void {
    if (!orgName || !url) return;
    
    // Store in memory cache
    this.memoryCache.set(orgName, url);
    
    try {
      const key = `${CACHE_KEY_PREFIX}${orgName}`;
      const entry: AvatarCacheEntry = {
        url,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(key, JSON.stringify(entry));
      
      // Clean up old entries if needed
      this.cleanup();
    } catch {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }

  /**
   * Preload an avatar image to browser cache
   */
  preload(url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Resolve even on error to not block
      img.src = url;
    });
  }

  /**
   * Clean up old cache entries to prevent unbounded growth
   */
  private cleanup(): void {
    try {
      const keys = Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_KEY_PREFIX));
      
      if (keys.length <= MAX_CACHE_ENTRIES) return;
      
      // Get all entries with timestamps
      const entries = keys.map(key => {
        try {
          const entry: AvatarCacheEntry = JSON.parse(localStorage.getItem(key) || '{}');
          return { key, timestamp: entry.timestamp || 0 };
        } catch {
          return { key, timestamp: 0 };
        }
      });
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
      toRemove.forEach(({ key }) => localStorage.removeItem(key));
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Clear all avatar cache entries
   */
  clearAll(): void {
    this.memoryCache.clear();
    
    try {
      const keys = Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_KEY_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore errors
    }
  }
}

// Export singleton instance
export const avatarCache = new AvatarCache();