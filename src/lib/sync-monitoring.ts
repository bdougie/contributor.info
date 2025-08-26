// Monitoring service for tracking sync operations
// Tracks execution times, success rates, and timeout occurrences

import { supabase } from './supabase';

export interface SyncMetrics {
  functionName: string;
  repository: string;
  executionTime: number; // in seconds
  success: boolean;
  processed?: number;
  errors?: number;
  timedOut: boolean;
  router: 'supabase' | 'netlify' | 'inngest';
  timestamp: Date;
}

export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  timeouts: number;
  averageExecutionTime: number;
  maxExecutionTime: number;
  supabaseUsage: number;
  netlifyUsage: number;
}

export class SyncMonitoring {
  private static metrics: SyncMetrics[] = [];
  private static readonly MAX_METRICS = 100;

  /**
   * Record sync metrics
   */
  static async recordSync(metrics: SyncMetrics): Promise<void> {
    // Add to in-memory store with proper array management
    // Create a new array to avoid race conditions
    const newMetrics = [...this.metrics, metrics];
    if (newMetrics.length > this.MAX_METRICS) {
      newMetrics.shift(); // Remove oldest
    }
    this.metrics = newMetrics;

    // Store in database for long-term analysis
    try {
      await supabase.from('sync_metrics').insert({
        function_name: metrics.functionName,
        repository: metrics.repository,
        execution_time: metrics.executionTime,
        success: metrics.success,
        processed: metrics.processed || 0,
        errors: metrics.errors || 0,
        timed_out: metrics.timedOut,
        router: metrics.router,
        created_at: metrics.timestamp.toISOString(),
      });
    } catch (error) {
      console.error(, error);
    }

    // Log to console for immediate visibility
    this.logMetrics(metrics);

    // Alert on timeout
    if (metrics.timedOut) {
      this.alertTimeout(metrics);
    }
  }

  /**
   * Get sync statistics
   */
  static async getStats(repository?: string): Promise<SyncStats> {
    const query = supabase
      .from('sync_metrics')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (repository) {
      query.eq('repository', repository);
    }

    const { data: metrics } = await query;

    if (!metrics || metrics.length === 0) {
      return {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        timeouts: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        supabaseUsage: 0,
        netlifyUsage: 0,
      };
    }

    const successfulSyncs = metrics.filter((m) => m.success).length;
    const failedSyncs = metrics.filter((m) => !m.success).length;
    const timeouts = metrics.filter((m) => m.timed_out).length;
    const supabaseUsage = metrics.filter((m) => m.router === 'supabase').length;
    const netlifyUsage = metrics.filter(
      (m) => m.router === 'netlify' || m.router === 'inngest',
    ).length;

    const executionTimes = metrics.map((m) => m.execution_time);
    const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const maxExecutionTime = Math.max(...executionTimes);

    return {
      totalSyncs: metrics.length,
      successfulSyncs,
      failedSyncs,
      timeouts,
      averageExecutionTime,
      maxExecutionTime,
      supabaseUsage,
      netlifyUsage,
    };
  }

  /**
   * Get timeout trends
   */
  static async getTimeoutTrends(): Promise<
    {
      repository: string;
      timeouts: number;
      avgExecutionTime: number;
    }[]
  > {
    const { data: trends } = await supabase
      .from('sync_metrics')
      .select('repository, timed_out, execution_time')
      .eq('timed_out', true)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!trends) return [];

    // Group by repository
    const grouped = trends.reduce(
      (acc, metric) => {
        if (!acc[metric.repository]) {
          acc[metric.repository] = {
            repository: metric.repository,
            timeouts: 0,
            totalTime: 0,
          };
        }
        acc[metric.repository].timeouts++;
        acc[metric.repository].totalTime += metric.execution_time;
        return acc;
      },
      {} as Record<string, unknown>,
    );

    return Object.values(grouped).map((g: unknown) => ({
      repository: g.repository,
      timeouts: g.timeouts,
      avgExecutionTime: g.totalTime / g.timeouts,
    }));
  }

  /**
   * Check if repository should use Supabase based on history
   */
  static async shouldUseSupabase(repository: string): Promise<boolean> {
    const { data: recentSyncs } = await supabase
      .from('sync_metrics')
      .select('execution_time, timed_out, router')
      .eq('repository', repository)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentSyncs || recentSyncs.length === 0) {
      return false; // No history, use default
    }

    // If any recent sync timed out on Netlify, use Supabase
    const netlifyTimeouts = recentSyncs.filter(
      (s) => s.timed_out && (s.router === 'netlify' || s.router === 'inngest'),
    ).length;

    if (netlifyTimeouts > 0) {
      return true;
    }

    // If average execution time > 20 seconds, use Supabase
    const avgTime = recentSyncs.reduce((sum, s) => sum + s.execution_time, 0) / recentSyncs.length;
    if (avgTime > 20) {
      return true;
    }

    return false;
  }

  /**
   * Get execution time percentiles
   */
  static getPercentiles(): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (this.metrics.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const times = this.metrics.map((m) => m.executionTime).sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * times.length) - 1;
      return times[Math.max(0, index)];
    };

    return {
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  // Private helper methods

  private static logMetrics(metrics: SyncMetrics): void {
    const emoji = metrics.success ? '✅' : metrics.timedOut ? '⏰' : '❌';
    const router = metrics.router.toUpperCase();

    console.log(
      `${emoji} [${router}] ${metrics.functionName} for ${metrics.repository}: ` +
        `${metrics.executionTime.toFixed(2)}s ` +
        `(processed: ${metrics.processed || 0}, errors: ${metrics.errors || 0})`,
    );
  }

  private static alertTimeout(metrics: SyncMetrics): void {
    console.warn(
      `⚠️ TIMEOUT ALERT: ${metrics.functionName} timed out for ${metrics.repository} ` +
        `after ${metrics.executionTime.toFixed(2)}s on ${metrics.router}`,
    );

    // Could send to error tracking service here
    // e.g., Sentry.captureMessage(`Sync timeout: ${metrics.repository}`);
  }
}

// Export convenience functions
export const recordSyncMetrics = SyncMonitoring.recordSync.bind(SyncMonitoring);
export const getSyncStats = SyncMonitoring.getStats.bind(SyncMonitoring);
export const getTimeoutTrends = SyncMonitoring.getTimeoutTrends.bind(SyncMonitoring);
export const shouldUseSupabaseForRepo = SyncMonitoring.shouldUseSupabase.bind(SyncMonitoring);
