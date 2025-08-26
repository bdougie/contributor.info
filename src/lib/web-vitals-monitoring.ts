import {
  onCLS,
  onINP,
  onFCP,
  onLCP,
  onTTFB,
  CLSMetric,
  INPMetric,
  FCPMetric,
  LCPMetric,
  TTFBMetric,
} from 'web-vitals';
import { getWebVitalsAnalytics } from './web-vitals-analytics';

// Core Web Vitals thresholds (in milliseconds)
const THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint
  INP: 200, // Interaction to Next Paint
  CLS: 0.1, // Cumulative Layout Shift (no unit)
  FCP: 1800, // First Contentful Paint
  TTFB: 800, // Time to First Byte
};

// Performance ratings
type Rating = 'good' | 'needs-improvement' | 'poor';

interface VitalMetric {
  name: string;
  value: number;
  rating: Rating;
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
}

interface PerformanceData {
  metrics: Map<string, VitalMetric>;
  pageLoadTime: number;
  route: string;
}

class WebVitalsMonitor {
  private metrics: Map<string, VitalMetric> = new Map();
  private callbacks: Set<(metric: VitalMetric) => void> = new Set();
  private debugMode: boolean = false;
  private reportingEndpoint?: string;
  private batchedMetrics: VitalMetric[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(options?: { debug?: boolean; reportingEndpoint?: string }) {
    this.debugMode = options?.debug || false;
    this.reportingEndpoint = options?.reportingEndpoint;

    // Initialize monitoring
    this.initializeVitalsTracking();
  }

  private initializeVitalsTracking() {
    // Core Web Vitals
    onLCP(this.handleLCP.bind(this));
    onINP(this.handleINP.bind(this));
    onCLS(this.handleCLS.bind(this));

    // Additional metrics
    onFCP(this.handleFCP.bind(this));
    onTTFB(this.handleTTFB.bind(this));

    // Track page load time
    if (typeof window !== 'undefined' && window.performance) {
      const navigationEntry = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const pageLoadTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
        this.logMetric('page-load', pageLoadTime, this.getRating('page-load', pageLoadTime));
      }
    }
  }

  private getRating(metricName: string, value: number): Rating {
    switch (metricName) {
      case 'LCP':
        if (value <= THRESHOLDS.LCP) return 'good';
        if (value <= THRESHOLDS.LCP * 1.5) return 'needs-improvement';
        return 'poor';

      case 'INP':
        if (value <= THRESHOLDS.INP) return 'good';
        if (value <= THRESHOLDS.INP * 2.5) return 'needs-improvement';
        return 'poor';

      case 'CLS':
        if (value <= THRESHOLDS.CLS) return 'good';
        if (value <= THRESHOLDS.CLS * 2.5) return 'needs-improvement';
        return 'poor';

      case 'FCP':
        if (value <= THRESHOLDS.FCP) return 'good';
        if (value <= THRESHOLDS.FCP * 1.5) return 'needs-improvement';
        return 'poor';

      case 'TTFB':
        if (value <= THRESHOLDS.TTFB) return 'good';
        if (value <= THRESHOLDS.TTFB * 2) return 'needs-improvement';
        return 'poor';

      default:
        return 'needs-improvement';
    }
  }

  private createMetric(
    name: string,
    value: number,
    rating: Rating,
    delta: number = 0,
  ): VitalMetric {
    return {
      name,
      value,
      rating,
      delta,
      id: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      navigationType: this.getNavigationType(),
      url: window.location.href,
      timestamp: Date.now(),
    };
  }

  private getNavigationType(): string {
    if (typeof window === 'undefined' || !window.performance) return 'unknown';

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return 'unknown';

    // PerformanceNavigationTiming.type is a string in modern browsers
    const navType = navigation.type;
    if (navType === 'navigate') return 'navigate';
    if (navType === 'reload') return 'reload';
    if (navType === 'back_forward') return 'back-forward';
    if (navType === 'prerender') return 'prerender';

    // Fallback for older browsers that might use numeric types
    return 'unknown';
  }

  private handleLCP(metric: LCPMetric) {
    const vitalMetric = this.createMetric(
      'LCP',
      metric.value,
      metric.rating as Rating,
      metric.delta,
    );
    this.logMetric('LCP', metric.value, metric.rating as Rating, metric.delta);
    this.notifyCallbacks(vitalMetric);

    // Send to analytics
    getWebVitalsAnalytics().trackMetric(vitalMetric);
  }

  private handleINP(metric: INPMetric) {
    const vitalMetric = this.createMetric(
      'INP',
      metric.value,
      metric.rating as Rating,
      metric.delta,
    );
    this.logMetric('INP', metric.value, metric.rating as Rating, metric.delta);
    this.notifyCallbacks(vitalMetric);

    // Send to analytics
    getWebVitalsAnalytics().trackMetric(vitalMetric);
  }

  private handleCLS(metric: CLSMetric) {
    const vitalMetric = this.createMetric(
      'CLS',
      metric.value,
      metric.rating as Rating,
      metric.delta,
    );
    this.logMetric('CLS', metric.value, metric.rating as Rating, metric.delta);
    this.notifyCallbacks(vitalMetric);

    // Send to analytics
    getWebVitalsAnalytics().trackMetric(vitalMetric);
  }

  private handleFCP(metric: FCPMetric) {
    const vitalMetric = this.createMetric(
      'FCP',
      metric.value,
      metric.rating as Rating,
      metric.delta,
    );
    this.logMetric('FCP', metric.value, metric.rating as Rating, metric.delta);
    this.notifyCallbacks(vitalMetric);

    // Send to analytics
    getWebVitalsAnalytics().trackMetric(vitalMetric);
  }

  private handleTTFB(metric: TTFBMetric) {
    const vitalMetric = this.createMetric(
      'TTFB',
      metric.value,
      metric.rating as Rating,
      metric.delta,
    );
    this.logMetric('TTFB', metric.value, metric.rating as Rating, metric.delta);
    this.notifyCallbacks(vitalMetric);

    // Send to analytics
    getWebVitalsAnalytics().trackMetric(vitalMetric);
  }

  private logMetric(name: string, value: number, rating: Rating, delta: number = 0) {
    const metric = this.createMetric(name, value, rating, delta);
    this.metrics.set(name, metric);

    if (this.debugMode) {
      // Use lookup objects instead of nested ternaries
      const ratingEmojis: Record<string, string> = {
        good: '✅',
        'needs-improvement': '⚠️',
        poor: '❌',
      };

      const ratingColors: Record<string, string> = {
        good: 'green',
        'needs-improvement': 'orange',
        poor: 'red',
      };

      const emoji = ratingEmojis[rating] || '❌';
      const color = ratingColors[rating] || 'red';
      const formattedValue = name === 'CLS' ? value.toFixed(3) : `${(value / 1000).toFixed(2)}s`;

      console.log(
        `%c[Web Vitals] ${emoji} ${name}: ${formattedValue} (${rating})`,
        `color: ${color}`,
      );
    }

    // Batch metrics for reporting
    if (this.reportingEndpoint) {
      this.batchMetric(metric);
    }
  }

  private batchMetric(metric: VitalMetric) {
    this.batchedMetrics.push(metric);

    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Set new timer to send batch after 3 seconds of inactivity
    this.batchTimer = setTimeout(() => {
      this.sendBatchedMetrics();
    }, 3000);
  }

  private async sendBatchedMetrics() {
    if (this.batchedMetrics.length === 0 || !this.reportingEndpoint) return;

    const metricsToSend = [...this.batchedMetrics];
    this.batchedMetrics = [];

    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: metricsToSend,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          connection:
            (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
              ?.effectiveType || 'unknown',
        }),
      });
    } catch (error) {
      if (this.debugMode) {
        console.error("Error:", error);
      }
    }
  }

  private notifyCallbacks(metric: VitalMetric) {
    this.callbacks.forEach((callback) => {
      try {
        callback(metric);
      } catch (error) {
        console.error("Error:", error);
      }
    });
  }

  // Public API
  public onMetric(callback: (metric: VitalMetric) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  public getMetrics(): PerformanceData {
    const navigationEntry = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;
    const pageLoadTime = navigationEntry
      ? navigationEntry.loadEventEnd - navigationEntry.fetchStart
      : 0;

    return {
      metrics: new Map(this.metrics),
      pageLoadTime,
      route: window.location.pathname,
    };
  }

  public getSummary() {
    const metrics = this.getMetrics();
    const summary: Record<string, unknown> = {};

    metrics.metrics.forEach((metric, name) => {
      summary[name] = {
        value: metric.value,
        rating: metric.rating,
        threshold: THRESHOLDS[name as keyof typeof THRESHOLDS],
        pass: metric.rating === 'good',
      };
    });

    return summary;
  }

  public reset() {
    this.metrics.clear();
    this.batchedMetrics = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
  }

  public destroy() {
    this.reset();
    this.callbacks.clear();
  }
}

// Create singleton instance
let monitorInstance: WebVitalsMonitor | null = null;

export function initializeWebVitalsMonitoring(options?: {
  debug?: boolean;
  reportingEndpoint?: string;
}) {
  if (!monitorInstance) {
    monitorInstance = new WebVitalsMonitor(options);
  }
  return monitorInstance;
}

export function getWebVitalsMonitor() {
  if (!monitorInstance) {
    throw new Error('WebVitalsMonitor not initialized. Call initializeWebVitalsMonitoring first.');
  }
  return monitorInstance;
}

export type { VitalMetric, PerformanceData, Rating };
export { THRESHOLDS, WebVitalsMonitor };
