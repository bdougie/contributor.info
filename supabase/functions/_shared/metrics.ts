/**
 * Performance monitoring utilities
 * 
 * Tracks function execution time and reports metrics.
 */

export interface PerformanceMetric {
  function_name: string;
  operation: string;
  duration_ms: number;
  timestamp: string;
  success: boolean;
}

export class PerformanceMonitor {
  private functionName: string;
  private timers: Map<string, number> = new Map();

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  startTimer(operation: string) {
    this.timers.set(operation, performance.now());
  }

  endTimer(operation: string, success = true) {
    const startTime = this.timers.get(operation);
    if (startTime === undefined) {
      console.warn(`No timer found for operation: ${operation}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);

    const metric: PerformanceMetric = {
      function_name: this.functionName,
      operation,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      success,
    };

    // Log metric
    console.info('METRIC:', JSON.stringify(metric));

    // Warn on slow operations (> 1 second)
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
    }

    return metric;
  }

  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(operation);
    try {
      const result = await fn();
      this.endTimer(operation, true);
      return result;
    } catch (error) {
      this.endTimer(operation, false);
      throw error;
    }
  }

  // Measure synchronous operations
  measureSync<T>(operation: string, fn: () => T): T {
    this.startTimer(operation);
    try {
      const result = fn();
      this.endTimer(operation, true);
      return result;
    } catch (error) {
      this.endTimer(operation, false);
      throw error;
    }
  }
}