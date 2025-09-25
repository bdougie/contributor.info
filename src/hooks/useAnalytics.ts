/**
 * Analytics hook for privacy-first event tracking
 *
 * This hook provides a simple interface for tracking user events
 * without collecting any personally identifiable information.
 * Events are fire-and-forget and fail silently to not impact UX.
 */

import { useCallback } from 'react';

export function useAnalytics() {
  const track = useCallback(
    (eventName: string, properties?: Record<string, string | number | boolean>) => {
      // Fire-and-forget analytics - fails silently by design
      try {
        // Validate event name is snake_case for consistency (dev only)
        if (import.meta.env?.DEV && !/^[a-z]+(_[a-z]+)*$/.test(eventName)) {
          console.warn('[Analytics] Event name "%s" should be snake_case', eventName);
        }

        // For now, just log to console in development
        // Use Vite-safe environment detection
        if (import.meta.env?.DEV) {
          console.log('[Analytics]', eventName, properties);
        }

        // Future: Send to analytics service
        // This will be implemented when we choose an analytics provider
        // Options: PostHog, Plausible, Mixpanel, etc.
      } catch {
        // Intentionally swallow errors - analytics should never break the app
      }
    },
    []
  );

  return { track };
}
