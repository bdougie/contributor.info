// Enhanced Service Worker for contributor.info PWA - Phase 3 Performance
// Version 3.0.0 - Aggressive caching strategies for optimal performance
const CACHE_VERSION = '3.0.0';
const CACHE_NAME = `contributor-info-v${CACHE_VERSION}`;

// Separate caches for different content types
const CACHES = {
  STATIC: `static-v${CACHE_VERSION}`,
  VENDOR: `vendor-v${CACHE_VERSION}`,
  APP: `app-v${CACHE_VERSION}`,
  API: `api-v${CACHE_VERSION}`,
  IMAGES: `images-v${CACHE_VERSION}`,
  DATA: `data-v${CACHE_VERSION}`,
  RUNTIME: `runtime-v${CACHE_VERSION}`
};

// Cache strategies by resource type
const CACHE_STRATEGIES = {
  // Vendor chunks - Cache First (immutable, 1 year)
  VENDOR: {
    strategy: 'cacheFirst',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    patterns: [
      /\/js\/vendor-react.*\.js$/,
      /\/js\/vendor-supabase.*\.js$/,
      /\/js\/vendor-markdown.*\.js$/,
      /\/js\/vendor-utils.*\.js$/,
      /\/js\/vendor-monitoring.*\.js$/
    ]
  },
  
  // App chunks - Stale While Revalidate
  APP: {
    strategy: 'staleWhileRevalidate',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    patterns: [
      /\/js\/index.*\.js$/,
      /\/js\/.*-[a-zA-Z0-9]{8}\.js$/,
      /\/css\/.*\.css$/
    ]
  },
  
  // API responses - Stale While Revalidate with shorter cache
  API: {
    strategy: 'staleWhileRevalidate',
    maxAge: 5 * 60 * 1000, // 5 minutes
    patterns: [
      /api\.github\.com/,
      /\.supabase\.co\/rest/,
      /\/api\//
    ]
  },
  
  // Images - Cache First with background refresh
  IMAGES: {
    strategy: 'cacheFirst',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    patterns: [
      /avatars\.githubusercontent\.com/,
      /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/
    ]
  }
};

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/social.webp',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html' // We'll create this
];

// Routes to prefetch for instant navigation
const PREFETCH_ROUTES = [
  '/changelog',
  '/docs',
  '/feed'
];

// Cache configuration limits
const CACHE_LIMITS = {
  VENDOR: 50,
  APP: 100,
  API: 200,
  IMAGES: 500,
  DATA: 100,
  RUNTIME: 50
};

// Message handlers for communication with main thread
const MESSAGE_HANDLERS = new Map();

// Utility: Clean up old caches
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentCaches = Object.values(CACHES);
  
  return Promise.all(
    cacheNames
      .filter(cacheName => !currentCaches.includes(cacheName))
      .map(cacheName => {
        console.log('[SW] Deleting old cache:', cacheName);
        return caches.delete(cacheName);
      })
  );
}

// Utility: Limit cache size
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    const deleteCount = keys.length - maxSize;
    const keysToDelete = keys.slice(0, deleteCount);
    
    console.log(`[SW] Trimming ${cacheName} cache: removing ${deleteCount} items`);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Utility: Add timestamp to response
function addTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-date', new Date().toISOString());
  headers.set('sw-cache-version', CACHE_VERSION);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Utility: Check if cached response is stale
function isStale(response, maxAge) {
  const cachedDate = response.headers.get('sw-cached-date');
  if (!cachedDate) return true;
  
  const age = Date.now() - new Date(cachedDate).getTime();
  return age > maxAge;
}

// Utility: Match URL against patterns
function matchesPattern(url, patterns) {
  return patterns.some(pattern => pattern.test(url));
}

// Strategy: Cache First (for vendor chunks and static assets)
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && !isStale(cachedResponse, maxAge)) {
    console.log('[SW] Cache hit (cache-first):', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, addTimestamp(networkResponse.clone()));
      await limitCacheSize(cacheName, CACHE_LIMITS[cacheName] || 100);
    }
    
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      console.log('[SW] Network failed, serving stale cache:', request.url);
      return cachedResponse;
    }
    throw error;
  }
}

// Strategy: Stale While Revalidate (for app chunks and API)
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // If we have a fresh cached response, return it immediately
  if (cachedResponse && !isStale(cachedResponse, maxAge)) {
    console.log('[SW] Cache hit (fresh):', request.url);
    
    // Still fetch in background to keep cache warm
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, addTimestamp(response.clone()));
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  // If we have a stale cached response, return it and revalidate
  if (cachedResponse) {
    console.log('[SW] Serving stale while revalidating:', request.url);
    
    // Revalidate in background
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, addTimestamp(response.clone()));
        limitCacheSize(cacheName, CACHE_LIMITS[cacheName] || 100);
        
        // Notify clients about the update
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CACHE_UPDATED',
              url: request.url
            });
          });
        });
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  // No cached response, fetch from network
  try {
    console.log('[SW] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, addTimestamp(networkResponse.clone()));
      await limitCacheSize(cacheName, CACHE_LIMITS[cacheName] || 100);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed:', request.url, error);
    throw error;
  }
}

// Strategy: Network First (for HTML pages)
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, addTimestamp(networkResponse.clone()));
      await limitCacheSize(cacheName, CACHE_LIMITS[cacheName] || 100);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache (offline):', request.url);
      return cachedResponse;
    }
    
    // If it's a navigation request and we're offline, serve the offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    throw error;
  }
}

// Prefetch routes for instant navigation
async function prefetchRoutes(routes) {
  console.log('[SW] Prefetching routes:', routes);
  
  const cache = await caches.open(CACHES.APP);
  
  // Fetch route chunks in parallel
  const fetchPromises = routes.map(async route => {
    try {
      const response = await fetch(route);
      if (response.ok) {
        await cache.put(route, addTimestamp(response.clone()));
      }
    } catch (error) {
      console.error('[SW] Failed to prefetch route: %s', route, error);
    }
  });
  
  await Promise.all(fetchPromises);
}

// Install event - cache static assets and vendor chunks
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      try {
        // Cache static assets
        const staticCache = await caches.open(CACHES.STATIC);
        await staticCache.addAll(STATIC_ASSETS);
        console.log('[SW] Static assets cached');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Installation failed:', error);
      }
    })()
  );
});

// Activate event - cleanup and claim clients
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker v' + CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        await cleanupOldCaches();
        
        // Take control of all clients
        await self.clients.claim();
        
        // Prefetch critical routes after activation
        setTimeout(() => {
          prefetchRoutes(PREFETCH_ROUTES);
        }, 1000);
        
        console.log('[SW] Service worker activated');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - handle requests with appropriate strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip hot-reload and dev server requests
  if (url.pathname.includes('__vite') || url.pathname.includes('@vite')) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Check vendor chunks first (most cacheable)
    if (matchesPattern(url.pathname, CACHE_STRATEGIES.VENDOR.patterns)) {
      return await cacheFirst(
        request,
        CACHES.VENDOR,
        CACHE_STRATEGIES.VENDOR.maxAge
      );
    }
    
    // App chunks and CSS
    if (matchesPattern(url.pathname, CACHE_STRATEGIES.APP.patterns)) {
      return await staleWhileRevalidate(
        request,
        CACHES.APP,
        CACHE_STRATEGIES.APP.maxAge
      );
    }
    
    // API requests
    if (matchesPattern(url.href, CACHE_STRATEGIES.API.patterns)) {
      return await staleWhileRevalidate(
        request,
        CACHES.API,
        CACHE_STRATEGIES.API.maxAge
      );
    }
    
    // Images
    if (matchesPattern(url.href, CACHE_STRATEGIES.IMAGES.patterns)) {
      return await cacheFirst(
        request,
        CACHES.IMAGES,
        CACHE_STRATEGIES.IMAGES.maxAge
      );
    }
    
    // HTML pages - network first
    if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
      return await networkFirst(request, CACHES.RUNTIME);
    }
    
    // Default: try network, fallback to cache
    return await fetch(request);
    
  } catch (error) {
    console.error('[SW] Request failed:', request.url, error);
    
    // Try to find something in cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For navigation, serve offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // Return error response
    return new Response('Network error', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Message event - handle communication from main thread
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'PREFETCH_ROUTE':
      // Prefetch a specific route
      if (data && data.route) {
        prefetchRoutes([data.route]);
      }
      break;
      
    case 'PREFETCH_RESOURCES':
      // Prefetch multiple resources
      if (data && data.resources) {
        const cache = caches.open(CACHES.APP);
        cache.then(c => {
          data.resources.forEach(resource => {
            fetch(resource).then(response => {
              if (response.ok) {
                c.put(resource, addTimestamp(response.clone()));
              }
            }).catch(() => {});
          });
        });
      }
      break;
      
    case 'CLEAR_CACHE':
      // Clear specific cache or all caches
      if (data && data.cacheName) {
        caches.delete(data.cacheName);
      } else {
        cleanupOldCaches();
      }
      break;
      
    case 'CACHE_STATUS':
      // Report cache status back to client
      event.ports[0].postMessage({
        version: CACHE_VERSION,
        caches: Object.keys(CACHES)
      });
      break;
  }
});

// Background sync for failed requests
if ('sync' in self.registration) {
  self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
      event.waitUntil(handleBackgroundSync());
    }
  });
}

async function handleBackgroundSync() {
  console.log('[SW] Background sync triggered');
  
  // Get all clients
  const clients = await self.clients.matchAll();
  
  // Notify clients that sync is happening
  clients.forEach(client => {
    client.postMessage({
      type: 'BACKGROUND_SYNC',
      status: 'started'
    });
  });
  
  // Here you could retry failed API requests, sync offline changes, etc.
  
  // Notify completion
  clients.forEach(client => {
    client.postMessage({
      type: 'BACKGROUND_SYNC',
      status: 'completed'
    });
  });
}

// Log cache statistics periodically
if (typeof self.setInterval !== 'undefined') {
  setInterval(async () => {
    const cacheNames = await caches.keys();
    console.log('[SW] Active caches:', cacheNames);
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      console.log(`[SW] ${cacheName}: ${keys.length} items`);
    }
  }, 60000); // Every minute in dev
}