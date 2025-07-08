// Web Vitals tracking for performance monitoring
import { onCLS, onFCP, onFID, onLCP, onTTFB, type Metric } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  // Only track in production
  if (import.meta.env.DEV) return;
  
  // Send to PostHog if available
  if (window.posthog) {
    window.posthog.capture('web_vital', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_id: metric.id,
      metric_delta: metric.delta,
      metric_rating: metric.rating || 'unknown'
    });
  }
  
  // Send to console for debugging
  console.log(`[Web Vital] ${metric.name}:`, {
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta
  });
}

export function trackWebVitals() {
  // Only track in production and when supported
  if (import.meta.env.DEV || typeof window === 'undefined') return;
  
  try {
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onFID(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  } catch (error) {
    console.warn('Web Vitals tracking failed:', error);
  }
}

// Performance observer for custom metrics
export function trackCustomMetrics() {
  if (import.meta.env.DEV || !('PerformanceObserver' in window)) return;
  
  try {
    // Track largest image element for LCP optimization
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('[LCP Element]:', entry);
        }
      });
    });
    
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    
    // Track long tasks that could impact INP
    const longTaskObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > 50) {
          console.warn('[Long Task]:', {
            duration: entry.duration,
            startTime: entry.startTime
          });
          
          if (window.posthog) {
            window.posthog.capture('long_task', {
              duration: entry.duration,
              start_time: entry.startTime
            });
          }
        }
      });
    });
    
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    console.warn('Custom metrics tracking failed:', error);
  }
}

// Declare PostHog type for TypeScript
declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, any>) => void;
    };
  }
}