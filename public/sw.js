// Enhanced Service Worker for contributor.info PWA
// Version 2.2.1 - Fixed 206 partial content caching issue
const CACHE_VERSION = '2.2.1';
const CACHE_NAME = `contributor-info-v${CACHE_VERSION}`;
const STATIC_CACHE = `static-v${CACHE_VERSION}`;
const API_CACHE = `api-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-v${CACHE_VERSION}`;
const IMAGES_CACHE = `images-v${CACHE_VERSION}`;
const DATA_CACHE = `data-v${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/social.webp',
  '/social.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png'
];

// Cache configuration
const CACHE_CONFIG = {
  // Cache for 7 days
  API_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  // Cache for 30 days
  STATIC_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
  // Cache for 24 hours
  RUNTIME_MAX_AGE: 24 * 60 * 60 * 1000,
  // Maximum entries per cache
  MAX_ENTRIES: {
    API: 100,
    RUNTIME: 200,
    IMAGES: 300
  }
};

// Utility functions
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentCaches = [CACHE_NAME, STATIC_CACHE, API_CACHE, RUNTIME_CACHE, IMAGES_CACHE, DATA_CACHE];
  
  return Promise.all(
    cacheNames
      .filter(cacheName => !currentCaches.includes(cacheName))
      .map(cacheName => caches.delete(cacheName))
  );
}

async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    const oldestKeys = keys.slice(0, keys.length - maxSize);
    await Promise.all(oldestKeys.map(key => cache.delete(key)));
  }
}

function isExpired(response, maxAge) {
  const cachedDate = new Date(response.headers.get('sw-cached-date') || 0);
  return Date.now() - cachedDate.getTime() > maxAge;
}

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        console.log('[SW] Caching static assets');
        await cache.addAll(STATIC_ASSETS);
        console.log('[SW] Static assets cached successfully');
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Failed to cache static assets:', error);
      }
    })()
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    (async () => {
      try {
        await cleanupOldCaches();
        console.log('[SW] Old caches cleaned up');
        await self.clients.claim();
        console.log('[SW] Service worker activated');
      } catch (error) {
        console.error('[SW] Failed to activate:', error);
      }
    })()
  );
});

// Enhanced fetch event with comprehensive caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(handleRequest(request, url));
});

async function handleRequest(request, url) {
  try {
    // GitHub API - Network first with cache fallback + freshness check
    if (url.hostname === 'api.github.com') {
      return await handleAPIRequest(request, API_CACHE, CACHE_CONFIG.API_MAX_AGE);
    }

    // Supabase API - Network first with aggressive caching for offline support
    if (url.hostname.includes('supabase.co')) {
      // Cache Supabase data for longer periods for offline functionality
      return await handleSupabaseRequest(request, DATA_CACHE);
    }

    // Avatar images - Cache first with long-term storage
    if (url.hostname === 'avatars.githubusercontent.com' || url.pathname.includes('avatar')) {
      return await handleImageRequest(request, IMAGES_CACHE);
    }

    // Static assets (CSS, images) - Cache first with update in background
    // IMPORTANT: Exclude JS modules to prevent MIME type issues
    if (url.origin === self.location.origin) {
      // Don't cache JavaScript modules - they need proper MIME types
      const isJavaScript = /\.js(\?.*)?$/.test(url.pathname);
      if (isJavaScript) {
        // Always fetch JS files fresh to ensure correct MIME type
        return fetch(request);
      }
      
      const isStaticAsset = /\.(css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)(\?.*)?$/.test(url.pathname);
      
      if (isStaticAsset) {
        return await handleStaticAsset(request, STATIC_CACHE);
      }
      
      // HTML pages - Network first with cache fallback
      return await handlePageRequest(request, RUNTIME_CACHE);
    }

    // External resources - Cache with limited lifetime
    return await handleExternalRequest(request, RUNTIME_CACHE);

  } catch (error) {
    console.error('[SW] Error handling request:', error);
    return await handleOfflineFallback(request);
  }
}

async function handleSupabaseRequest(request, cacheName) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Only cache successful responses that are NOT partial content (206)
    if (networkResponse.ok && networkResponse.status !== 206) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      
      // Add timestamp for freshness check
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const modifiedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers
      });
      
      try {
        await cache.put(request, modifiedResponse);
        // Limit cache size
        await limitCacheSize(cacheName, CACHE_CONFIG.MAX_ENTRIES.API);
      } catch (cacheError) {
        // Log but don't throw - caching is a nice-to-have, not critical
        console.warn('[SW] Could not cache Supabase response:', cacheError.message);
      }
    } else if (networkResponse.status === 206) {
      // Skip caching for partial content (206) responses
      // These are typically range requests that shouldn't be cached
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving Supabase data from cache (offline):', request.url);
      // Return cached data even if expired when offline
      return cachedResponse;
    }
    
    // If no cached version and it's critical data, return empty response
    const url = new URL(request.url);
    if (url.pathname.includes('/rest/v1/')) {
      console.log('[SW] Returning empty data for offline Supabase request:', request.url);
      return new Response(JSON.stringify([]), {
        status: 200,
        statusText: 'OK (Offline)',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Response': 'true'
        }
      });
    }
    
    throw error;
  }
}

async function handleAPIRequest(request, cacheName, maxAge) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      
      // Add timestamp for freshness check
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const modifiedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers
      });
      
      await cache.put(request, modifiedResponse);
      
      // Limit cache size
      await limitCacheSize(cacheName, CACHE_CONFIG.MAX_ENTRIES.API);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
      console.log('[SW] Serving from API cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

async function handleImageRequest(request, cacheName) {
  // Cache first for images
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving image from cache:', request.url);
    
    // Update in background if old
    if (isExpired(cachedResponse, CACHE_CONFIG.STATIC_MAX_AGE)) {
      fetch(request).then(response => {
        if (response.ok) {
          caches.open(cacheName).then(cache => {
            const headers = new Headers(response.headers);
            headers.set('sw-cached-date', new Date().toISOString());
            
            const modifiedResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers
            });
            
            cache.put(request, modifiedResponse);
          });
        }
      }).catch(() => {});
    }
    
    return cachedResponse;
  }
  
  // Not in cache, fetch and cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const modifiedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers
      });
      
      await cache.put(request, modifiedResponse);
      await limitCacheSize(cacheName, CACHE_CONFIG.MAX_ENTRIES.IMAGES);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch image:', error);
    throw error;
  }
}

async function handleStaticAsset(request, cacheName) {
  // Cache first for static assets
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving static asset from cache:', request.url);
    return cachedResponse;
  }
  
  // Not in cache, fetch and cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', error);
    throw error;
  }
}

async function handlePageRequest(request, cacheName) {
  try {
    // Network first for HTML pages
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const modifiedResponse = new Response(await networkResponse.clone().text(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      
      await cache.put(request, modifiedResponse);
      await limitCacheSize(cacheName, CACHE_CONFIG.MAX_ENTRIES.RUNTIME);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving page from cache (offline):', request.url);
      return cachedResponse;
    }
    
    // If no cached version and it's a navigation request, serve offline page
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

async function handleExternalRequest(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const modifiedResponse = new Response(await networkResponse.clone().blob(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      
      await cache.put(request, modifiedResponse);
      await limitCacheSize(cacheName, CACHE_CONFIG.MAX_ENTRIES.RUNTIME);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_CONFIG.RUNTIME_MAX_AGE)) {
      console.log('[SW] Serving external resource from cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

async function handleOfflineFallback(request) {
  // For navigation requests, try to serve the main page
  if (request.mode === 'navigate') {
    const cachedPage = await caches.match('/');
    if (cachedPage) {
      return cachedPage;
    }
  }
  
  // For images, return a placeholder if available
  if (request.destination === 'image') {
    const placeholder = await caches.match('/icons/icon-192x192.png');
    if (placeholder) {
      return placeholder;
    }
  }
  
  // Return a simple offline response
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Background sync for failed requests (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
      event.waitUntil(handleBackgroundSync());
    }
  });
}

async function handleBackgroundSync() {
  console.log('[SW] Background sync triggered');
  // Implement background sync logic here
  // This could retry failed API requests, sync offline data, etc.
}

// Push notifications (if needed)
self.addEventListener('push', event => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'contributor-info-notification'
    };
    
    event.waitUntil(
      self.registration.showNotification('Contributor Info', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});