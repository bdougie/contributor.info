/**
 * SSR Hydration Utilities
 *
 * Utilities for detecting and using server-side rendered content.
 * Enables seamless hydration where React takes over SSR content without re-rendering.
 */

import { logger } from './logger';

/**
 * SSR Data structure injected by edge functions
 */
export interface SSRData {
  route: string;
  data: unknown;
  timestamp: number;
}

/**
 * Type guard for SSR data
 */
function isValidSSRData(data: unknown): data is SSRData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.route === 'string' && typeof obj.timestamp === 'number' && 'data' in obj;
}

/**
 * Get SSR data from window if available
 */
export function getSSRData(): SSRData | null {
  if (typeof window === 'undefined') return null;

  const ssrData = (window as { __SSR_DATA__?: unknown }).__SSR_DATA__;

  if (!ssrData) return null;

  if (!isValidSSRData(ssrData)) {
    logger.warn('[SSR] Invalid SSR data structure detected');
    return null;
  }

  return ssrData;
}

/**
 * Check if the current page was server-side rendered
 */
export function isSSRPage(): boolean {
  return getSSRData() !== null;
}

/**
 * Get SSR data for a specific route
 */
export function getSSRDataForRoute<T = unknown>(route: string): T | null {
  const ssrData = getSSRData();

  if (!ssrData) return null;

  // Normalize routes for comparison
  const normalizedSSRRoute = ssrData.route.replace(/\/$/, '');
  const normalizedRoute = route.replace(/\/$/, '');

  if (normalizedSSRRoute !== normalizedRoute) {
    return null;
  }

  return ssrData.data as T;
}

/**
 * Check if SSR data is stale (older than maxAge in seconds)
 */
export function isSSRDataStale(maxAgeSeconds = 300): boolean {
  const ssrData = getSSRData();

  if (!ssrData) return true;

  const now = Date.now();
  const age = (now - ssrData.timestamp) / 1000;

  return age > maxAgeSeconds;
}

/**
 * Clear SSR data after hydration
 * Call this after React has fully hydrated to prevent memory leaks
 */
export function clearSSRData(): void {
  if (typeof window !== 'undefined') {
    delete (window as { __SSR_DATA__?: unknown }).__SSR_DATA__;
    logger.debug('[SSR] SSR data cleared after hydration');
  }
}

/**
 * Check if we should use hydration vs. create new root
 */
export function shouldHydrate(): boolean {
  // Check if root has content (SSR rendered)
  const root = document.getElementById('root');
  if (!root) return false;

  // Check if there's actual content (O(1) operation vs expensive innerHTML serialization)
  const hasContent = root.hasChildNodes();

  // Check if SSR data exists
  const hasSSRData = isSSRPage();

  // Check for SSR marker header
  const isSSRRendered = document.querySelector('meta[name="x-ssr-rendered"]') !== null;

  return hasContent && (hasSSRData || isSSRRendered);
}

/**
 * Mark hydration as started
 * Adds a marker to indicate hydration has been initiated.
 * Note: This is called synchronously after hydrateRoot(), which is asynchronous.
 * React does not provide a callback for when hydration actually completes.
 */
export function markHydrationStarted(): void {
  if (typeof window !== 'undefined') {
    (window as { __SSR_HYDRATION_STARTED__?: boolean }).__SSR_HYDRATION_STARTED__ = true;
    logger.debug('[SSR] Hydration started');
  }
}

/**
 * Check if hydration has been started
 */
export function isHydrationStarted(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as { __SSR_HYDRATION_STARTED__?: boolean }).__SSR_HYDRATION_STARTED__ === true;
}
