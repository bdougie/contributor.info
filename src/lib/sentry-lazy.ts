/**
 * Lazy-loaded Sentry integration
 * Non-blocking error tracking that won't impact page load performance
 *
 * Imports are destructured (never `import * as Sentry`) so Rollup can
 * tree-shake the SDK: a namespace import of '@sentry/browser' pulls replay,
 * feedback, and every other integration into the lazy chunk (#1815 Phase 3).
 */

import { env } from './env';

type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

interface SentryContext {
  level?: SentryLevel;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/** The only SDK surface this app uses — keep this narrow so the chunk stays small. */
interface SentryApi {
  captureException: (error: unknown, context?: SentryContext) => void;
  captureMessage: (message: string, level: SentryLevel) => void;
  addBreadcrumb: (breadcrumb: {
    message: string;
    category: string;
    level: SentryLevel;
    timestamp: number;
    data?: Record<string, unknown>;
  }) => void;
}

let sentryLoaded = false;
let sentryInitialized = false;
let sentryLoadPromise: Promise<SentryApi | null> | null = null;

/**
 * Lazy load and initialize Sentry
 * This runs asynchronously and won't block the main thread
 */
export async function lazyInitSentry(): Promise<SentryApi | null> {
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
    return null;
  }

  // Only load once
  if (sentryLoaded || sentryLoadPromise) {
    return sentryLoadPromise;
  }

  sentryLoadPromise = import('@sentry/browser')
    .then(
      ({ init, browserTracingIntegration, captureException, captureMessage, addBreadcrumb }) => {
        // Use the DSN from environment
        const sentryDsn = env.SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN;

        const api: SentryApi = {
          captureException: (error, context) => captureException(error, context),
          captureMessage: (message, level) => captureMessage(message, level),
          addBreadcrumb: (breadcrumb) => addBreadcrumb(breadcrumb),
        };

        if (!sentryDsn) {
          console.log('[Sentry] Initialization skipped (no DSN)');
          return api;
        }

        init({
          dsn: sentryDsn,
          integrations: [
            // Minimal integrations for performance
            browserTracingIntegration(),
          ],
          // Lower sample rates for performance
          tracesSampleRate: 0.1,
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
        // Log asynchronously to avoid blocking critical path
        queueMicrotask(() => {
          console.log('[Sentry] Successfully initialized');
        });
        return api;
      }
    )
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
  context?: SentryContext;
}> = [];

/**
 * Capture an exception (non-blocking)
 * Queues errors if Sentry isn't loaded yet
 */
export function captureException(error: Error | unknown, context?: SentryContext) {
  // Don't wait for this - fire and forget
  (async () => {
    try {
      if (!sentryLoaded) {
        // Queue the error
        errorQueue.push({ error, context });

        // Start loading Sentry if not already loading
        if (!sentryLoadPromise) {
          lazyInitSentry().then((sentry) => {
            // Process queued errors
            while (errorQueue.length > 0) {
              const item = errorQueue.shift();
              if (item && sentry) {
                sentry.captureException(item.error, item.context);
              }
            }
          });
        }
        return;
      }

      // Sentry is loaded, capture directly via the already-resolved API
      const sentry = await sentryLoadPromise;
      if (sentry) {
        sentry.captureException(error, context);
      }
    } catch {
      // Silently fail - don't let error tracking break the app
    }
  })();
}

/**
 * Capture a message (non-blocking)
 */
export function captureMessage(message: string, level: SentryLevel = 'info') {
  // Fire and forget
  (async () => {
    try {
      const sentry = await lazyInitSentry();
      if (sentry) {
        sentry.captureMessage(message, level);
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
      const sentry = await lazyInitSentry();
      if (sentry) {
        sentry.addBreadcrumb({
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
