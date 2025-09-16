/**
 * Enhanced Circuit Breaker for Edge Functions with Concurrency Awareness
 *
 * Implements the circuit breaker pattern with additional concurrency monitoring
 * to prevent overwhelming Edge Functions and provide graceful degradation.
 */

import { concurrencyManager } from './edge-function-concurrency-manager';
import { DEFAULT_CONFIG } from './edge-function-config';
import { supabase } from './supabase';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures to open circuit
  successThreshold: number; // Number of successes to close circuit
  timeout: number; // Time in ms before attempting half-open
  volumeThreshold: number; // Minimum requests before evaluating
  errorThresholdPercentage: number; // Error percentage to trip
  concurrencyThreshold: number; // Concurrent requests to consider
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  errorRate: number;
  concurrentRequests: number;
  nextRetryTime: Date | null;
}

export interface RequestOptions {
  timeout?: number;
  priority?: 'high' | 'medium' | 'low';
  fallbackFn?: () => Promise<unknown>;
  metadata?: Record<string, unknown>;
}

export class EdgeFunctionCircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextRetryTime: Date | null = null;
  private requestWindow: { timestamp: number; success: boolean }[] = []; // Sliding window for error rate
  private windowDuration: number = 60000; // 1 minute window
  private config: CircuitBreakerConfig;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private readonly circuitBreakerKey = 'edge-function-circuit-breaker';

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: DEFAULT_CONFIG.circuitBreaker.failureThreshold,
      successThreshold: DEFAULT_CONFIG.circuitBreaker.successThreshold,
      timeout: DEFAULT_CONFIG.circuitBreaker.timeoutMs,
      volumeThreshold: DEFAULT_CONFIG.circuitBreaker.volumeThreshold,
      errorThresholdPercentage: DEFAULT_CONFIG.circuitBreaker.errorThresholdPercentage,
      concurrencyThreshold: DEFAULT_CONFIG.concurrency.tiers.pro.maxConcurrent * 0.75, // 75% of pro tier
      ...config,
    };

    // Restore state from persistence
    this.restoreState();

    // Start auto-persistence
    this.startStatePersistence();
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>, options: RequestOptions = {}): Promise<T> {
    // Check circuit state
    if (!this.canMakeRequest()) {
      // Try fallback if provided
      if (options.fallbackFn) {
        console.log('Circuit breaker OPEN - using fallback');
        return options.fallbackFn() as Promise<T>;
      }

      throw new Error(`Circuit breaker is ${this.state}. Service unavailable.`);
    }

    // Check concurrency limits
    const concurrencyStatus = await concurrencyManager.acquire(
      'edge-function-request',
      options.metadata || {},
      options.priority || 'medium'
    );

    if (!concurrencyStatus.acquired) {
      // Circuit should open if we're hitting concurrency limits
      this.recordFailure(new Error('Concurrency limit reached'));

      if (options.fallbackFn) {
        console.log('Concurrency limit reached - using fallback');
        return options.fallbackFn() as Promise<T>;
      }

      throw new Error(
        `Request queued at position ${concurrencyStatus.queuePosition}. ` +
          `Estimated wait: ${concurrencyStatus.estimatedWaitTime}ms`
      );
    }

    const startTime = Date.now();

    try {
      // Set timeout for request
      const timeoutMs = options.timeout || 30000;
      const result = await this.executeWithTimeout(fn, timeoutMs);

      // Record success
      this.recordSuccess();

      // Release concurrency slot
      const executionTime = Date.now() - startTime;
      concurrencyManager.release(executionTime);

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error as Error);

      // Release concurrency slot
      const executionTime = Date.now() - startTime;
      concurrencyManager.release(executionTime);

      // Try fallback if available
      if (options.fallbackFn && this.state === 'open') {
        console.log('Request failed - using fallback');
        return options.fallbackFn() as Promise<T>;
      }

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        fn().catch((error) => {
          // Ensure we clear timeout on function error
          if (timeoutId) clearTimeout(timeoutId);
          throw error;
        }),
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Request timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      // Always cleanup timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Check if a request can be made based on circuit state
   */
  private canMakeRequest(): boolean {
    // Update state based on timeout
    this.updateState();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if we should transition to half-open
        if (this.nextRetryTime && new Date() >= this.nextRetryTime) {
          this.transitionTo('half-open');
          return true;
        }
        return false;

      case 'half-open':
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    this.successes++;
    this.totalRequests++;
    this.lastSuccessTime = new Date();
    this.updateRequestWindow(true);

    // State transitions based on success
    if (this.state === 'half-open') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(error: Error): void {
    this.failures++;
    this.totalRequests++;
    this.lastFailureTime = new Date();
    this.updateRequestWindow(false);

    console.error('Circuit breaker recorded failure:', error.message);

    // State transitions based on failures
    if (this.state === 'closed') {
      if (this.shouldTrip()) {
        this.transitionTo('open');
      }
    } else if (this.state === 'half-open') {
      // Single failure in half-open reopens the circuit
      this.transitionTo('open');
    }
  }

  /**
   * Determine if circuit should trip based on metrics
   */
  private shouldTrip(): boolean {
    // Check volume threshold
    if (this.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    // Check failure count threshold
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check error rate threshold
    const errorRate = this.calculateErrorRate();
    if (errorRate >= this.config.errorThresholdPercentage) {
      return true;
    }

    // Check concurrency-based tripping
    const concurrencyMetrics = concurrencyManager.getMetrics();
    if (concurrencyMetrics.currentConcurrent >= this.config.concurrencyThreshold) {
      console.warn(
        'Circuit breaker tripping due to high concurrency: %d',
        concurrencyMetrics.currentConcurrent
      );
      return true;
    }

    // Check system health
    const health = concurrencyManager.getHealthStatus();
    if (health.status === 'critical') {
      console.warn('Circuit breaker tripping due to critical system health');
      return true;
    }

    return false;
  }

  /**
   * Transition circuit to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    console.log('Circuit breaker state transition: %s -> %s', oldState, newState);

    // Reset counters on state change
    switch (newState) {
      case 'open':
        this.nextRetryTime = new Date(Date.now() + this.config.timeout);
        this.failures = 0;
        this.successes = 0;
        break;

      case 'half-open':
        this.failures = 0;
        this.successes = 0;
        break;

      case 'closed':
        this.failures = 0;
        this.successes = 0;
        this.nextRetryTime = null;
        break;
    }
  }

  /**
   * Update sliding window for error rate calculation
   */
  private updateRequestWindow(success: boolean): void {
    const now = Date.now();
    this.requestWindow.push({ timestamp: now, success });

    // Remove old entries outside the window
    const cutoff = now - this.windowDuration;
    while (this.requestWindow.length > 0 && this.requestWindow[0].timestamp < cutoff) {
      this.requestWindow.shift();
    }
  }

  /**
   * Calculate current error rate
   */
  private calculateErrorRate(): number {
    if (this.requestWindow.length === 0) return 0;

    const failures = this.requestWindow.filter((r) => !r.success).length;
    return (failures / this.requestWindow.length) * 100;
  }

  /**
   * Update state based on timeouts and conditions
   */
  private updateState(): void {
    if (this.state === 'open' && this.nextRetryTime) {
      if (new Date() >= this.nextRetryTime) {
        this.transitionTo('half-open');
      }
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      errorRate: this.calculateErrorRate(),
      concurrentRequests: concurrencyManager.getMetrics().currentConcurrent,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.transitionTo('closed');
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextRetryTime = null;
    this.requestWindow = [];
  }

  /**
   * Force circuit to open state (manual trip)
   */
  trip(): void {
    this.transitionTo('open');
  }

  /**
   * Force circuit to closed state (manual reset)
   */
  close(): void {
    this.transitionTo('closed');
  }

  /**
   * Get health status combining circuit and concurrency health
   */
  getHealthStatus(): {
    circuitHealth: CircuitState;
    concurrencyHealth: ReturnType<typeof concurrencyManager.getHealthStatus>;
    overallStatus: 'healthy' | 'degraded' | 'critical';
    recommendations: string[];
  } {
    const concurrencyHealth = concurrencyManager.getHealthStatus();
    const recommendations: string[] = [...concurrencyHealth.recommendations];

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Determine overall status
    if (this.state === 'open' || concurrencyHealth.status === 'critical') {
      overallStatus = 'critical';
      recommendations.push('Consider implementing fallback mechanisms');
      recommendations.push('Review and optimize Edge Function performance');
    } else if (this.state === 'half-open' || concurrencyHealth.status === 'degraded') {
      overallStatus = 'degraded';
      recommendations.push('Monitor system closely for improvements');
    }

    // Add circuit-specific recommendations
    if (this.state === 'open') {
      recommendations.push('Circuit is open - requests are being rejected');
      recommendations.push(`Will retry at ${this.nextRetryTime?.toISOString()}`);
    } else if (this.calculateErrorRate() > 25) {
      recommendations.push('High error rate detected - investigate root cause');
    }

    return {
      circuitHealth: this.state,
      concurrencyHealth,
      overallStatus,
      recommendations: [...new Set(recommendations)], // Remove duplicates
    };
  }

  /**
   * Start automatic state persistence
   */
  private startStatePersistence(): void {
    // Persist state every 30 seconds
    this.persistenceTimer = setInterval(() => {
      this.persistState();
    }, 30000);

    // Also persist on state transitions
    const originalTransitionTo = this.transitionTo.bind(this);
    this.transitionTo = (newState: CircuitState) => {
      originalTransitionTo(newState);
      this.persistState();
    };
  }

  /**
   * Persist circuit breaker state to database
   */
  private async persistState(): Promise<void> {
    try {
      const stateData = {
        state: this.state,
        failures: this.failures,
        successes: this.successes,
        totalRequests: this.totalRequests,
        lastFailureTime: this.lastFailureTime?.toISOString(),
        lastSuccessTime: this.lastSuccessTime?.toISOString(),
        nextRetryTime: this.nextRetryTime?.toISOString(),
        requestWindow: this.requestWindow,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('edge_function_metrics').upsert(
        {
          metric_key: this.circuitBreakerKey,
          metric_value: stateData,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'metric_key',
        }
      );

      if (error) {
        console.error('Failed to persist circuit breaker state:', error);
      }
    } catch (error) {
      console.error('Error persisting circuit breaker state:', error);
    }
  }

  /**
   * Restore circuit breaker state from database
   */
  private async restoreState(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('edge_function_metrics')
        .select('metric_value')
        .eq('metric_key', this.circuitBreakerKey)
        .maybeSingle();

      if (error || !data) {
        console.log('No persisted circuit breaker state found');
        return;
      }

      const stateData = data.metric_value as {
        state: CircuitState;
        failures: number;
        successes: number;
        totalRequests: number;
        lastFailureTime?: string;
        lastSuccessTime?: string;
        nextRetryTime?: string;
        requestWindow: { timestamp: number; success: boolean }[];
        timestamp: string;
      };

      // Only restore if state is recent (within last 5 minutes)
      const stateAge = Date.now() - new Date(stateData.timestamp).getTime();
      if (stateAge > 5 * 60 * 1000) {
        console.log('Persisted state is too old, starting fresh');
        return;
      }

      // Restore state
      this.state = stateData.state;
      this.failures = stateData.failures;
      this.successes = stateData.successes;
      this.totalRequests = stateData.totalRequests;
      this.lastFailureTime = stateData.lastFailureTime ? new Date(stateData.lastFailureTime) : null;
      this.lastSuccessTime = stateData.lastSuccessTime ? new Date(stateData.lastSuccessTime) : null;
      this.nextRetryTime = stateData.nextRetryTime ? new Date(stateData.nextRetryTime) : null;
      this.requestWindow = stateData.requestWindow || [];

      console.log('Circuit breaker state restored: %s', this.state);
    } catch (error) {
      console.error('Error restoring circuit breaker state:', error);
    }
  }

  /**
   * Cleanup persistence timer
   */
  destroy(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    // Final persistence before cleanup
    this.persistState();
  }
}

// Export default circuit breaker instance
export const edgeFunctionCircuitBreaker = new EdgeFunctionCircuitBreaker();
