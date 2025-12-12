/**
 * Sentry error tracking for Netlify Edge Functions
 *
 * Provides centralized error tracking and monitoring for all Netlify edge functions.
 * Initialize once at module load, then use captureException/captureMessage
 * to report errors to Sentry.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/deno/
 */

import * as Sentry from 'https://esm.sh/@sentry/deno@8.55.0';
import type { Context } from '@netlify/edge-functions';

// Track initialization state
let isInitialized = false;

/**
 * Get the Sentry DSN from environment variables
 */
function getSentryDsn(): string | undefined {
  return Deno.env.get('SENTRY_DSN');
}

/**
 * Get the current environment (production, staging, development)
 */
function getEnvironment(): string {
  const env = Deno.env.get('CONTEXT') || Deno.env.get('NETLIFY_ENV');
  if (env === 'dev' || env === 'development') return 'development';
  if (env === 'branch-deploy' || env === 'deploy-preview') return 'staging';
  return 'production';
}

/**
 * Initialize Sentry for Netlify edge functions
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
      // Tag as Netlify edge function
      initialScope: {
        tags: {
          runtime: 'netlify-edge',
        },
      },
      // Filter events in production
      beforeSend(event) {
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
  context?: Record<string, unknown>
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
  context?: Record<string, unknown>
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
 * Handler type for Netlify Edge Functions
 */
type EdgeHandler = (request: Request, context: Context) => Promise<Response> | Response;

/**
 * Wrapper for Netlify edge function handlers with automatic error capture
 *
 * @example
 * ```ts
 * import { withSentry } from './_shared/sentry.ts';
 *
 * export default withSentry('social-meta', async (request, context) => {
 *   // Your handler code
 *   return context.next();
 * });
 * ```
 */
export function withSentry(functionName: string, handler: EdgeHandler): EdgeHandler {
  // Initialize Sentry when wrapper is created
  initSentry();

  return async (request: Request, context: Context): Promise<Response> => {
    // Use withScope to isolate context per request
    return await Sentry.withScope(async (scope) => {
      const url = new URL(request.url);

      // Set function context within isolated scope
      scope.setTag('edge_function', functionName);
      scope.setTag('netlify_site', Deno.env.get('SITE_NAME') || 'unknown');
      scope.addBreadcrumb({
        message: `Request to ${functionName}`,
        category: 'http',
        level: 'info',
        data: {
          url: request.url,
          method: request.method,
          pathname: url.pathname,
          userAgent: request.headers.get('user-agent')?.substring(0, 100),
        },
      });

      try {
        const response = await handler(request, context);
        return response;
      } catch (error) {
        // Capture the error with context
        Sentry.captureException(error, {
          extra: {
            function_name: functionName,
            request_url: request.url,
            request_method: request.method,
            pathname: url.pathname,
            user_agent: request.headers.get('user-agent'),
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

// Auto-initialize when module is imported (if DSN is available)
initSentry();
