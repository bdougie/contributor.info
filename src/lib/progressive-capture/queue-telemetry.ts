import { supabase } from '../supabase';
import { QUEUE_CONFIG, RATE_LIMIT_CONFIG } from './throttle-config';

interface QueueValidationError {
  jobId: string;
  jobType: string;
  errorType: 'missing_repository_id' | 'invalid_data' | 'mapping_failure';
  details: Record<string, unknown>;
  timestamp: Date;
}

interface QueueMetrics {
  jobId: string;
  jobType: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'retried';
  duration?: number;
  retryCount?: number;
  errorMessage?: string;
  repositoryId?: string;
  timestamp: Date;
}

class QueueTelemetry {
  private validationErrors: QueueValidationError[] = [];
  private metrics: QueueMetrics[] = [];
  private readonly BATCH_SIZE = QUEUE_CONFIG.batchSize;

  constructor() {
    // IMPORTANT: Client-side telemetry flushing is disabled
    // The queue_metrics table is restricted to service_role for security
    // (see migration 20250127_phase3_secure_system_tables.sql)
    // Telemetry should only be written server-side by Inngest/Edge Functions
    // Keep in-memory tracking for debugging, but don't flush to database
  }

  /**
   * Track validation errors for monitoring and alerting
   */
  trackValidationError(error: Omit<QueueValidationError, 'timestamp'>) {
    const errorWithTimestamp = {
      ...error,
      timestamp: new Date(),
    };

    this.validationErrors.push(errorWithTimestamp);

    // Log to console for immediate visibility
    console.error('[QueueTelemetry] Validation error:', errorWithTimestamp);

    // Track in Supabase for monitoring
    this.persistValidationError(errorWithTimestamp);

    // Flush if we've accumulated too many errors
    if (this.validationErrors.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Track queue processing metrics
   */
  trackMetrics(metric: Omit<QueueMetrics, 'timestamp'>) {
    const metricWithTimestamp = {
      ...metric,
      timestamp: new Date(),
    };

    this.metrics.push(metricWithTimestamp);

    // Log successful operations in development
    if (process.env.NODE_ENV === 'development' && metric.status === 'success') {
      console.log('[QueueTelemetry] Job completed:', {
        jobId: metric.jobId,
        type: metric.jobType,
        duration: metric.duration,
      });
    }

    // Flush if we've accumulated too many metrics
    if (this.metrics.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Track rate limit usage for monitoring
   */
  trackRateLimit(endpoint: string, remaining: number, limit: number, resetAt: Date) {
    const usage = ((limit - remaining) / limit) * 100;

    // Alert if we're using more than configured threshold
    if (usage > RATE_LIMIT_CONFIG.warningThreshold) {
      console.warn('[QueueTelemetry] High rate limit usage:', {
        endpoint,
        usage: `${usage.toFixed(1)}%`,
        remaining,
        resetAt,
      });

      // Store in telemetry for monitoring
      this.persistRateLimitWarning({
        endpoint,
        usage,
        remaining,
        limit,
        resetAt,
      });
    }
  }

  /**
   * Persist validation error to database for monitoring
   * DISABLED: Client-side writes blocked by RLS - only log to console
   */
  private async persistValidationError(error: QueueValidationError) {
    // Skip database writes from client-side (RLS prevents it anyway)
    if (typeof window !== 'undefined') {
      return;
    }

    try {
      await supabase.from('queue_validation_errors').insert({
        job_id: error.jobId,
        job_type: error.jobType,
        error_type: error.errorType,
        details: error.details,
        created_at: error.timestamp,
      });
    } catch (err) {
      // Don't throw - telemetry should not break the app
      console.error('[QueueTelemetry] Failed to persist validation error:', err);
    }
  }

  /**
   * Persist rate limit warning for monitoring
   * DISABLED: Client-side writes blocked by RLS - only log to console
   */
  private async persistRateLimitWarning(data: {
    endpoint: string;
    usage: number;
    remaining: number;
    limit: number;
    resetAt: Date;
  }) {
    // Skip database writes from client-side (RLS prevents it anyway)
    if (typeof window !== 'undefined') {
      return;
    }

    try {
      await supabase.from('rate_limit_warnings').insert({
        endpoint: data.endpoint,
        usage_percentage: data.usage,
        remaining: data.remaining,
        limit: data.limit,
        reset_at: data.resetAt,
        created_at: new Date(),
      });
    } catch (err) {
      console.error('[QueueTelemetry] Failed to persist rate limit warning:', err);
    }
  }

  /**
   * Flush accumulated telemetry data
   * DISABLED: Client-side flushing removed due to RLS restrictions
   * Metrics are kept in-memory for debugging but not persisted from browser
   */
  async flush() {
    // Skip database writes from client-side
    if (typeof window !== 'undefined') {
      // Just clear old data from memory
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.metrics = this.metrics.filter((m) => m.timestamp > oneHourAgo);
      this.validationErrors = this.validationErrors.filter((e) => e.timestamp > oneHourAgo);
      return;
    }

    // Server-side: Batch insert metrics if any
    if (this.metrics.length > 0) {
      const metricsToFlush = [...this.metrics];
      this.metrics = [];

      try {
        await supabase.from('queue_metrics').insert(
          metricsToFlush.map((m) => ({
            job_id: m.jobId,
            job_type: m.jobType,
            status: m.status,
            duration_ms: m.duration,
            retry_count: m.retryCount,
            error_message: m.errorMessage,
            repository_id: m.repositoryId,
            created_at: m.timestamp,
          }))
        );
      } catch (err) {
        console.error('[QueueTelemetry] Failed to flush metrics:', err);
      }
    }

    // Clear old validation errors from memory
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.validationErrors = this.validationErrors.filter((e) => e.timestamp > oneHourAgo);
  }

  /**
   * Get validation error summary for monitoring dashboard
   */
  getValidationErrorSummary() {
    const summary = new Map<string, number>();

    for (const error of this.validationErrors) {
      const key = `${error.jobType}:${error.errorType}`;
      summary.set(key, (summary.get(key) || 0) + 1);
    }

    return Array.from(summary.entries()).map(([key, count]) => {
      const [jobType, errorType] = key.split(':');
      return { jobType, errorType, count };
    });
  }

  /**
   * Cleanup on unmount
   * Note: Periodic flushing disabled, so this just does a final flush
   */
  destroy() {
    this.flush(); // Final flush
  }
}

// Export singleton instance
export const queueTelemetry = new QueueTelemetry();

// Helper function for tracking job lifecycle
export function trackJobLifecycle(jobId: string, jobType: string, repositoryId?: string) {
  const startTime = Date.now();

  return {
    start: () => {
      queueTelemetry.trackMetrics({
        jobId,
        jobType,
        status: 'processing',
        repositoryId,
      });
    },

    success: () => {
      queueTelemetry.trackMetrics({
        jobId,
        jobType,
        status: 'success',
        duration: Date.now() - startTime,
        repositoryId,
      });
    },

    failure: (error: string) => {
      queueTelemetry.trackMetrics({
        jobId,
        jobType,
        status: 'failed',
        duration: Date.now() - startTime,
        errorMessage: error,
        repositoryId,
      });
    },

    retry: (retryCount: number) => {
      queueTelemetry.trackMetrics({
        jobId,
        jobType,
        status: 'retried',
        retryCount,
        repositoryId,
      });
    },
  };
}
