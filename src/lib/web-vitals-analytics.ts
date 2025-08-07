import { supabase } from './supabase';
import type { VitalMetric } from './web-vitals-monitoring';

// Analytics providers
export type AnalyticsProvider = 'supabase' | 'posthog' | 'custom';

interface WebVitalsEvent {
  metric_name: string;
  metric_value: number;
  metric_rating: 'good' | 'needs-improvement' | 'poor';
  metric_delta?: number;
  page_url: string;
  page_path: string;
  navigation_type: string;
  session_id: string;
  user_agent: string;
  viewport_width: number;
  viewport_height: number;
  screen_width: number;
  screen_height: number;
  connection_type?: string;
  device_memory?: number;
  hardware_concurrency?: number;
  timestamp: string;
  repository?: string;
}

interface PerformanceAlert {
  metric_name: string;
  threshold: number;
  actual_value: number;
  severity: 'warning' | 'critical';
  page_url: string;
  timestamp: string;
}

class WebVitalsAnalytics {
  private sessionId: string;
  private providers: Set<AnalyticsProvider> = new Set(['supabase']);
  private alertThresholds: Map<string, { warning: number; critical: number }> = new Map([
    ['LCP', { warning: 2500, critical: 4000 }],
    ['INP', { warning: 200, critical: 500 }],
    ['CLS', { warning: 0.1, critical: 0.25 }],
    ['FCP', { warning: 1800, critical: 3000 }],
    ['TTFB', { warning: 800, critical: 1800 }],
  ]);
  private metricsBuffer: WebVitalsEvent[] = [];
  private bufferTimer?: NodeJS.Timeout;
  private readonly BUFFER_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_BUFFER_SIZE = 20;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    
    // Flush metrics on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushMetricsSync();
      });
    }
  }

  private getOrCreateSessionId(): string {
    // Guard against SSR where window/sessionStorage don't exist
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return `vitals_ssr_${Date.now()}`;
    }
    
    const storageKey = 'contributor-info-vitals-session';
    let sessionId = sessionStorage.getItem(storageKey);
    
    if (!sessionId) {
      const randomBytes = new Uint8Array(16);
      window.crypto.getRandomValues(randomBytes);
      const randomString = Array.from(randomBytes, byte => byte.toString(36)).join('').substr(0, 9);
      sessionId = `vitals_${Date.now()}_${randomString}`;
      sessionStorage.setItem(storageKey, sessionId);
    }
    
    return sessionId;
  }

  /**
   * Track a Web Vital metric
   */
  public async trackMetric(metric: VitalMetric): Promise<void> {
    const event = this.createWebVitalsEvent(metric);
    
    // Add to buffer
    this.metricsBuffer.push(event);
    
    // Check for alerts
    this.checkForAlerts(metric);
    
    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flushMetrics();
    } else {
      // Set timer to flush buffer
      this.scheduleFlush();
    }
  }

  private createWebVitalsEvent(metric: VitalMetric): WebVitalsEvent {
    const repository = this.extractRepository(window.location.pathname);
    
    return {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: metric.rating,
      metric_delta: metric.delta,
      page_url: window.location.href,
      page_path: window.location.pathname,
      navigation_type: metric.navigationType,
      session_id: this.sessionId,
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      connection_type: (navigator as any).connection?.effectiveType,
      device_memory: (navigator as any).deviceMemory,
      hardware_concurrency: navigator.hardwareConcurrency,
      timestamp: new Date().toISOString(),
      repository,
    };
  }

  private extractRepository(pathname: string): string | undefined {
    // Extract repository from path like /owner/repo
    const match = pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    return match ? `${match[1]}/${match[2]}` : undefined;
  }

  private scheduleFlush(): void {
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }
    
    this.bufferTimer = setTimeout(() => {
      this.flushMetrics();
    }, this.BUFFER_TIMEOUT);
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;
    
    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    // Send to enabled providers
    const promises: Promise<void>[] = [];
    
    if (this.providers.has('supabase')) {
      promises.push(this.sendToSupabase(metricsToSend));
    }
    
    if (this.providers.has('posthog')) {
      promises.push(this.sendToPostHog(metricsToSend));
    }
    
    if (this.providers.has('custom')) {
      promises.push(this.sendToCustomEndpoint(metricsToSend));
    }
    
    await Promise.allSettled(promises);
  }

  private flushMetricsSync(): void {
    if (this.metricsBuffer.length === 0) return;
    
    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    // Use sendBeacon for reliable delivery on page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const data = JSON.stringify({
        events: metricsToSend,
        sessionId: this.sessionId,
      });
      
      // Send to custom endpoint using sendBeacon
      if (this.providers.has('custom') && this.customEndpoint) {
        navigator.sendBeacon(this.customEndpoint, data);
      }
      
      // For Supabase, we'd need a special endpoint that accepts beacon data
      // For now, we'll try to use a synchronous XMLHttpRequest as fallback
      if (this.providers.has('supabase')) {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${import.meta.env?.VITE_SUPABASE_URL || ''}/rest/v1/web_vitals_events`, false); // false = synchronous
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('apikey', import.meta.env?.VITE_SUPABASE_ANON_KEY || '');
          xhr.send(JSON.stringify(metricsToSend));
        } catch (err) {
          // Synchronous XHR might be blocked, fallback to beacon if possible
          console.warn('Failed to send metrics synchronously:', err);
        }
      }
    }
  }

  private async sendToSupabase(events: WebVitalsEvent[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('web_vitals_events')
        .insert(events);
      
      if (error) {
        console.error('Failed to send Web Vitals to Supabase:', error);
      }
    } catch (err) {
      console.error('Error sending Web Vitals to Supabase:', err);
    }
  }

  private async sendToPostHog(events: WebVitalsEvent[]): Promise<void> {
    // PostHog integration would go here
    // For now, just log
    if (import.meta.env?.DEV) {
      console.log('PostHog Web Vitals:', events);
    }
  }

  private async sendToCustomEndpoint(events: WebVitalsEvent[]): Promise<void> {
    // Custom endpoint integration
    const endpoint = import.meta.env?.VITE_VITALS_ENDPOINT;
    if (!endpoint) return;
    
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (err) {
      console.error('Failed to send Web Vitals to custom endpoint:', err);
    }
  }

  private checkForAlerts(metric: VitalMetric): void {
    const thresholds = this.alertThresholds.get(metric.name);
    if (!thresholds) return;
    
    let severity: 'warning' | 'critical' | null = null;
    
    if (metric.value > thresholds.critical) {
      severity = 'critical';
    } else if (metric.value > thresholds.warning) {
      severity = 'warning';
    }
    
    if (severity) {
      this.sendAlert({
        metric_name: metric.name,
        threshold: severity === 'critical' ? thresholds.critical : thresholds.warning,
        actual_value: metric.value,
        severity,
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    // Log alert in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Performance Alert] ${alert.severity.toUpperCase()}: ${alert.metric_name} = ${alert.actual_value} (threshold: ${alert.threshold})`);
    }
    
    // Send to Supabase
    try {
      const { error } = await supabase
        .from('performance_alerts')
        .insert([alert]);
      
      if (error) {
        console.error('Failed to send performance alert:', error);
      }
    } catch (err) {
      console.error('Error sending performance alert:', err);
    }
  }

  /**
   * Get aggregated Web Vitals metrics
   */
  public async getMetrics(filters?: {
    repository?: string;
    dateRange?: { start: Date; end: Date };
    metricName?: string;
  }) {
    try {
      let query = supabase
        .from('web_vitals_events')
        .select('*');
      
      if (filters?.repository) {
        query = query.eq('repository', filters.repository);
      }
      
      if (filters?.metricName) {
        query = query.eq('metric_name', filters.metricName);
      }
      
      if (filters?.dateRange) {
        query = query
          .gte('timestamp', filters.dateRange.start.toISOString())
          .lte('timestamp', filters.dateRange.end.toISOString());
      }
      
      const { data, error } = await query.order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Failed to get Web Vitals metrics:', error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error('Error getting Web Vitals metrics:', err);
      return [];
    }
  }

  /**
   * Get performance summary for a page or repository
   */
  public async getPerformanceSummary(repository?: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const metrics = await this.getMetrics({
      repository,
      dateRange: { start: oneDayAgo, end: now },
    });
    
    // Calculate percentiles and ratings
    const summary: Record<string, any> = {};
    const metricNames = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
    
    for (const metricName of metricNames) {
      const metricValues = metrics
        .filter(m => m.metric_name === metricName)
        .map(m => m.metric_value)
        .sort((a, b) => a - b);
      
      if (metricValues.length > 0) {
        summary[metricName] = {
          p50: this.percentile(metricValues, 50),
          p75: this.percentile(metricValues, 75),
          p95: this.percentile(metricValues, 95),
          good: metrics.filter(m => m.metric_name === metricName && m.metric_rating === 'good').length,
          needsImprovement: metrics.filter(m => m.metric_name === metricName && m.metric_rating === 'needs-improvement').length,
          poor: metrics.filter(m => m.metric_name === metricName && m.metric_rating === 'poor').length,
          total: metricValues.length,
        };
      }
    }
    
    return summary;
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Enable or disable analytics providers
   */
  public setProviders(providers: AnalyticsProvider[]): void {
    this.providers = new Set(providers);
  }

  /**
   * Update alert thresholds
   */
  public setAlertThreshold(metric: string, warning: number, critical: number): void {
    this.alertThresholds.set(metric, { warning, critical });
  }
}

// Singleton instance
let analyticsInstance: WebVitalsAnalytics | null = null;

export function getWebVitalsAnalytics(): WebVitalsAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new WebVitalsAnalytics();
  }
  return analyticsInstance;
}

export type { WebVitalsEvent, PerformanceAlert };