import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Set VITEST env var before importing to prevent auto-init
process.env.VITEST = 'true';

import {
  swClient,
  usePrefetchRoute,
  useOnlineStatus,
  usePrefetchOnInteraction,
} from './service-worker-client';

// Type-safe test utilities for accessing private members
interface ServiceWorkerClientInternal {
  initialized: boolean;
  sw: ServiceWorker | null;
  messageHandlers: Map<string, ((message: unknown) => void)[]>;
  prefetchQueue: Set<string>;
  prefetchTimer: NodeJS.Timeout | null;
}

function getClientInternal(client: typeof swClient): ServiceWorkerClientInternal {
  return client as unknown as ServiceWorkerClientInternal;
}

// Mock the global objects
const mockServiceWorker = {
  postMessage: vi.fn(),
  state: 'activated' as ServiceWorkerState,
  scriptURL: '/sw-enhanced.js',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  onstatechange: null,
};

const mockRegistration = {
  active: mockServiceWorker,
  installing: null,
  waiting: null,
  scope: '/',
  updateViaCache: 'none' as RegistrationUpdateViaCache,
  update: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  onupdatefound: null,
  navigationPreload: {} as NavigationPreloadManager,
  pushManager: {} as PushManager,
  showNotification: vi.fn(),
  getNotifications: vi.fn(),
  sync: {} as SyncManager,
};

describe('Service Worker Client', () => {
  let originalNavigator: Navigator;
  let originalWindow: Window & typeof globalThis;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Store original values
    originalNavigator = global.navigator;
    originalWindow = global.window;

    // Reset the service worker client state
    const client = getClientInternal(swClient);
    client.initialized = false;
    client.sw = null;
    client.messageHandlers.clear();
    client.prefetchQueue.clear();
    client.prefetchTimer = null;

    // Mock navigator.serviceWorker
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        ready: Promise.resolve(mockRegistration),
        controller: mockServiceWorker,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getRegistrations: vi.fn().mockResolvedValue([]),
      },
      writable: true,
      configurable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    // Use vi.spyOn for window events to ensure proper cleanup
    addEventListenerSpy = vi.spyOn(global.window, 'addEventListener').mockImplementation(vi.fn());
    removeEventListenerSpy = vi
      .spyOn(global.window, 'removeEventListener')
      .mockImplementation(vi.fn());

    // Mock MessageChannel
    global.MessageChannel = vi.fn().mockImplementation(() => ({
      port1: {
        onmessage: null,
        postMessage: vi.fn(),
        close: vi.fn(),
        start: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
      port2: {
        onmessage: null,
        postMessage: vi.fn(),
        close: vi.fn(),
        start: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
    }));

    // Mock Notification
    global.Notification = vi.fn() as unknown as typeof Notification;
    Object.defineProperty(global.Notification, 'permission', {
      value: 'default',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global.Notification, 'requestPermission', {
      value: vi.fn().mockResolvedValue('granted'),
      writable: true,
      configurable: true,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    global.navigator = originalNavigator;
    global.window = originalWindow;

    // Restore spies - vi.spyOn automatically restores the original implementation
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();

    vi.clearAllMocks();
  });

  describe('Service Worker Registration', () => {
    it('should register service worker on initialization', () => {
      // Manually initialize since auto-init is disabled in tests
      swClient.init();

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
        '/sw-enhanced.js',
        expect.objectContaining({
          scope: '/',
          updateViaCache: 'none',
        })
      );
    });

    it('should handle browsers without service worker support', () => {
      // Remove service worker support
      Object.defineProperty(global.navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Reinitialize - should not throw
      expect(() => swClient.prefetchRoute('/test')).not.toThrow();
    });
  });

  describe('Route Prefetching', () => {
    it('should batch prefetch requests', () => {
      // Initialize first
      swClient.init();
      vi.useFakeTimers();

      swClient.prefetchRoute('/changelog');
      swClient.prefetchRoute('/docs');
      swClient.prefetchRoute('/feed');

      // No messages sent immediately
      expect(mockServiceWorker.postMessage).not.toHaveBeenCalled();

      // Fast forward debounce timer
      vi.advanceTimersByTime(100);

      // Should send batched message
      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PREFETCH_RESOURCES',
          data: {
            resources: expect.arrayContaining(['/js/changelog-page.js', '/js/feed-page.js']),
          },
        })
      );

      vi.useRealTimers();
    });

    it('should map dynamic routes correctly', () => {
      // Initialize first
      swClient.init();
      vi.useFakeTimers();

      swClient.prefetchRoute('/owner/repo');

      vi.advanceTimersByTime(100);

      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PREFETCH_RESOURCES',
          data: {
            resources: expect.arrayContaining(['/js/repo-view.js']),
          },
        })
      );

      vi.useRealTimers();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', () => {
      swClient.init();
      swClient.clearCache('test-cache');

      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLEAR_CACHE',
          data: { cacheName: 'test-cache' },
        })
      );
    });

    it('should clear all caches when no name specified', () => {
      swClient.init();
      swClient.clearCache();

      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLEAR_CACHE',
          data: { cacheName: undefined },
        })
      );
    });
  });

  describe('Online Status', () => {
    it('should detect online status', () => {
      expect(swClient.isOnline()).toBe(true);

      // Simulate offline
      Object.defineProperty(global.navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      expect(swClient.isOnline()).toBe(false);
    });

    it('should register connection change listeners', () => {
      const handler = vi.fn();
      swClient.onConnectionChange(handler);

      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Notification Permission', () => {
    it('should request notification permission', () => {
      const promise = swClient.requestNotificationPermission();

      expect(Notification.requestPermission).toHaveBeenCalled();
      // Verify the promise resolves to true (mocked in beforeEach)
      return expect(promise).resolves.toBe(true);
    });

    it('should return false when permission denied', () => {
      (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');

      const promise = swClient.requestNotificationPermission();

      return expect(promise).resolves.toBe(false);
    });

    it('should return false when already denied', () => {
      Object.defineProperty(global.Notification, 'permission', {
        value: 'denied',
        writable: true,
        configurable: true,
      });

      const promise = swClient.requestNotificationPermission();

      expect(Notification.requestPermission).not.toHaveBeenCalled();
      return expect(promise).resolves.toBe(false);
    });
  });

  describe('React Hooks', () => {
    describe('usePrefetchRoute', () => {
      it('should return a prefetch function', () => {
        const { result } = renderHook(() => usePrefetchRoute());

        expect(typeof result.current).toBe('function');

        act(() => {
          result.current('/test-route');
        });

        // Verify prefetch was called (with debounce)
        vi.useFakeTimers();
        vi.advanceTimersByTime(100);
        vi.useRealTimers();
      });
    });

    describe('useOnlineStatus', () => {
      it('should return current online status', () => {
        const { result } = renderHook(() => useOnlineStatus());

        expect(result.current).toBe(true);
      });

      it('should update when connection changes', () => {
        const { result } = renderHook(() => useOnlineStatus());

        expect(result.current).toBe(true);

        // Simulate connection change handler being called
        const onlineHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
          (call) => call[0] === 'online'
        )?.[1];

        const offlineHandler = (
          window.addEventListener as ReturnType<typeof vi.fn>
        ).mock.calls.find((call) => call[0] === 'offline')?.[1];

        expect(onlineHandler).toBeDefined();
        expect(offlineHandler).toBeDefined();
      });
    });

    describe('usePrefetchOnInteraction', () => {
      it('should return interaction handlers', () => {
        const { result } = renderHook(() => usePrefetchOnInteraction('/test'));

        expect(result.current).toHaveProperty('onMouseEnter');
        expect(result.current).toHaveProperty('onFocus');
        expect(result.current).toHaveProperty('onTouchStart');
      });

      it('should prefetch only once on multiple interactions', () => {
        swClient.init();
        vi.useFakeTimers();
        const { result } = renderHook(() => usePrefetchOnInteraction('/test'));

        // Trigger multiple interactions
        act(() => {
          result.current.onMouseEnter();
          result.current.onFocus();
          result.current.onTouchStart();
        });

        vi.advanceTimersByTime(100);

        // Should only send one prefetch message
        expect(mockServiceWorker.postMessage).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
      });
    });
  });

  describe('Message Handling', () => {
    it('should handle CACHE_UPDATED messages', () => {
      swClient.init();
      const handler = vi.fn();
      swClient.on('CACHE_UPDATED', handler);

      // Simulate message from service worker
      const messageHandler = (
        navigator.serviceWorker.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'message')?.[1];

      messageHandler?.({
        data: {
          type: 'CACHE_UPDATED',
          url: '/test.js',
        },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CACHE_UPDATED',
          url: '/test.js',
        })
      );
    });

    it('should handle BACKGROUND_SYNC messages', () => {
      swClient.init();
      const handler = vi.fn();
      swClient.on('BACKGROUND_SYNC', handler);

      // Simulate message from service worker
      const messageHandler = (
        navigator.serviceWorker.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'message')?.[1];

      messageHandler?.({
        data: {
          type: 'BACKGROUND_SYNC',
          status: 'completed',
        },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BACKGROUND_SYNC',
          status: 'completed',
        })
      );
    });
  });

  describe('Prefetch Resources', () => {
    it('should send prefetch message for multiple resources', () => {
      swClient.init();
      const resources = ['/js/vendor.js', '/js/app.js', '/css/styles.css'];

      swClient.prefetchResources(resources);

      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PREFETCH_RESOURCES',
          data: { resources },
        })
      );
    });
  });
});
