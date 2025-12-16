/**
 * Repository Tracking Alerts Service
 *
 * Provides centralized alerting and monitoring for repository tracking operations.
 * This service captures events for Sentry and PostHog that enable alert configuration:
 *
 * Sentry Alerts (configure in Sentry dashboard):
 * - Critical: Tracking API returns 5xx errors
 * - Warning: Inngest event send failures > 5 in 1 hour
 * - Warning: Polling timeout rate > 10% in 24 hours
 *
 * PostHog Alerts (configure in PostHog dashboard):
 * - Warning: Tracking success rate drops below 80%
 * - Info: Daily digest of top 10 repos people are trying to track
 *
 * @see /docs/alerting/repository-tracking-alerts.md
 */

import { captureException, captureMessage, addBreadcrumb } from './sentry-lazy';
import { trackEvent } from './posthog-lazy';

// Types for tracking events
export interface TrackingEventContext {
  owner: string;
  repo: string;
  repository?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

export interface TrackingApiError {
  statusCode: number;
  message: string;
  endpoint: string;
  responseBody?: string;
}

export interface InngestEventError {
  eventName: string;
  errorMessage: string;
  attemptCount?: number;
}

export interface PollingTimeoutContext extends TrackingEventContext {
  pollCount: number;
  maxPolls: number;
  pollDurationMs: number;
}

export interface TrackingSuccessContext extends TrackingEventContext {
  repositoryId: string;
  durationMs: number;
  source: 'user_initiated' | 'auto_track' | 'workspace_add';
}

export interface TrackingFailureContext extends TrackingEventContext {
  errorType: 'api_error' | 'timeout' | 'inngest_failure' | 'validation_error' | 'unknown';
  errorMessage: string;
  durationMs?: number;
}

/**
 * Track repository tracking API errors for Sentry alerts
 * Sentry Alert: Critical when status >= 500
 */
export function trackApiError(error: TrackingApiError, context: TrackingEventContext): void {
  const repository = context.repository || `${context.owner}/${context.repo}`;
  const severity = error.statusCode >= 500 ? 'error' : 'warning';
  const isCritical = error.statusCode >= 500;

  // Sentry: Capture for alerting on 5xx errors
  captureException(new Error(`Tracking API Error: ${error.statusCode} - ${error.message}`), {
    level: isCritical ? 'error' : 'warning',
    tags: {
      type: 'tracking_api_error',
      status_code: String(error.statusCode),
      is_server_error: String(isCritical),
      endpoint: error.endpoint,
      alert_category: 'repository_tracking',
    },
    extra: {
      repository,
      owner: context.owner,
      repo: context.repo,
      response_body: error.responseBody,
      timestamp: context.timestamp || new Date().toISOString(),
    },
  });

  // PostHog: Track for success rate calculation
  trackEvent('repository_tracking_api_error', {
    repository,
    owner: context.owner,
    repo: context.repo,
    status_code: error.statusCode,
    is_server_error: isCritical,
    error_message: error.message,
    endpoint: error.endpoint,
    severity,
    timestamp: new Date().toISOString(),
  });

  // Add breadcrumb for debugging trail
  addBreadcrumb(`Tracking API error: ${error.statusCode}`, 'tracking', {
    repository,
    endpoint: error.endpoint,
  });
}

/**
 * Track Inngest event send failures for Sentry alerts
 * Sentry Alert: Warning when failures > 5 in 1 hour
 */
export function trackInngestFailure(error: InngestEventError, context: TrackingEventContext): void {
  const repository = context.repository || `${context.owner}/${context.repo}`;

  // Sentry: Capture with specific tag for Inngest failures
  captureException(new Error(`Inngest Event Failure: ${error.eventName} - ${error.errorMessage}`), {
    level: 'warning',
    tags: {
      type: 'inngest_event_failure',
      event_name: error.eventName,
      alert_category: 'repository_tracking',
      alert_type: 'inngest_failure',
    },
    extra: {
      repository,
      owner: context.owner,
      repo: context.repo,
      attempt_count: error.attemptCount || 1,
      timestamp: context.timestamp || new Date().toISOString(),
    },
  });

  // PostHog: Track for failure rate monitoring
  trackEvent('repository_tracking_inngest_failure', {
    repository,
    owner: context.owner,
    repo: context.repo,
    event_name: error.eventName,
    error_message: error.errorMessage,
    attempt_count: error.attemptCount || 1,
    timestamp: new Date().toISOString(),
  });

  // Add breadcrumb
  addBreadcrumb(`Inngest failure: ${error.eventName}`, 'tracking', {
    repository,
    error: error.errorMessage,
  });
}

/**
 * Track polling timeouts for Sentry alerts
 * Sentry Alert: Warning when timeout rate > 10% in 24 hours
 */
export function trackPollingTimeout(context: PollingTimeoutContext): void {
  const repository = context.repository || `${context.owner}/${context.repo}`;

  // Sentry: Capture with timeout tag for rate calculation
  captureMessage(`Repository tracking polling timeout: ${repository}`, 'warning');
  captureException(new Error(`Polling Timeout: ${repository}`), {
    level: 'warning',
    tags: {
      type: 'tracking_polling_timeout',
      alert_category: 'repository_tracking',
      alert_type: 'polling_timeout',
    },
    extra: {
      repository,
      owner: context.owner,
      repo: context.repo,
      poll_count: context.pollCount,
      max_polls: context.maxPolls,
      poll_duration_ms: context.pollDurationMs,
      timestamp: context.timestamp || new Date().toISOString(),
    },
  });

  // PostHog: Track for timeout rate calculation
  trackEvent('repository_tracking_timeout', {
    repository,
    owner: context.owner,
    repo: context.repo,
    poll_count: context.pollCount,
    max_polls: context.maxPolls,
    poll_duration_ms: context.pollDurationMs,
    timeout_occurred: true,
    timestamp: new Date().toISOString(),
  });

  // Add breadcrumb
  addBreadcrumb(`Polling timeout after ${context.pollCount} polls`, 'tracking', {
    repository,
    duration_ms: context.pollDurationMs,
  });
}

/**
 * Track successful repository tracking for PostHog success rate
 * PostHog Alert: Warning when success rate drops below 80%
 */
export function trackTrackingSuccess(context: TrackingSuccessContext): void {
  const repository = context.repository || `${context.owner}/${context.repo}`;

  // PostHog: Track success for rate calculation
  trackEvent('repository_tracking_completed', {
    repository,
    owner: context.owner,
    repo: context.repo,
    repository_id: context.repositoryId,
    duration_ms: context.durationMs,
    source: context.source,
    success: true,
    timestamp: new Date().toISOString(),
  });

  // Sentry: Log success breadcrumb for debugging trail
  addBreadcrumb(`Repository tracked successfully: ${repository}`, 'tracking', {
    repository_id: context.repositoryId,
    duration_ms: context.durationMs,
  });
}

/**
 * Track failed repository tracking for PostHog success rate
 * PostHog Alert: Warning when success rate drops below 80%
 */
export function trackTrackingFailure(context: TrackingFailureContext): void {
  const repository = context.repository || `${context.owner}/${context.repo}`;

  // PostHog: Track failure for rate calculation
  trackEvent('repository_tracking_failed', {
    repository,
    owner: context.owner,
    repo: context.repo,
    error_type: context.errorType,
    error_message: context.errorMessage,
    duration_ms: context.durationMs,
    success: false,
    timestamp: new Date().toISOString(),
  });

  // Sentry: Capture as error for alerting
  captureException(
    new Error(`Repository Tracking Failed: ${repository} - ${context.errorMessage}`),
    {
      level: 'error',
      tags: {
        type: 'tracking_failed',
        error_type: context.errorType,
        alert_category: 'repository_tracking',
      },
      extra: {
        repository,
        owner: context.owner,
        repo: context.repo,
        duration_ms: context.durationMs,
        timestamp: context.timestamp || new Date().toISOString(),
      },
    }
  );

  // Add breadcrumb
  addBreadcrumb(`Repository tracking failed: ${context.errorType}`, 'tracking', {
    repository,
    error: context.errorMessage,
  });
}

/**
 * Track repository tracking attempt for PostHog daily digest
 * PostHog Alert: Info - Daily digest of top 10 repos people are trying to track
 */
export function trackTrackingAttempt(context: TrackingEventContext): void {
  const repository = context.repository || `${context.owner}/${context.repo}`;

  // PostHog: Track attempt for daily digest
  trackEvent('repository_tracking_attempt', {
    repository,
    owner: context.owner,
    repo: context.repo,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Calculate and emit tracking health metrics
 * Call this periodically to emit aggregate metrics for dashboards
 */
export function emitTrackingHealthMetrics(metrics: {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  apiErrorCount: number;
  inngestFailureCount: number;
  periodMinutes: number;
}): void {
  const successRate =
    metrics.totalAttempts > 0 ? (metrics.successCount / metrics.totalAttempts) * 100 : 100;

  const timeoutRate =
    metrics.totalAttempts > 0 ? (metrics.timeoutCount / metrics.totalAttempts) * 100 : 0;

  // PostHog: Emit health metrics for dashboards
  trackEvent('repository_tracking_health_metrics', {
    total_attempts: metrics.totalAttempts,
    success_count: metrics.successCount,
    failure_count: metrics.failureCount,
    timeout_count: metrics.timeoutCount,
    api_error_count: metrics.apiErrorCount,
    inngest_failure_count: metrics.inngestFailureCount,
    success_rate: successRate,
    timeout_rate: timeoutRate,
    period_minutes: metrics.periodMinutes,
    timestamp: new Date().toISOString(),
  });

  // Sentry: Log health metrics as breadcrumb
  addBreadcrumb('Tracking health metrics emitted', 'metrics', {
    success_rate: successRate,
    timeout_rate: timeoutRate,
    total_attempts: metrics.totalAttempts,
  });

  // If success rate is critically low, capture as Sentry message
  if (successRate < 50 && metrics.totalAttempts >= 10) {
    captureMessage(
      `Critical: Repository tracking success rate at ${successRate.toFixed(1)}%`,
      'error'
    );
  } else if (successRate < 80 && metrics.totalAttempts >= 10) {
    captureMessage(
      `Warning: Repository tracking success rate at ${successRate.toFixed(1)}%`,
      'warning'
    );
  }
}
