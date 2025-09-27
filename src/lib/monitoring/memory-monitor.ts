/**
 * Memory Monitoring Utilities
 *
 * Provides tools to monitor and manage memory usage to prevent leaks
 * and ensure optimal performance in long-running processes.
 */

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface MemoryThresholds {
  warning: number; // MB
  critical: number; // MB
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private metrics: MemoryMetrics[] = [];
  private readonly maxMetricsHistory = 100;
  private readonly thresholds: MemoryThresholds = {
    warning: 256, // 256 MB
    critical: 512, // 512 MB
  };

  private constructor() {
    // Start monitoring if in Node.js environment
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      this.startMonitoring();
    }
  }

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Get current memory usage
   */
  getCurrentMemory(): MemoryMetrics | null {
    if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') {
      return null;
    }

    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers || 0,
    };
  }

  /**
   * Check if memory usage is above warning threshold
   */
  isMemoryHigh(): boolean {
    const current = this.getCurrentMemory();
    if (!current) return false;

    const heapUsedMB = current.heapUsed / 1024 / 1024;
    return heapUsedMB > this.thresholds.warning;
  }

  /**
   * Check if memory usage is critical
   */
  isMemoryCritical(): boolean {
    const current = this.getCurrentMemory();
    if (!current) return false;

    const heapUsedMB = current.heapUsed / 1024 / 1024;
    return heapUsedMB > this.thresholds.critical;
  }

  /**
   * Start periodic memory monitoring
   */
  private startMonitoring(): void {
    // Check memory every 30 seconds
    setInterval(() => {
      const metrics = this.getCurrentMemory();
      if (metrics) {
        this.recordMetrics(metrics);
        this.checkMemoryPressure();
      }
    }, 30000);
  }

  /**
   * Record metrics for historical analysis
   */
  private recordMetrics(metrics: MemoryMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Check for memory pressure and trigger cleanup if needed
   */
  private checkMemoryPressure(): void {
    if (this.isMemoryCritical()) {
      console.error('CRITICAL: Memory usage exceeded critical threshold');
      this.triggerEmergencyCleanup();
    } else if (this.isMemoryHigh()) {
      console.warn('WARNING: Memory usage is high');
      this.triggerRoutineCleanup();
    }
  }

  /**
   * Trigger emergency cleanup when memory is critical
   */
  private triggerEmergencyCleanup(): void {
    // Force garbage collection if available
    if (global.gc) {
      console.log('Running garbage collection...');
      global.gc();
    }

    // Clear all caches
    this.clearAllCaches();

    // Emit event for other components to clean up
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory-pressure-critical'));
    }
  }

  /**
   * Trigger routine cleanup when memory is high
   */
  private triggerRoutineCleanup(): void {
    // Clear old caches
    this.clearOldCaches();

    // Emit event for other components to clean up
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory-pressure-warning'));
    }
  }

  /**
   * Clear all caches (implement based on your caching strategy)
   */
  private clearAllCaches(): void {
    // Clear any global caches
    if (typeof window !== 'undefined' && window.caches) {
      window.caches.keys().then((names) => {
        names.forEach((name) => window.caches.delete(name));
      });
    }
  }

  /**
   * Clear old caches (implement based on your caching strategy)
   */
  private clearOldCaches(): void {
    // Clear caches older than 1 hour
    // const oneHourAgo = Date.now() - 60 * 60 * 1000;

    if (typeof window !== 'undefined' && window.caches) {
      // Implementation depends on cache structure
      // This would use oneHourAgo once cache structure is defined
    }
  }

  /**
   * Get memory trend (increasing, stable, decreasing)
   */
  getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
    if (this.metrics.length < 10) {
      return 'unknown';
    }

    const recent = this.metrics.slice(-10);
    const firstHeap = recent[0].heapUsed;
    const lastHeap = recent[recent.length - 1].heapUsed;
    const difference = lastHeap - firstHeap;
    const percentChange = (difference / firstHeap) * 100;

    if (percentChange > 10) return 'increasing';
    if (percentChange < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Get memory statistics
   */
  getStatistics() {
    const current = this.getCurrentMemory();
    if (!current) {
      return null;
    }

    return {
      current: {
        heapUsedMB: Math.round(current.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(current.heapTotal / 1024 / 1024),
        rssMB: Math.round(current.rss / 1024 / 1024),
      },
      trend: this.getMemoryTrend(),
      isHigh: this.isMemoryHigh(),
      isCritical: this.isMemoryCritical(),
      thresholds: this.thresholds,
    };
  }
}

/**
 * Time-windowed collection with automatic cleanup
 */
export class TimeWindowedCollection<T> {
  private items: Array<{ timestamp: number; data: T }> = [];
  private readonly windowMs: number;
  private readonly maxItems: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 3600000, maxItems: number = 1000) {
    this.windowMs = windowMs;
    this.maxItems = maxItems;

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Listen for memory pressure events
    if (typeof window !== 'undefined') {
      window.addEventListener('memory-pressure-warning', () => this.cleanup());
      window.addEventListener('memory-pressure-critical', () => this.clear());
    }
  }

  /**
   * Add item to collection
   */
  add(data: T): void {
    this.items.push({
      timestamp: Date.now(),
      data,
    });

    // Cleanup if exceeding max items
    if (this.items.length > this.maxItems) {
      this.cleanup();
    }
  }

  /**
   * Get items within time window
   */
  getItems(): T[] {
    this.cleanup();
    return this.items.map((item) => item.data);
  }

  /**
   * Clean up old items outside time window
   */
  cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.items = this.items.filter((item) => item.timestamp > cutoff);

    // Also enforce max items limit
    if (this.items.length > this.maxItems) {
      this.items = this.items.slice(-this.maxItems);
    }
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Stop periodic cleanup
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get collection statistics
   */
  getStats() {
    return {
      itemCount: this.items.length,
      oldestItem: this.items[0]?.timestamp,
      newestItem: this.items[this.items.length - 1]?.timestamp,
      windowMs: this.windowMs,
      maxItems: this.maxItems,
    };
  }
}

/**
 * Validate memory leak fix by monitoring collection growth
 */
export function validateMemoryLeakFix<T>(
  collection: TimeWindowedCollection<T>,
  testDuration: number = 10000
): Promise<boolean> {
  return new Promise((resolve) => {
    // const startStats = collection.getStats(); // Reserved for future use
    const memoryMonitor = MemoryMonitor.getInstance();
    const startMemory = memoryMonitor.getCurrentMemory();

    // Add many items rapidly
    const interval = setInterval(() => {
      for (let i = 0; i < 100; i++) {
        collection.add({} as T);
      }
    }, 100);

    // Check after test duration
    setTimeout(() => {
      clearInterval(interval);

      const endStats = collection.getStats();
      const endMemory = memoryMonitor.getCurrentMemory();

      // Validate that collection size is bounded
      const isSizeBounded = endStats.itemCount <= endStats.maxItems;

      // Validate that memory growth is reasonable
      let isMemoryStable = true;
      if (startMemory && endMemory) {
        const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;
        const growthMB = memoryGrowth / 1024 / 1024;
        isMemoryStable = growthMB < 50; // Less than 50MB growth
      }

      const isValid = isSizeBounded && isMemoryStable;

      console.log('Memory leak validation:', {
        sizeBounded: isSizeBounded,
        memoryStable: isMemoryStable,
        itemCount: endStats.itemCount,
        memoryGrowthMB:
          endMemory && startMemory
            ? Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
            : 'N/A',
      });

      resolve(isValid);
    }, testDuration);
  });
}
