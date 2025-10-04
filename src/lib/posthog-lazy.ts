/**
 * Lazy-loaded PostHog integration for performance monitoring
 * This module dynamically imports PostHog only when needed to minimize bundle impact
 */

import { env } from './env';

// Constants for localStorage keys
const POSTHOG_DEV_ENABLED_KEY = 'enablePostHogDev';
const POSTHOG_OPT_OUT_KEY = 'posthog_opt_out';

// Type definition for PostHog instance methods we use
interface PostHogInstance {
  capture: (eventName: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, properties?: Record<string, unknown>) => void;
  opt_out_capturing: () => void;
  opt_in_capturing: () => void;
  people: {
    set: (properties: Record<string, unknown>) => void;
  };
}

// PostHog instance cache
let posthogInstance: PostHogInstance | null = null;
let posthogLoadPromise: Promise<PostHogInstance | null> | null = null;

// Rate limiting for events
const rateLimiter = {
  events: new Map<string, number[]>(),
  maxEventsPerMinute: 60,
  maxEventsPerHour: 1000,

  canSendEvent(eventName: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // Get or create event history
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    const eventHistory = this.events.get(eventName)!;

    // Clean old events
    const recentEvents = eventHistory.filter((time) => time > oneHourAgo);
    this.events.set(eventName, recentEvents);

    // Check rate limits
    const eventsInLastMinute = recentEvents.filter((time) => time > oneMinuteAgo).length;
    const eventsInLastHour = recentEvents.length;

    if (eventsInLastMinute >= this.maxEventsPerMinute) {
      console.warn(
        `[PostHog] Rate limit exceeded for ${eventName}: ${eventsInLastMinute} events in last minute`
      );
      return false;
    }

    if (eventsInLastHour >= this.maxEventsPerHour) {
      console.warn(
        `[PostHog] Rate limit exceeded for ${eventName}: ${eventsInLastHour} events in last hour`
      );
      return false;
    }

    // Record this event
    recentEvents.push(now);
    return true;
  },

  reset() {
    this.events.clear();
  },
};

// Security validation
function validateApiKey(key: string): boolean {
  // PostHog API keys should match expected format
  // Format: phc_[alphanumeric string]
  const posthogKeyPattern = /^phc_[A-Za-z0-9]{32,}$/;

  if (!posthogKeyPattern.test(key)) {
    console.error('[PostHog] Invalid API key format. PostHog keys should start with "phc_"');
    return false;
  }

  return true;
}

/**
 * Configuration for PostHog initialization
 * Privacy-first approach: only identifies users after login, uses autocapture for baseline tracking
 */
const POSTHOG_CONFIG = {
  api_host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
  // Privacy-first configuration
  person_profiles: 'identified_only' as const, // Only create profiles for identified users (4x cheaper)
  autocapture: true, // Enable autocapture for better tracking
  capture_pageview: true, // Track page views
  capture_pageleave: true, // Track page leaves
  disable_session_recording: false, // Enable session recording
  enable_recording_console_log: false, // Don't record console logs
  session_recording: {
    // Session recording configuration - explicitly enable
    maskAllInputs: true, // Mask sensitive input fields
    maskTextSelector: '.sensitive', // CSS selector for sensitive text to mask
    blockSelector: '.no-record', // CSS selector for elements to completely block
    recordCanvas: false, // Don't record canvas elements for performance
    recordCrossOriginIframes: false,
    // Simplified network capture config
    captureNetworkTelemetry: false, // Disable network capture for now
  },
  advanced_disable_decide: false, // Keep enabled to allow session recording to work
  disable_surveys: true, // No surveys
  disable_compression: false, // Keep compression for smaller payloads
  bootstrap: {
    distinctID: undefined, // Will be set on init
  },
  loaded: () => {
    // Callback when PostHog is loaded
    console.log('[PostHog] Initialized successfully for', window.location.hostname);
    if (window.location.hostname === 'localhost') {
      console.log('[PostHog] Note: Events may not be sent in development mode');
    }
  },
};

/**
 * Check if PostHog should be enabled based on environment
 */
function shouldEnablePostHog(): boolean {
  // Only enable if we have the required configuration
  if (!env.POSTHOG_KEY) {
    return false;
  }

  // Validate API key format for security
  if (!validateApiKey(env.POSTHOG_KEY)) {
    return false;
  }

  // Disable in development unless explicitly enabled
  if (env.DEV && !localStorage.getItem(POSTHOG_DEV_ENABLED_KEY)) {
    return false;
  }

  // Check if user has opted out
  if (localStorage.getItem(POSTHOG_OPT_OUT_KEY) === 'true') {
    return false;
  }

  // Filter out internal users (bdougie account)
  if (isInternalUser()) {
    return false;
  }

  return true;
}

/**
 * Lazy load PostHog library
 */
async function loadPostHog(): Promise<PostHogInstance | null> {
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
  posthogLoadPromise = import('posthog-js')
    .then(({ default: posthog }) => {
      // Initialize PostHog with privacy-first configuration
      posthog.init(env.POSTHOG_KEY!, POSTHOG_CONFIG);

      // In production, ensure session recording is started
      if (!env.DEV && typeof posthog.startSessionRecording === 'function') {
        posthog.startSessionRecording();
      }

      // Don't identify users automatically - only after login
      // This uses anonymous events which are 4x cheaper
      // Note: We only call posthog.identify() after user login/signup

      posthogInstance = posthog as PostHogInstance;
      return posthog as PostHogInstance;
    })
    .catch((error) => {
      console.error('Failed to load PostHog:', error);
      posthogLoadPromise = null; // Reset so we can retry
      return null;
    });

  return posthogLoadPromise;
}

/**
 * Generate a stable distinct ID for the user (used in identifyUser)
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

  // Apply rate limiting
  if (!rateLimiter.canSendEvent('web_vitals')) {
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
      connection_type: (navigator as unknown as { connection?: { effectiveType?: string } })
        .connection?.effectiveType,
      device_memory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
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
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!shouldEnablePostHog()) {
    return;
  }

  // Apply rate limiting
  if (!rateLimiter.canSendEvent('performance_metric')) {
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

  // Apply rate limiting for batch events
  if (!rateLimiter.canSendEvent('web_vitals_batch')) {
    return;
  }

  try {
    const posthog = await loadPostHog();
    if (!posthog) return;

    // Create a summary object for all metrics
    const summary: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      page_url: window.location.href,
      page_path: window.location.pathname,
    };

    // Add each metric to the summary
    metrics.forEach((metric) => {
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
  localStorage.setItem(POSTHOG_DEV_ENABLED_KEY, 'true');
  console.log('PostHog enabled in development mode');
}

/**
 * Disable PostHog in development
 */
export function disablePostHogInDev(): void {
  localStorage.removeItem(POSTHOG_DEV_ENABLED_KEY);
  console.log('PostHog disabled in development mode');
}

/**
 * Opt out of PostHog tracking
 */
export async function optOutOfPostHog(): Promise<void> {
  localStorage.setItem(POSTHOG_OPT_OUT_KEY, 'true');

  // If PostHog is loaded, call its opt out method
  if (posthogInstance) {
    posthogInstance.opt_out_capturing();
  }
}

/**
 * Opt back into PostHog tracking
 */
export async function optInToPostHog(): Promise<void> {
  localStorage.removeItem(POSTHOG_OPT_OUT_KEY);

  // If PostHog is loaded, call its opt in method
  if (posthogInstance) {
    posthogInstance.opt_in_capturing();
  }
}

/**
 * Get PostHog instance (if loaded)
 */
export function getPostHogInstance(): PostHogInstance | null {
  return posthogInstance;
}

/**
 * Check if PostHog is enabled and loaded
 */
export function isPostHogEnabled(): boolean {
  return shouldEnablePostHog() && posthogInstance !== null;
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  rateLimiter.reset();
}

/**
 * Check if the current user is an internal user (should be filtered from analytics)
 */
function isInternalUser(): boolean {
  // Filter bdougie account based on various indicators
  try {
    // Check for GitHub username in localStorage (if user is logged in)
    const githubUser = localStorage.getItem('github_user');
    if (githubUser) {
      const user = JSON.parse(githubUser);
      if (user.login === 'bdougie') {
        return true;
      }
    }

    // Check URL patterns that indicate bdougie is the user
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // If viewing bdougie's repositories as the owner
    if (pathname.startsWith('/bdougie/')) {
      return true;
    }

    // Development environment check
    if (hostname === 'localhost' || hostname.includes('127.0.0.1')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Identify user in PostHog (only call after login/signup)
 */
export async function identifyUser(
  userId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!shouldEnablePostHog()) {
    return;
  }

  try {
    const posthog = await loadPostHog();
    if (!posthog) return;

    // Only identify if not an internal user
    if (!isInternalUser()) {
      // Use the stored distinct ID or generate a new one
      const distinctId = generateDistinctId();
      posthog.identify(userId, {
        signup_date: new Date().toISOString(),
        distinct_id: distinctId,
        ...properties,
      });
      console.log('[PostHog] User identified:', userId);
    }
  } catch (error) {
    if (env.DEV) {
      console.error('Failed to identify user in PostHog:', error);
    }
  }
}

/**
 * Track custom events (for high-value actions)
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!shouldEnablePostHog()) {
    return;
  }

  // Apply rate limiting
  if (!rateLimiter.canSendEvent(eventName)) {
    return;
  }

  try {
    const posthog = await loadPostHog();
    if (!posthog) return;

    posthog.capture(eventName, {
      timestamp: new Date().toISOString(),
      ...properties,
    });
  } catch (error) {
    if (env.DEV) {
      console.error('Failed to track event in PostHog:', error);
    }
  }
}

/**
 * Get rate limiter stats for monitoring
 */
export function getRateLimiterStats(): {
  eventCounts: Map<string, number>;
  limits: { perMinute: number; perHour: number };
} {
  const eventCounts = new Map<string, number>();
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  rateLimiter.events.forEach((times, eventName) => {
    const recentCount = times.filter((time) => time > oneMinuteAgo).length;
    eventCounts.set(eventName, recentCount);
  });

  return {
    eventCounts,
    limits: {
      perMinute: rateLimiter.maxEventsPerMinute,
      perHour: rateLimiter.maxEventsPerHour,
    },
  };
}

/**
 * Initialize PostHog (for manual initialization)
 * Returns a promise that resolves when PostHog is loaded
 */
export async function initPostHog(): Promise<PostHogInstance | null> {
  return loadPostHog();
}
