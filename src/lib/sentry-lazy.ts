/**
 * Lazy-loaded Sentry integration
 * Non-blocking error tracking that won't impact page load performance
 */

import { env } from './env';

let sentryLoaded = false;
let sentryLoadPromise: Promise<typeof import('@sentry/react')> | null = null;

/**
 * Lazy load and initialize Sentry
 * This runs asynchronously and won't block the main thread
 */
export async function lazyInitSentry() {
  // Skip in local environment
  const isLocal = !import.meta.env.PROD || window.location.hostname === 'localhost';
  if (isLocal) {
    return;
  }

  // Only load once
  if (sentryLoaded || sentryLoadPromise) {
    return sentryLoadPromise;
  }

  sentryLoadPromise = import('@sentry/react').then((Sentry) => {
    const sentryDsn = env.SENTRY_DSN || 'https://bd5760e6d9e6a0d1fd34033a7068b1b1@o4510341999689728.ingest.us.sentry.io/4510342068436992';

    if (!sentryDsn) {
      console.log('Sentry initialization skipped (no DSN)');
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
    console.log('Sentry initialized (lazy-loaded)');
    return Sentry;
  }).catch((error) => {
    console.error('Failed to load Sentry:', error);
    throw error;
  });

  return sentryLoadPromise;
}

/**
 * Queue for errors that occur before Sentry is loaded
 */
const errorQueue: Array<{
  error: Error | unknown;
  context?: any;
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
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
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
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      lazyInitSentry();
    }, { timeout: 5000 });
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