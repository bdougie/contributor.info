/**
 * Centralized error logging utility
 * Logs to console and Sentry with proper context
 */

import { captureException } from './sentry-lazy';

interface ErrorContext {
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Log an error to console and Sentry
 *
 * @param message - Human-readable error message (for console logging)
 * @param error - The error object or value
 * @param context - Additional context for Sentry (tags, extra data, level)
 *
 * @example
 * try {
 *   await fetchData();
 * } catch (error) {
 *   logError('Failed to fetch user data', error, {
 *     tags: { feature: 'workspace', operation: 'fetch' },
 *     extra: { userId: '123' }
 *   });
 * }
 */
export function logError(message: string, error: Error | unknown, context?: ErrorContext): void {
  // Always log to console with secure formatting
  console.error('%s', message, error);

  // Send to Sentry with context
  captureException(error, {
    level: context?.level || 'error',
    tags: {
      ...context?.tags,
      logged_message: message,
    },
    extra: context?.extra,
  });
}

/**
 * Log a warning to console and Sentry
 * Use for non-critical errors that don't require immediate action
 */
export function logWarning(
  message: string,
  error: Error | unknown,
  context?: Omit<ErrorContext, 'level'>
): void {
  console.warn('%s', message, error);

  captureException(error, {
    level: 'warning',
    tags: {
      ...context?.tags,
      logged_message: message,
    },
    extra: context?.extra,
  });
}

/**
 * Log a fatal error to console and Sentry
 * Use for critical errors that prevent core functionality
 */
export function logFatal(
  message: string,
  error: Error | unknown,
  context?: Omit<ErrorContext, 'level'>
): void {
  console.error('%s', message, error);

  captureException(error, {
    level: 'fatal',
    tags: {
      ...context?.tags,
      logged_message: message,
    },
    extra: context?.extra,
  });
}
