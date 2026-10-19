/**
 * Two-tier caching layer for chart screenshots
 *
 * Tier 1: In-memory LRU cache (instant hits, dies with the machine)
 * Tier 2: Supabase Storage, public bucket `chart-screenshots`
 *
 * The storage object path is deterministic (no hash) so the social-meta
 * edge function on contributor.info can build the same path and point
 * crawlers straight at the public object URL without waking this app.
 * Keep `storagePathFor` in sync with `chartStoragePath` in
 * netlify/edge-functions/social-meta.ts.
 *
 * TTL: 24 hours. Reads go through the public URL so the object's
 * Last-Modified header decides freshness in both tiers.
 */

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_MEMORY_ENTRIES = 100;
const STORAGE_BUCKET = 'chart-screenshots';

// Simple LRU implementation
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * @returns {{ data: Buffer, remainingTtlMs: number } | null}
   */
  get(key) {
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key);

    // Check expiry
    const remainingTtlMs = entry.expiry - Date.now();
    if (remainingTtlMs <= 0) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return { data: entry.data, remainingTtlMs };
  }

  set(key, data, ttl = CACHE_TTL) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// In-memory cache instance
const memoryCache = new LRUCache(MAX_MEMORY_ENTRIES);

// Cleanup expired entries periodically (unref allows process to exit cleanly)
setInterval(() => {
  memoryCache.cleanup();
}, 60000).unref();

/**
 * Generate cache key from chart parameters. The key doubles as the
 * storage object path: `{chartType}/{owner}/{repo}/{timeRange}-{distributionType}.png`.
 * Owner and repo are validated as `[a-zA-Z0-9_.-]` by the route, so the
 * path needs no escaping.
 *
 * @param {string} chartType - Type of chart
 * @param {object} params - Chart parameters
 * @returns {string} - Storage object path
 */
function generateCacheKey(chartType, params) {
  const owner = String(params.owner || '').toLowerCase();
  const repo = String(params.repo || '').toLowerCase();
  const timeRange = String(params.timeRange || '30');
  const distributionType = String(params.type || 'donut').toLowerCase();
  return `${chartType}/${owner}/${repo}/${timeRange}-${distributionType}.png`;
}

/**
 * Public URL of a cached object. Null when Supabase is not configured.
 *
 * @param {string} key - Cache key (storage object path)
 * @returns {string|null}
 */
function publicUrlFor(key) {
  const baseUrl = process.env.SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${STORAGE_BUCKET}/${key}`;
}

/**
 * Age in milliseconds derived from a Last-Modified header, or Infinity
 * when the header is missing or unparseable (treated as stale).
 *
 * @param {string|null} lastModified
 * @returns {number}
 */
function ageFromLastModified(lastModified) {
  if (!lastModified) return Infinity;
  const modifiedAt = Date.parse(lastModified);
  if (Number.isNaN(modifiedAt)) return Infinity;
  return Date.now() - modifiedAt;
}

/**
 * Get cached image. The remaining TTL is returned so the HTTP response can
 * carry a matching max-age instead of restarting the clock on every hit.
 *
 * @param {string} key - Cache key
 * @param {object} supabase - Supabase client (unused for reads; the bucket is public)
 * @returns {Promise<{ buffer: Buffer, remainingTtlMs: number }|null>}
 */
async function getCachedImage(key, supabase) {
  // Check memory cache first (fastest)
  const memoryHit = memoryCache.get(key);
  if (memoryHit) {
    global.cacheHits = (global.cacheHits || 0) + 1;
    return { buffer: memoryHit.data, remainingTtlMs: memoryHit.remainingTtlMs };
  }

  // Check Supabase Storage through the public URL so we get Last-Modified
  const url = supabase ? publicUrlFor(key) : null;
  if (url) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const age = ageFromLastModified(response.headers.get('last-modified'));
        if (age <= CACHE_TTL) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const remainingTtlMs = CACHE_TTL - age;

          // Repopulate memory cache for whatever TTL the object has left
          memoryCache.set(key, buffer, remainingTtlMs);
          global.cacheHits = (global.cacheHits || 0) + 1;

          return { buffer, remainingTtlMs };
        }
        console.log('Storage cache stale for %s (age %d s)', key, Math.round(age / 1000));
      }
    } catch (error) {
      // Storage miss or error - continue to render
      console.log('Storage cache miss for %s: %s', key, error.message);
    }
  }

  global.cacheMisses = (global.cacheMisses || 0) + 1;
  return null;
}

/**
 * Store image in cache
 *
 * Storage writes need the service role key (`SUPABASE_SERVICE_ROLE_KEY`
 * on Fly); with the anon key every upload is refused by RLS and only the
 * memory tier works.
 *
 * @param {string} key - Cache key
 * @param {Buffer} buffer - Image buffer
 * @param {object} supabase - Supabase client
 */
async function cacheImage(key, buffer, supabase) {
  // Always store in memory cache
  memoryCache.set(key, buffer);

  // Store in Supabase Storage (async, don't block)
  if (supabase) {
    supabase.storage
      .from(STORAGE_BUCKET)
      .upload(key, buffer, {
        upsert: true,
        contentType: 'image/png',
        cacheControl: `${CACHE_TTL / 1000}`,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Storage cache write error: %s', error.message);
        }
      })
      .catch((error) => {
        console.error('Storage cache write error: %s', error.message);
      });
  }
}

/**
 * Invalidate cache for specific key
 *
 * @param {string} key - Cache key
 * @param {object} supabase - Supabase client
 */
async function invalidateCache(key, supabase) {
  memoryCache.delete(key);

  if (supabase) {
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([key]);
    } catch (error) {
      console.error('Cache invalidation error: %s', error.message);
    }
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const hits = global.cacheHits || 0;
  const misses = global.cacheMisses || 0;
  const total = hits + misses;

  return {
    memorySize: memoryCache.size(),
    maxMemorySize: MAX_MEMORY_ENTRIES,
    hits,
    misses,
    hitRate: total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : 'N/A',
  };
}

export {
  generateCacheKey,
  publicUrlFor,
  ageFromLastModified,
  getCachedImage,
  cacheImage,
  invalidateCache,
  getCacheStats,
  CACHE_TTL,
  STORAGE_BUCKET,
};
