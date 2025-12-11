/**
 * Sentry error tracking for Supabase Edge Functions
 *
 * Provides centralized error tracking and monitoring for all edge functions.
 * Initialize once at module load, then use captureException/captureMessage
 * to report errors to Sentry.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/deno/
 */

import * as Sentry from 'https://esm.sh/@sentry/deno@8.55.0';

// Track initialization state
let isInitialized = false;

/**
 * Get the Sentry DSN from environment variables
 */
function getSentryDsn(): string | undefined {
  return Deno.env.get('SENTRY_DSN');
}

/**
 * Get the current environment (production, staging, local)
 */
function getEnvironment(): string {
  const env = Deno.env.get('VITE_ENV') || Deno.env.get('DENO_ENV');
  if (env === 'local' || env === 'development') return 'development';
  if (env === 'staging') return 'staging';
  return 'production';
}

/**
 * Initialize Sentry for edge functions
 * Safe to call multiple times - will only initialize once
 */
export function initSentry(): boolean {
  if (isInitialized) {
    return true;
  }

  const dsn = getSentryDsn();
  if (!dsn) {
    console.warn('[sentry] SENTRY_DSN not configured - error tracking disabled');
    return false;
  }

  const environment = getEnvironment();

  try {
    Sentry.init({
      dsn,
      environment,
      // Sample rate for error events (1.0 = 100%)
      sampleRate: 1.0,
      // Sample rate for performance monitoring (0.1 = 10% in production)
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      // Don't send PII by default
      sendDefaultPii: false,
      // Attach stack traces to messages
      attachStacktrace: true,
      // Filter events in production - allow exceptions and explicit messages
      beforeSend(event) {
        // In production, only send events with exceptions or explicit messages
        // This filters out noise while allowing captureException() and captureMessage()
        if (environment === 'production' && !event.exception && !event.message) {
          return null;
        }
        return event;
      },
    });

    isInitialized = true;
    console.log('[sentry] Initialized for environment: %s', environment);
    return true;
  } catch (error) {
    console.error('[sentry] Failed to initialize: %s', error);
    return false;
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

/**
 * Capture an exception and send to Sentry
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!isInitialized) {
    console.error('[sentry] Not initialized - error not reported:', error);
    return undefined;
  }

  const eventId = Sentry.captureException(error, {
    extra: context,
  });

  return eventId;
}

/**
 * Capture a message and send to Sentry
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>,
): string | undefined {
  if (!isInitialized) {
    console.warn('[sentry] Not initialized - message not reported:', message);
    return undefined;
  }

  const eventId = Sentry.captureMessage(message, {
    level,
    extra: context,
  });

  return eventId;
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id?: string; email?: string; username?: string } | null): void {
  if (!isInitialized) return;
  Sentry.setUser(user);
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  if (!isInitialized) return;
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set a tag for filtering in Sentry
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) return;
  Sentry.setTag(key, value);
}

/**
 * Set extra context data
 */
export function setExtra(key: string, value: unknown): void {
  if (!isInitialized) return;
  Sentry.setExtra(key, value);
}

/**
 * Flush pending events (useful before function termination)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  if (!isInitialized) return true;
  return await Sentry.flush(timeout);
}

/**
 * Wrapper for edge function handlers with automatic error capture
 *
 * @example
 * ```ts
 * import { withSentry } from '../_shared/sentry.ts';
 *
 * Deno.serve(withSentry('my-function', async (req) => {
 *   // Your handler code
 *   return new Response('OK');
 * }));
 * ```
 */
export function withSentry(
  functionName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  // Initialize Sentry when wrapper is created
  initSentry();

  return async (req: Request): Promise<Response> => {
    // Use withScope to isolate context per request (prevents race conditions)
    return await Sentry.withScope(async (scope) => {
      // Set function context within isolated scope
      scope.setTag('edge_function', functionName);
      scope.addBreadcrumb({
        message: `Request to ${functionName}`,
        category: 'http',
        level: 'info',
        data: {
          url: req.url,
          method: req.method,
        },
      });

      try {
        const response = await handler(req);
        return response;
      } catch (error) {
        // Capture the error with context (scope is already isolated)
        Sentry.captureException(error, {
          extra: {
            function_name: functionName,
            request_url: req.url,
            request_method: req.method,
          },
        });

        // Ensure error is flushed before response
        await flush();

        // Re-throw to let the caller handle the response
        throw error;
      }
    });
  };
}

/**
 * Wrapper specifically for Inngest function steps
 * Captures errors with Inngest-specific context
 * Uses isolated scope to prevent race conditions in concurrent requests
 */
export function captureInngestError(
  error: Error | unknown,
  context: {
    functionId: string;
    eventName?: string;
    stepName?: string;
    eventData?: Record<string, unknown>;
  },
): string | undefined {
  if (!isInitialized) {
    initSentry();
  }

  // Use withScope to isolate tags per capture (prevents race conditions)
  let eventId: string | undefined;
  Sentry.withScope((scope) => {
    scope.setTag('inngest_function', context.functionId);
    if (context.eventName) {
      scope.setTag('inngest_event', context.eventName);
    }
    if (context.stepName) {
      scope.setTag('inngest_step', context.stepName);
    }

    eventId = Sentry.captureException(error, {
      extra: {
        inngest_function_id: context.functionId,
        inngest_event_name: context.eventName,
        inngest_step_name: context.stepName,
        event_data: context.eventData,
      },
    });
  });

  return eventId;
}

// Auto-initialize when module is imported (if DSN is available)
initSentry();
