import crypto from 'crypto';

/**
 * Two-tier caching layer for chart screenshots
 *
 * Tier 1: In-memory LRU cache (instant hits)
 * Tier 2: Supabase Storage (persistent across restarts)
 *
 * TTL: 6 hours by default
 */

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const MAX_MEMORY_ENTRIES = 100;
const STORAGE_BUCKET = 'chart-screenshots';

// Simple LRU implementation
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key);

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
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

// Cleanup expired entries periodically
setInterval(() => {
  memoryCache.cleanup();
}, 60000); // Every minute

/**
 * Generate cache key from chart parameters
 *
 * @param {string} chartType - Type of chart
 * @param {object} params - Chart parameters
 * @returns {string} - MD5 hash cache key
 */
function generateCacheKey(chartType, params) {
  const normalized = {
    type: chartType,
    owner: params.owner?.toLowerCase(),
    repo: params.repo?.toLowerCase(),
    timeRange: params.timeRange || '30',
    distributionType: params.type || 'donut',
  };

  // Sort keys for consistent hashing
  const sorted = Object.keys(normalized)
    .sort()
    .reduce((obj, key) => {
      if (normalized[key] !== undefined) {
        obj[key] = normalized[key];
      }
      return obj;
    }, {});

  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Get cached image
 *
 * @param {string} key - Cache key
 * @param {object} supabase - Supabase client
 * @returns {Promise<Buffer|null>} - Image buffer or null
 */
async function getCachedImage(key, supabase) {
  // Check memory cache first (fastest)
  const memoryHit = memoryCache.get(key);
  if (memoryHit) {
    global.cacheHits = (global.cacheHits || 0) + 1;
    return memoryHit;
  }

  // Check Supabase Storage
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(`${key}.png`);

      if (!error && data) {
        // Convert blob to buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Repopulate memory cache
        memoryCache.set(key, buffer);
        global.cacheHits = (global.cacheHits || 0) + 1;

        return buffer;
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
      .upload(`${key}.png`, buffer, {
        upsert: true,
        contentType: 'image/png',
        cacheControl: `public, max-age=${CACHE_TTL / 1000}`,
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
      await supabase.storage.from(STORAGE_BUCKET).remove([`${key}.png`]);
    } catch (error) {
      console.error('Cache invalidation error: %s', error.message);
    }
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    memorySize: memoryCache.size(),
    maxMemorySize: MAX_MEMORY_ENTRIES,
    hits: global.cacheHits || 0,
    misses: global.cacheMisses || 0,
    hitRate:
      global.cacheHits && global.cacheMisses
        ? ((global.cacheHits / (global.cacheHits + global.cacheMisses)) * 100).toFixed(2) + '%'
        : 'N/A',
  };
}

export { generateCacheKey, getCachedImage, cacheImage, invalidateCache, getCacheStats, CACHE_TTL };
