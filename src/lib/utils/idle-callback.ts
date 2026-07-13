/**
 * Shared idle-deferral helper.
 *
 * Defers work that doesn't affect first paint (background sync triggers,
 * secondary status checks) until the main thread is idle, keeping it off the
 * LCP critical path. See https://github.com/bdougie/contributor.info/issues/1815
 *
 * Follows the same requestIdleCallback + setTimeout fallback pattern used in
 * route-prefetch.ts and query-client.ts (Safari has no requestIdleCallback).
 */

/** Cancels a pending idle callback scheduled by {@link runWhenIdle}. */
export type CancelIdleCallback = () => void;

interface RunWhenIdleOptions {
  /** Max time to wait for an idle period before forcing the callback. */
  timeout?: number;
  /** Delay used by the setTimeout fallback when requestIdleCallback is unavailable. */
  fallbackDelay?: number;
}

export function runWhenIdle(
  callback: () => void,
  { timeout = 2000, fallbackDelay = 100 }: RunWhenIdleOptions = {}
): CancelIdleCallback {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = setTimeout(callback, fallbackDelay);
  return () => clearTimeout(id);
}
