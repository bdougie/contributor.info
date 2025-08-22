/**
 * Lazy-loaded PostHog integration for performance monitoring
 * This module dynamically imports PostHog only when needed to minimize bundle impact
 */

import { env } from './env';

// PostHog instance cache
let posthogInstance: any = null;
let posthogLoadPromise: Promise<any> | null = null;

/**
 * Configuration for PostHog initialization
 */
const POSTHOG_CONFIG = {
  api_host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
  // Minimal configuration to reduce impact
  autocapture: false, // Disable autocapture to reduce overhead
  capture_pageview: false, // We'll manually track page views if needed
  capture_pageleave: false, // Disable automatic page leave tracking
  disable_session_recording: true, // No session recording for performance
  advanced_disable_decide: true, // Disable feature flag evaluation
  disable_surveys: true, // No surveys
  disable_compression: false, // Keep compression for smaller payloads
  bootstrap: {
    distinctID: undefined, // Will be set on init
  },
  loaded: () => {
    // Callback when PostHog is loaded
    console.log('PostHog loaded successfully');
  }
};

/**
 * Check if PostHog should be enabled based on environment
 */
function shouldEnablePostHog(): boolean {
  // Only enable if we have the required configuration
  if (!env.POSTHOG_KEY) {
    return false;
  }

  // Disable in development unless explicitly enabled
  if (env.DEV && !localStorage.getItem('enablePostHogDev')) {
    return false;
  }

  // Check if user has opted out
  if (localStorage.getItem('posthog_opt_out') === 'true') {
    return false;
  }

  return true;
}

/**
 * Lazy load PostHog library
 */
async function loadPostHog(): Promise<any> {
  if (!shouldEnablePostHog()) {
    return null;
  }

  // Return cached instance if available
  if (posthogInstance) {
    return posthogInstance;
  }

  // Return existing load promise if in progress
  if (posthogLoadPromise) {
    return posthogLoadPromise;
  }

  // Start loading PostHog
  posthogLoadPromise = import('posthog-js').then(({ default: posthog }) => {
    // Initialize PostHog with minimal configuration
    posthog.init(env.POSTHOG_KEY!, POSTHOG_CONFIG);
    
    // Set a unique ID for the user (using a hash of user agent + timestamp)
    const distinctId = generateDistinctId();
    posthog.identify(distinctId);
    
    posthogInstance = posthog;
    return posthog;
  }).catch(error => {
    console.error('Failed to load PostHog:', error);
    posthogLoadPromise = null; // Reset so we can retry
    return null;
  });

  return posthogLoadPromise;
}

/**
 * Generate a stable distinct ID for the user
 */
function generateDistinctId(): string {
  const stored = localStorage.getItem('contributor_info_distinct_id');
  if (stored) {
    return stored;
  }

  // Create a new ID based on timestamp and random value
  const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('contributor_info_distinct_id', id);
  return id;
}

/**
 * Track Web Vitals metrics in PostHog
 */
export async function trackWebVitals(metrics: {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  navigationType: string;
}): Promise<void> {
  if (!shouldEnablePostHog()) {
    return;
  }

  try {
    const posthog = await loadPostHog();
    if (!posthog) return;

    // Send Web Vitals as a custom event
    posthog.capture('web_vitals', {
      metric_name: metrics.name,
      metric_value: metrics.value,
      metric_rating: metrics.rating,
      metric_delta: metrics.delta,
      navigation_type: metrics.navigationType,
      page_url: window.location.href,
      page_path: window.location.pathname,
      // Performance context
      connection_type: (navigator as any).connection?.effectiveType,
      device_memory: (navigator as any).deviceMemory,
      hardware_concurrency: navigator.hardwareConcurrency,
      // Timestamp
      timestamp: new Date().toISOString(),
    });

    // Also set user properties for the latest metrics
    posthog.people.set({
      [`latest_${metrics.name.toLowerCase()}`]: metrics.value,
      [`latest_${metrics.name.toLowerCase()}_rating`]: metrics.rating,
      last_web_vitals_update: new Date().toISOString(),
    });
  } catch (error) {
    // Silently fail - we don't want tracking errors to impact the app
    if (env.DEV) {
      console.error('Failed to track Web Vitals in PostHog:', error);
    }
  }
}

/**
 * Track custom performance metrics
 */
export async function trackPerformanceMetric(
  name: string, 
  value: number, 
  metadata?: Record<string, any>
): Promise<void> {
  if (!shouldEnablePostHog()) {
    return;
  }

  try {
    const posthog = await loadPostHog();
    if (!posthog) return;

    posthog.capture('performance_metric', {
      metric_name: name,
      metric_value: value,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (env.DEV) {
      console.error('Failed to track performance metric:', error);
    }
  }
}

/**
 * Batch track multiple Web Vitals metrics
 */
export async function batchTrackWebVitals(
  metrics: Array<{
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta?: number;
  }>
): Promise<void> {
  if (!shouldEnablePostHog()) {
    return;
  }

  try {
    const posthog = await loadPostHog();
    if (!posthog) return;

    // Create a summary object for all metrics
    const summary: Record<string, any> = {
      timestamp: new Date().toISOString(),
      page_url: window.location.href,
      page_path: window.location.pathname,
    };

    // Add each metric to the summary
    metrics.forEach(metric => {
      summary[`${metric.name.toLowerCase()}_value`] = metric.value;
      summary[`${metric.name.toLowerCase()}_rating`] = metric.rating;
      if (metric.delta !== undefined) {
        summary[`${metric.name.toLowerCase()}_delta`] = metric.delta;
      }
    });

    // Send as a single batch event
    posthog.capture('web_vitals_batch', summary);
  } catch (error) {
    if (env.DEV) {
      console.error('Failed to batch track Web Vitals:', error);
    }
  }
}

/**
 * Enable PostHog in development (for testing)
 */
export function enablePostHogInDev(): void {
  localStorage.setItem('enablePostHogDev', 'true');
  console.log('PostHog enabled in development mode');
}

/**
 * Disable PostHog in development
 */
export function disablePostHogInDev(): void {
  localStorage.removeItem('enablePostHogDev');
  console.log('PostHog disabled in development mode');
}

/**
 * Opt out of PostHog tracking
 */
export async function optOutOfPostHog(): Promise<void> {
  localStorage.setItem('posthog_opt_out', 'true');
  
  // If PostHog is loaded, call its opt out method
  if (posthogInstance) {
    posthogInstance.opt_out_capturing();
  }
}

/**
 * Opt back into PostHog tracking
 */
export async function optInToPostHog(): Promise<void> {
  localStorage.removeItem('posthog_opt_out');
  
  // If PostHog is loaded, call its opt in method
  if (posthogInstance) {
    posthogInstance.opt_in_capturing();
  }
}

/**
 * Get PostHog instance (if loaded)
 */
export function getPostHogInstance(): any {
  return posthogInstance;
}

/**
 * Check if PostHog is enabled and loaded
 */
export function isPostHogEnabled(): boolean {
  return shouldEnablePostHog() && posthogInstance !== null;
}