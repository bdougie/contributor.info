/**
 * Service Worker Client Integration
 * Handles communication with the enhanced service worker for optimal caching
 */

interface CacheStatus {
  version: string;
  caches: string[];
}

interface BackgroundSyncEvent {
  type: 'BACKGROUND_SYNC';
  status: 'started' | 'completed';
}

interface CacheUpdateEvent {
  type: 'CACHE_UPDATED';
  url: string;
}

type ServiceWorkerMessage = BackgroundSyncEvent | CacheUpdateEvent;

class ServiceWorkerClient {
  private sw: ServiceWorker | null = null;
  private messageHandlers: Map<string, Function[]> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private prefetchTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    // Only initialize in browser environment, not in tests
    // Check for process.env safely to avoid ReferenceError
    const isVitest = typeof process !== 'undefined' && process.env?.VITEST;
    if (typeof window !== 'undefined' && !isVitest) {
      this.init();
    }
  }

  /**
   * Initialize service worker and set up event listeners
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Client] Service Worker not supported');
      return;
    }

    try {
      // Register the enhanced service worker
      const registration = await navigator.serviceWorker.register('/sw-enhanced.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for updates
      });

      console.log('[SW Client] Service Worker registered:', registration);

      // Check for updates every hour
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000,
      );

      // Handle controller change (new version activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Client] New service worker activated');
        this.notifyUpdate();
      });

      // Set up message listener
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event._data as ServiceWorkerMessage);
      });

      // Get the active service worker
      if (registration.active) {
        this.sw = registration.active;
      } else if (registration.installing) {
        this.sw = registration.installing;
      } else if (registration.waiting) {
        this.sw = registration.waiting;
      }

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      this.sw = navigator.serviceWorker.controller;
    } catch (_error) {
      console.error('[SW Client] Registration failed:', _error);
    }
  }

  /**
   * Handle messages from the service worker
   */
  private handleMessage(message: ServiceWorkerMessage) {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach((handler) => handler(message));

    // Default handlers
    switch (message.type) {
      case 'CACHE_UPDATED':
        console.log('[SW Client] Cache updated for:', (message as CacheUpdateEvent).url);
        break;
      case 'BACKGROUND_SYNC':
        console.log('[SW Client] Background sync:', (message as BackgroundSyncEvent).status);
        break;
    }
  }

  /**
   * Register a message handler
   */
  public on(type: string, handler: Function) {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  /**
   * Send a message to the service worker
   */
  private postMessage(message: unknown) {
    if (this.sw) {
      this.sw.postMessage(message);
    }
  }

  /**
   * Prefetch a route for instant navigation
   */
  public prefetchRoute(route: string) {
    // Add to queue for batch processing
    this.prefetchQueue.add(route);

    // Debounce the actual prefetch
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
    }

    this.prefetchTimer = setTimeout(() => {
      this.processPrefetchQueue();
    }, 100);
  }

  /**
   * Process the prefetch queue
   */
  private processPrefetchQueue() {
    if (this.prefetchQueue.size === 0) return;

    const routes = Array.from(this.prefetchQueue);
    this.prefetchQueue.clear();

    // Get the route chunks that need to be prefetched
    const resources = this.getRouteResources(routes);

    this.postMessage({
      type: 'PREFETCH_RESOURCES',
      data: { resources },
    });

    console.log('[SW Client] Prefetching resources:', resources);
  }

  /**
   * Get the resources needed for routes
   */
  private getRouteResources(routes: string[]): string[] {
    const resources: string[] = [];

    routes.forEach((route) => {
      // Map routes to their chunk files
      // This should match your actual chunk naming
      switch (route) {
        case '/changelog':
          resources.push('/js/changelog-page.js');
          break;
        case '/docs':
          resources.push('/js/docs-list.js');
          break;
        case '/feed':
          resources.push('/js/feed-page.js');
          break;
        case '/settings':
          resources.push('/js/settings-page.js');
          break;
        default:
          // For dynamic routes, prefetch the main route chunk
          if (route.match(/^\/[\w-]+\/[\w-]+$/)) {
            resources.push('/js/repo-view.js');
          }
      }
    });

    return resources;
  }

  /**
   * Prefetch resources for likely next navigations
   */
  public prefetchResources(resources: string[]) {
    this.postMessage({
      type: 'PREFETCH_RESOURCES',
      data: { resources },
    });
  }

  /**
   * Clear cache (useful for debugging or updates)
   */
  public clearCache(cacheName?: string) {
    this.postMessage({
      type: 'CLEAR_CACHE',
      data: { cacheName },
    });
  }

  /**
   * Get cache status
   */
  public async getCacheStatus(): Promise<CacheStatus | null> {
    if (!this.sw) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event._data as CacheStatus);
      };

      this.sw?.postMessage({ type: 'CACHE_STATUS' }, [messageChannel.port2]);

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * Notify about app update
   */
  private notifyUpdate() {
    // You can show a toast or banner here
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('App Updated', {
        body: 'A new version of Contributor.info is available. Refresh to update.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
      });
    }
  }

  /**
   * Request notification permission
   */
  public async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Check if we're online
   */
  public isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Register online/offline event handlers
   */
  public onConnectionChange(handler: (online: boolean) => void) {
    window.addEventListener('online', () => handler(true));
    window.addEventListener('offline', () => handler(false));
  }
}

// Create singleton instance
export const swClient = new ServiceWorkerClient();

// Export hooks for React components
export function usePrefetchRoute() {
  return (route: string) => {
    swClient.prefetchRoute(route);
  };
}

export function useServiceWorkerStatus() {
  const [status, setStatus] = useState<CacheStatus | null>(null);

  useEffect(() => {
    swClient.getCacheStatus().then(setStatus);
  }, []);

  return status;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    swClient.onConnectionChange(setIsOnline);
  }, []);

  return isOnline;
}

// Helper to prefetch on hover/focus
export function usePrefetchOnInteraction(route: string) {
  const prefetch = usePrefetchRoute();
  let prefetched = false;

  const handleInteraction = () => {
    if (!prefetched) {
      prefetch(route);
      prefetched = true;
    }
  };

  return {
    onMouseEnter: handleInteraction,
    onFocus: handleInteraction,
    onTouchStart: handleInteraction,
  };
}

import { useState, useEffect } from 'react';
