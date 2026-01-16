/**
 * Lazy-loaded Sentry integration
 * Non-blocking error tracking that won't impact page load performance
 */

import { env } from './env';

let sentryLoaded = false;
let sentryInitialized = false;
let sentryLoadPromise: Promise<typeof import('@sentry/react')> | null = null;

/**
 * Lazy load and initialize Sentry
 * This runs asynchronously and won't block the main thread
 */
export async function lazyInitSentry() {
  // Prevent duplicate initialization (guard against React StrictMode double-mounting)
  if (sentryInitialized) {
    return sentryLoadPromise;
  }
  sentryInitialized = true;

  // Skip in local environment for production builds
  // Allow in development for testing
  const isLocal = import.meta.env.PROD && window.location.hostname === 'localhost';
  if (isLocal) {
    console.log('[Sentry] Skipped - local environment detected');
    return;
  }

  // Only load once
  if (sentryLoaded || sentryLoadPromise) {
    return sentryLoadPromise;
  }

  sentryLoadPromise = import('@sentry/react')
    .then((Sentry) => {
      // Use the DSN from environment
      const sentryDsn = env.SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN;

      if (!sentryDsn) {
        console.log('[Sentry] Initialization skipped (no DSN)');
        return Sentry;
      }

      Sentry.init({
        dsn: sentryDsn,
        integrations: [
          // Minimal integrations for performance
          Sentry.browserTracingIntegration(),
        ],
        // Lower sample rates for performance
        tracesSampleRate: 0.1,
        // No session replay by default (heavy on performance)
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0, // Can enable later if needed
        environment: import.meta.env.PROD ? 'production' : 'development',
        sendDefaultPii: true,
        // Filter out noise
        ignoreErrors: [
          'ResizeObserver loop',
          'Non-Error promise rejection',
          'NetworkError',
          'Failed to fetch',
          'AbortError',
          'chrome-extension://',
          'moz-extension://',
        ],
        // Minimal processing to avoid blocking
        beforeSend(event) {
          // Quick filter for extensions
          if (event.request?.url?.includes('extension://')) {
            return null;
          }
          return event;
        },
      });

      sentryLoaded = true;
      console.log('[Sentry] Successfully initialized');
      return Sentry;
    })
    .catch((error) => {
      console.error('Failed to load Sentry:', error);
      sentryInitialized = false; // Reset guard to allow retries
      sentryLoadPromise = null; // Reset promise to allow retries
      throw error;
    });

  return sentryLoadPromise;
}

/**
 * Queue for errors that occur before Sentry is loaded
 */
const errorQueue: Array<{
  error: Error | unknown;
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  };
}> = [];

/**
 * Capture an exception (non-blocking)
 * Queues errors if Sentry isn't loaded yet
 */
export function captureException(
  error: Error | unknown,
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  // Don't wait for this - fire and forget
  (async () => {
    try {
      if (!sentryLoaded) {
        // Queue the error
        errorQueue.push({ error, context });

        // Start loading Sentry if not already loading
        if (!sentryLoadPromise) {
          lazyInitSentry().then((Sentry) => {
            // Process queued errors
            while (errorQueue.length > 0) {
              const item = errorQueue.shift();
              if (item && Sentry) {
                Sentry.captureException(item.error, item.context);
              }
            }
          });
        }
        return;
      }

      // Sentry is loaded, capture directly
      const Sentry = await import('@sentry/react');
      if (Sentry) {
        Sentry.captureException(error, context);
      }
    } catch {
      // Silently fail - don't let error tracking break the app
    }
  })();
}

/**
 * Capture a message (non-blocking)
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info'
) {
  // Fire and forget
  (async () => {
    try {
      const Sentry = await lazyInitSentry();
      if (Sentry) {
        Sentry.captureMessage(message, level);
      }
    } catch {
      // Silently fail
    }
  })();
}

/**
 * Add breadcrumb (non-blocking)
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  // Fire and forget
  (async () => {
    try {
      const Sentry = await lazyInitSentry();
      if (Sentry) {
        Sentry.addBreadcrumb({
          message,
          category,
          level: 'info',
          timestamp: Date.now() / 1000,
          data,
        });
      }
    } catch {
      // Silently fail
    }
  })();
}

/**
 * Initialize Sentry after page load
 * Call this from main.tsx after the app is mounted
 */
export function initSentryAfterLoad() {
  // Use requestIdleCallback for optimal performance
  // Falls back to setTimeout for older browsers
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        lazyInitSentry();
      },
      { timeout: 5000 }
    );
  } else {
    setTimeout(() => {
      lazyInitSentry();
    }, 2000);
  }
}

/**
 * Set up global error handlers (lightweight, non-blocking)
 */
export function setupGlobalErrorHandlers() {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, {
      level: 'error',
      tags: { type: 'unhandled_rejection' },
    });
  });

  // Global errors
  window.addEventListener('error', (event) => {
    captureException(event.error || event.message, {
      level: 'error',
      tags: {
        type: 'global_error',
        filename: event.filename || 'unknown',
      },
      extra: {
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}
