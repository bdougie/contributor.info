/**
 * Edge Function Concurrency Manager
 *
 * Monitors and manages concurrent executions for Supabase Edge Functions
 * to prevent hitting concurrency limits and ensure graceful degradation.
 */

import { supabase } from './supabase';
import { getEnv } from './env';
import { DEFAULT_CONFIG, type QueuePayload } from './edge-function-config';

export interface ConcurrencyMetrics {
  currentConcurrent: number;
  peakConcurrent: number;
  totalRequests: number;
  throttledRequests: number;
  averageExecutionTime: number;
  timestamp: Date;
}

export interface ConcurrencyLimits {
  maxConcurrent: number;
  burstCapacity: number;
  cooldownPeriod: number; // ms
  queueCapacity: number;
}

export interface QueuedRequest {
  id: string;
  eventName: string;
  data: QueuePayload['data'];
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

/**
 * Get concurrency limits from configuration
 */
function getConcurrencyLimits(): Record<'free' | 'pro' | 'enterprise', ConcurrencyLimits> {
  const config = DEFAULT_CONFIG.concurrency.tiers;
  return {
    free: {
      maxConcurrent: config.free.maxConcurrent,
      burstCapacity: config.free.burstCapacity,
      cooldownPeriod: config.free.cooldownPeriodMs,
      queueCapacity: config.free.queueCapacity,
    },
    pro: {
      maxConcurrent: config.pro.maxConcurrent,
      burstCapacity: config.pro.burstCapacity,
      cooldownPeriod: config.pro.cooldownPeriodMs,
      queueCapacity: config.pro.queueCapacity,
    },
    enterprise: {
      maxConcurrent: config.enterprise.maxConcurrent,
      burstCapacity: config.enterprise.burstCapacity,
      cooldownPeriod: config.enterprise.cooldownPeriodMs,
      queueCapacity: config.enterprise.queueCapacity,
    },
  };
}

export class EdgeFunctionConcurrencyManager {
  private static instance: EdgeFunctionConcurrencyManager;
  private currentConcurrent: number = 0;
  private peakConcurrent: number = 0;
  private totalRequests: number = 0;
  private throttledRequests: number = 0;
  private executionTimes: number[] = [];
  private requestQueue: QueuedRequest[] = [];
  private tier: 'free' | 'pro' | 'enterprise' = 'pro';
  private limits: ConcurrencyLimits;
  private isThrottling: boolean = false;
  private lastThrottleTime: Date | null = null;
  private metricsBuffer: ConcurrencyMetrics[] = [];
  private metricsFlushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    const limits = getConcurrencyLimits();
    this.limits = limits[this.tier];
    this.startMetricsCollection();
  }

  static getInstance(): EdgeFunctionConcurrencyManager {
    if (!EdgeFunctionConcurrencyManager.instance) {
      EdgeFunctionConcurrencyManager.instance = new EdgeFunctionConcurrencyManager();
    }
    return EdgeFunctionConcurrencyManager.instance;
  }

  /**
   * Set the Supabase tier for appropriate limits
   */
  setTier(tier: 'free' | 'pro' | 'enterprise'): void {
    this.tier = tier;
    const limits = getConcurrencyLimits();
    this.limits = limits[tier];
    console.log('Concurrency limits updated for tier: %s', tier, this.limits);
  }

  /**
   * Check if a request can be processed immediately
   */
  canProcessImmediately(): boolean {
    // Check if we're in cooldown period
    if (this.isThrottling && this.lastThrottleTime) {
      const cooldownElapsed = Date.now() - this.lastThrottleTime.getTime();
      if (cooldownElapsed < this.limits.cooldownPeriod) {
        return false;
      }
      this.isThrottling = false;
    }

    // Check current concurrency against limits
    if (this.currentConcurrent >= this.limits.maxConcurrent) {
      // Check if we can use burst capacity
      if (this.currentConcurrent < this.limits.burstCapacity) {
        console.warn(
          'Using burst capacity: %d/%d concurrent requests',
          this.currentConcurrent,
          this.limits.burstCapacity
        );
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Acquire a concurrency slot for request processing
   */
  async acquire(
    eventName: string,
    data: Record<string, unknown>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<{ acquired: boolean; queuePosition?: number; estimatedWaitTime?: number }> {
    this.totalRequests++;

    if (!this.canProcessImmediately()) {
      // Add to queue if capacity allows
      if (this.requestQueue.length < this.limits.queueCapacity) {
        const queuedRequest: QueuedRequest = {
          id: crypto.randomUUID(),
          eventName,
          data,
          priority,
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
        };

        // Insert based on priority
        const insertIndex = this.findQueueInsertIndex(priority);
        this.requestQueue.splice(insertIndex, 0, queuedRequest);

        this.throttledRequests++;

        const estimatedWaitTime = this.estimateWaitTime(insertIndex);

        console.log(
          'Request queued: position=%d, priority=%s, estimatedWait=%dms',
          insertIndex,
          priority,
          estimatedWaitTime
        );

        return {
          acquired: false,
          queuePosition: insertIndex,
          estimatedWaitTime,
        };
      }

      // Queue is full
      this.throttledRequests++;
      console.error('Request rejected: queue at capacity (%d)', this.limits.queueCapacity);
      return { acquired: false };
    }

    // Acquire slot
    this.currentConcurrent++;
    this.peakConcurrent = Math.max(this.peakConcurrent, this.currentConcurrent);

    // Check if we should start throttling
    if (this.currentConcurrent >= this.limits.maxConcurrent * 0.8) {
      this.isThrottling = true;
      this.lastThrottleTime = new Date();
    }

    return { acquired: true };
  }

  /**
   * Release a concurrency slot after request completion
   */
  release(executionTime: number): void {
    this.currentConcurrent = Math.max(0, this.currentConcurrent - 1);
    this.executionTimes.push(executionTime);

    // Keep only last 100 execution times for average calculation
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }

    // Process queue if there are waiting requests
    this.processQueue();
  }

  /**
   * Process queued requests when slots become available
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || !this.canProcessImmediately()) {
      return;
    }

    const request = this.requestQueue.shift();
    if (!request) return;

    // Send to Edge Function
    try {
      const response = await fetch(`${getEnv('SUPABASE_URL')}/functions/v1/queue-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getEnv('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          eventName: request.eventName,
          data: request.data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge Function failed: ${response.status}`);
      }

      console.log('Queued request processed successfully: %s', request.id);
    } catch (error) {
      console.error('Failed to process queued request:', error);

      // Retry logic
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        // Re-queue at the front for high priority, back for others
        if (request.priority === 'high') {
          this.requestQueue.unshift(request);
        } else {
          this.requestQueue.push(request);
        }
      }
    }
  }

  /**
   * Find the correct position to insert a request based on priority
   */
  private findQueueInsertIndex(priority: 'high' | 'medium' | 'low'): number {
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    for (let i = 0; i < this.requestQueue.length; i++) {
      if (priorityOrder[priority] < priorityOrder[this.requestQueue[i].priority]) {
        return i;
      }
    }

    return this.requestQueue.length;
  }

  /**
   * Estimate wait time for a queued request
   */
  private estimateWaitTime(queuePosition: number): number {
    const avgExecutionTime = this.getAverageExecutionTime();
    const concurrentSlots = this.limits.maxConcurrent;

    // Estimate based on queue position and average execution time
    const estimatedBatches = Math.ceil(queuePosition / concurrentSlots);
    return estimatedBatches * avgExecutionTime;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConcurrencyMetrics {
    return {
      currentConcurrent: this.currentConcurrent,
      peakConcurrent: this.peakConcurrent,
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      averageExecutionTime: this.getAverageExecutionTime(),
      timestamp: new Date(),
    };
  }

  /**
   * Get average execution time
   */
  private getAverageExecutionTime(): number {
    if (this.executionTimes.length === 0) return 0;
    const sum = this.executionTimes.reduce((a, b) => a + b, 0);
    return sum / this.executionTimes.length;
  }

  /**
   * Start collecting and persisting metrics
   */
  private startMetricsCollection(): void {
    // Collect metrics every 10 seconds
    this.metricsFlushInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.metricsBuffer.push(metrics);

      // Flush to database every minute or when buffer is large
      if (this.metricsBuffer.length >= 6) {
        this.flushMetrics();
      }
    }, 10000);
  }

  /**
   * Flush metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const { error } = await supabase.from('edge_function_metrics').insert(
        this.metricsBuffer.map((m) => ({
          current_concurrent: m.currentConcurrent,
          peak_concurrent: m.peakConcurrent,
          total_requests: m.totalRequests,
          throttled_requests: m.throttledRequests,
          average_execution_time: m.averageExecutionTime,
          recorded_at: m.timestamp.toISOString(),
        }))
      );

      if (error) {
        console.error('Failed to persist metrics:', error);
      } else {
        console.log('Flushed %d metrics to database', this.metricsBuffer.length);
        this.metricsBuffer = [];
      }
    } catch (error) {
      console.error('Error flushing metrics:', error);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    queueCapacity: number;
    utilizationPercent: number;
    priorityCounts: Record<string, number>;
  } {
    const priorityCounts = this.requestQueue.reduce(
      (acc, req) => {
        acc[req.priority] = (acc[req.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      queueLength: this.requestQueue.length,
      queueCapacity: this.limits.queueCapacity,
      utilizationPercent: (this.requestQueue.length / this.limits.queueCapacity) * 100,
      priorityCounts,
    };
  }

  /**
   * Check system health
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
    recommendations: string[];
  } {
    const queueStatus = this.getQueueStatus();
    const concurrencyPercent = (this.currentConcurrent / this.limits.maxConcurrent) * 100;
    const recommendations: string[] = [];

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'System operating normally';

    // Check for critical conditions
    if (queueStatus.utilizationPercent > 90) {
      status = 'critical';
      message = 'Queue near capacity - requests may be rejected';
      recommendations.push('Consider scaling to a higher tier');
      recommendations.push('Implement request deduplication');
    } else if (concurrencyPercent > 80) {
      status = 'degraded';
      message = 'High concurrency utilization';
      recommendations.push('Monitor for increasing load');
      recommendations.push('Consider implementing caching');
    } else if (this.throttledRequests > this.totalRequests * 0.1) {
      status = 'degraded';
      message = 'High throttle rate detected';
      recommendations.push('Review request patterns for optimization');
      recommendations.push('Consider batching similar requests');
    }

    return { status, message, recommendations };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metricsFlushInterval) {
      clearInterval(this.metricsFlushInterval);
      this.metricsFlushInterval = null;
    }
    // Flush any remaining metrics
    this.flushMetrics().catch((error) => {
      console.error('Error flushing metrics during cleanup:', error);
    });
  }
}

// Export singleton instance
export const concurrencyManager = EdgeFunctionConcurrencyManager.getInstance();
