/**
 * Feature flag monitoring and rollback capabilities
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useFeatureFlags } from './context';
import { trackEvent } from '../posthog-lazy';
import type { FeatureFlagName } from './types';

/**
 * Error spike detection configuration
 */
interface ErrorSpikeConfig {
  threshold: number; // Error count threshold
  windowMs: number; // Time window in milliseconds
  rollbackFlags: FeatureFlagName[]; // Flags to rollback on spike
}

/**
 * Feature flag health metrics
 */
interface FeatureFlagHealth {
  flagName: FeatureFlagName;
  errorCount: number;
  successCount: number;
  errorRate: number;
  lastError?: Error;
  lastErrorTime?: Date;
}

/**
 * Monitor for automatic rollback on error spikes
 */
class FeatureFlagErrorMonitor {
  private errorCounts: Map<FeatureFlagName, number[]> = new Map();
  private config: ErrorSpikeConfig;
  private rollbackCallbacks: Set<() => void> = new Set();

  constructor(config: ErrorSpikeConfig) {
    this.config = config;
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    // Listen for uncaught errors
    window.addEventListener('error', (event) => {
      this.recordError('global', event.error);
    });

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError('promise', new Error(event.reason));
    });
  }

  recordError(source: string, error: Error) {
    const now = Date.now();

    // Check each monitored flag
    for (const flagName of this.config.rollbackFlags) {
      if (!this.errorCounts.has(flagName)) {
        this.errorCounts.set(flagName, []);
      }

      const errors = this.errorCounts.get(flagName)!;
      errors.push(now);

      // Remove old errors outside the window
      const cutoff = now - this.config.windowMs;
      const recentErrors = errors.filter((time) => time > cutoff);
      this.errorCounts.set(flagName, recentErrors);

      // Check if we've exceeded the threshold
      if (recentErrors.length >= this.config.threshold) {
        this.triggerRollback(flagName, source, error);
      }
    }
  }

  private triggerRollback(flagName: FeatureFlagName, source: string, error: Error) {
    console.error(`[FeatureFlags] Error spike detected for ${flagName}, triggering rollback`, {
      source,
      error,
      errorCount: this.errorCounts.get(flagName)?.length,
    });

    // Track rollback event
    trackEvent('feature_flag_rollback', {
      flag_name: flagName,
      error_source: source,
      error_message: error.message,
      error_stack: error.stack,
    });

    // Notify callbacks
    this.rollbackCallbacks.forEach((callback) => callback());

    // Clear error counts for this flag
    this.errorCounts.set(flagName, []);
  }

  onRollback(callback: () => void) {
    this.rollbackCallbacks.add(callback);
    return () => this.rollbackCallbacks.delete(callback);
  }

  getHealth(flagName: FeatureFlagName): FeatureFlagHealth {
    const errors = this.errorCounts.get(flagName) || [];
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const recentErrors = errors.filter((time) => time > cutoff);

    return {
      flagName,
      errorCount: recentErrors.length,
      successCount: 0, // Would need to track successful operations
      errorRate: recentErrors.length / (this.config.windowMs / 1000), // Errors per second
      lastErrorTime:
        recentErrors.length > 0 ? new Date(recentErrors[recentErrors.length - 1]) : undefined,
    };
  }
}

// Global monitor instance
let globalMonitor: FeatureFlagErrorMonitor | null = null;

/**
 * Initialize the error monitor
 */
export function initializeErrorMonitor(config: ErrorSpikeConfig) {
  globalMonitor = new FeatureFlagErrorMonitor(config);
  return globalMonitor;
}

/**
 * Props for FeatureFlagMonitor component
 */
interface FeatureFlagMonitorProps {
  errorThreshold?: number;
  windowMs?: number;
  rollbackFlags?: FeatureFlagName[];
  onRollback?: (flagName: FeatureFlagName) => void;
  children?: React.ReactNode;
}

/**
 * Component that monitors feature flags and handles automatic rollback
 */
export function FeatureFlagMonitor({
  errorThreshold = 10,
  windowMs = 60000, // 1 minute
  rollbackFlags = [],
  onRollback,
  children,
}: FeatureFlagMonitorProps) {
  const { reload } = useFeatureFlags();
  const [health, setHealth] = useState<Map<FeatureFlagName, FeatureFlagHealth>>(new Map());

  useEffect(() => {
    const monitor = initializeErrorMonitor({
      threshold: errorThreshold,
      windowMs,
      rollbackFlags,
    });

    const unsubscribe = monitor.onRollback(() => {
      // Reload flags to get updated values after rollback
      reload();

      // Notify parent component
      if (onRollback) {
        rollbackFlags.forEach((flag) => onRollback(flag));
      }
    });

    // Update health metrics periodically
    const interval = setInterval(() => {
      const newHealth = new Map<FeatureFlagName, FeatureFlagHealth>();
      rollbackFlags.forEach((flag) => {
        newHealth.set(flag, monitor.getHealth(flag));
      });
      setHealth(newHealth);
    }, 5000); // Update every 5 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [errorThreshold, windowMs, rollbackFlags, reload, onRollback]);

  // Render health dashboard in development
  if (process.env.NODE_ENV === 'development' && health.size > 0) {
    return (
      <>
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50 max-w-sm">
          <h3 className="text-sm font-semibold mb-2">Feature Flag Health</h3>
          <div className="space-y-2">
            {Array.from(health.values()).map((metric) => (
              <div key={metric.flagName} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-mono">{metric.flagName}</span>
                  <span className={metric.errorCount > 0 ? 'text-red-500' : 'text-green-500'}>
                    {metric.errorCount} errors
                  </span>
                </div>
                {metric.lastErrorTime && (
                  <div className="text-gray-500">
                    Last error: {metric.lastErrorTime.toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to manually record errors for a specific feature flag
 */
export function useFeatureFlagError(flagName: FeatureFlagName) {
  return useCallback(
    (error: Error) => {
      if (globalMonitor) {
        globalMonitor.recordError('manual', error);
      }

      // Also track in PostHog
      trackEvent('feature_flag_error', {
        flag_name: flagName,
        error_message: error.message,
        error_stack: error.stack,
      });
    },
    [flagName]
  );
}

/**
 * Performance monitoring for feature flags
 */
export class FeatureFlagPerformanceMonitor {
  private metrics: Map<FeatureFlagName, number[]> = new Map();

  recordMetric(flagName: FeatureFlagName, value: number) {
    if (!this.metrics.has(flagName)) {
      this.metrics.set(flagName, []);
    }

    const values = this.metrics.get(flagName)!;
    values.push(value);

    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }

    // Track in PostHog if significant change
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (Math.abs(value - avg) > avg * 0.5) {
      trackEvent('feature_flag_performance_anomaly', {
        flag_name: flagName,
        value,
        average: avg,
        deviation: Math.abs(value - avg),
      });
    }
  }

  getStats(flagName: FeatureFlagName) {
    const values = this.metrics.get(flagName) || [];
    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      count: values.length,
      average: avg,
      p50,
      p95,
      p99,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }
}

// Global performance monitor
export const performanceMonitor = new FeatureFlagPerformanceMonitor();
