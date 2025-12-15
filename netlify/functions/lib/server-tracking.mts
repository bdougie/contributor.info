/**
 * Server-side tracking utilities for Netlify Functions
 * Provides Sentry error reporting and PostHog analytics without heavy dependencies
 */

interface SentryEventPayload {
  event_id: string;
  timestamp: string;
  platform: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  logger: string;
  message?: {
    formatted: string;
  };
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename?: string;
          function?: string;
          lineno?: number;
          colno?: number;
        }>;
      };
    }>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  environment?: string;
  release?: string;
}

interface PostHogEventPayload {
  api_key: string;
  event: string;
  properties: Record<string, unknown>;
  timestamp?: string;
  distinct_id: string;
}

/**
 * Generate a UUID v4
 */
function generateEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Send error to Sentry via REST API
 * This is a lightweight alternative to the full Sentry SDK
 */
export async function captureServerException(
  error: Error | string,
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    fingerprint?: string[];
  }
): Promise<void> {
  const sentryDsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('[Server Tracking] Sentry DSN not configured, skipping error capture');
    return;
  }

  try {
    // Parse DSN: https://{public_key}@{host}/{project_id}
    const dsnMatch = sentryDsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!dsnMatch) {
      console.error('[Server Tracking] Invalid Sentry DSN format');
      return;
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const storeUrl = `https://${host}/api/${projectId}/store/`;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Error';

    const payload: SentryEventPayload = {
      event_id: generateEventId().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: context?.level || 'error',
      logger: 'netlify-functions',
      exception: {
        values: [
          {
            type: errorName,
            value: errorMessage,
            stacktrace:
              error instanceof Error && error.stack
                ? {
                    frames: error.stack.split('\n').map((line) => ({
                      filename: line.trim(),
                    })),
                  }
                : undefined,
          },
        ],
      },
      tags: {
        runtime: 'netlify-functions',
        ...context?.tags,
      },
      extra: context?.extra,
      environment: process.env.CONTEXT || process.env.NODE_ENV || 'development',
      release: process.env.COMMIT_REF || 'unknown',
    };

    const response = await fetch(storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=netlify-functions/1.0.0, sentry_key=${publicKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Server Tracking] Sentry API error:', response.status, await response.text());
    }
  } catch (err) {
    // Don't let tracking errors break the application
    console.error('[Server Tracking] Failed to send to Sentry:', err);
  }
}

/**
 * Track server-side event to PostHog
 */
export async function trackServerEvent(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string
): Promise<void> {
  const posthogKey = process.env.POSTHOG_API_KEY || process.env.VITE_POSTHOG_KEY;
  const posthogHost = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!posthogKey) {
    console.warn('[Server Tracking] PostHog key not configured, skipping event');
    return;
  }

  try {
    const payload: PostHogEventPayload = {
      api_key: posthogKey,
      event,
      properties: {
        ...properties,
        $lib: 'netlify-functions',
        $lib_version: '1.0.0',
        environment: process.env.CONTEXT || process.env.NODE_ENV || 'development',
      },
      timestamp: new Date().toISOString(),
      distinct_id: distinctId || 'server-anonymous',
    };

    const response = await fetch(`${posthogHost}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Server Tracking] PostHog API error:', response.status, await response.text());
    }
  } catch (err) {
    // Don't let tracking errors break the application
    console.error('[Server Tracking] Failed to send to PostHog:', err);
  }
}

/**
 * Track Inngest event failures with proper context
 */
export async function trackInngestFailure(
  eventName: string,
  error: Error | unknown,
  context: {
    owner: string;
    repo: string;
    repositoryId?: string;
    eventType?: string;
    isLocal?: boolean;
  }
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'InngestError';

  // Send to Sentry
  await captureServerException(error instanceof Error ? error : new Error(errorMessage), {
    level: 'error',
    tags: {
      type: 'inngest_event_failed',
      event_name: eventName,
      repository: `${context.owner}/${context.repo}`,
      is_local: String(context.isLocal ?? false),
    },
    extra: {
      ...context,
      error_type: errorName,
      error_message: errorMessage,
      timestamp: new Date().toISOString(),
    },
  });

  // Send to PostHog
  await trackServerEvent('inngest_event_failed', {
    event_name: eventName,
    repository: `${context.owner}/${context.repo}`,
    owner: context.owner,
    repo: context.repo,
    repository_id: context.repositoryId,
    error_type: errorName,
    error_category: categorizeError(errorMessage),
    is_local: context.isLocal ?? false,
    timestamp: new Date().toISOString(),
  });

  console.error(
    '[Inngest] Event %s failed for %s/%s: %s',
    eventName,
    context.owner,
    context.repo,
    errorMessage
  );
}

/**
 * Categorize error for analytics
 */
function categorizeError(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'TIMEOUT_ERROR';
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    return 'RATE_LIMIT_ERROR';
  }
  if (
    lowerMessage.includes('auth') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('401')
  ) {
    return 'AUTH_ERROR';
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return 'NOT_FOUND_ERROR';
  }
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('403')
  ) {
    return 'PERMISSION_ERROR';
  }
  if (lowerMessage.includes('inngest') || lowerMessage.includes('event')) {
    return 'INNGEST_ERROR';
  }

  return 'UNKNOWN_ERROR';
}
