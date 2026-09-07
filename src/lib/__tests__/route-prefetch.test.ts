import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prefetchCriticalRoutes, clearPrefetchCache } from '../route-prefetch';

type IdleWindow = { requestIdleCallback?: typeof window.requestIdleCallback };

/**
 * `prefetchCriticalRoutes` schedules one outer idle callback which, when fired, calls
 * `prefetchRoute` for each critical route. Each of those schedules its own idle callback
 * that performs the dynamic import. These tests fire only the outer callback: the inner
 * ones are counted, never run, so no chunk import is started (see bulletproof guidelines).
 */
describe('prefetchCriticalRoutes', () => {
  let requestIdleCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearPrefetchCache();
    requestIdleCallback = vi.fn().mockReturnValue(1);
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('prefetches the three critical routes from the landing page', () => {
    prefetchCriticalRoutes('/');

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(requestIdleCallback.mock.calls[0][1]).toEqual({ timeout: 5000 });

    // Fire the outer idle callback: one prefetch is scheduled per critical route
    requestIdleCallback.mock.calls[0][0]();
    expect(requestIdleCallback).toHaveBeenCalledTimes(4);
    for (const call of requestIdleCallback.mock.calls.slice(1)) {
      expect(call[1]).toEqual({ timeout: 2000 });
    }
  });

  it('still prefetches from repo pages', () => {
    prefetchCriticalRoutes('/facebook/react');
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/i/my-team',
    '/i/my-team/prs',
    '/workspaces',
    '/workspaces/my-team',
    '/workspaces/new',
  ])('prefetches nothing on workspace route %s', (pathname) => {
    prefetchCriticalRoutes(pathname);
    expect(requestIdleCallback).not.toHaveBeenCalled();
  });

  it('schedules nothing on workspace routes when falling back to setTimeout', () => {
    vi.useFakeTimers();
    const win = window as IdleWindow;
    delete win.requestIdleCallback;

    prefetchCriticalRoutes('/i/my-team');

    expect(vi.getTimerCount()).toBe(0);
  });

  it('schedules the setTimeout fallback on the landing page', () => {
    vi.useFakeTimers();
    const win = window as IdleWindow;
    delete win.requestIdleCallback;

    prefetchCriticalRoutes('/');

    expect(vi.getTimerCount()).toBe(1);
  });
});
