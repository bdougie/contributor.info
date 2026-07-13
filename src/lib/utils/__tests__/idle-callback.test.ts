import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runWhenIdle } from '../idle-callback';

describe('runWhenIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses requestIdleCallback with the given timeout when available', () => {
    const requestIdleCallback = vi.fn().mockReturnValue(42);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const callback = vi.fn();
    runWhenIdle(callback, { timeout: 1234 });

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(requestIdleCallback.mock.calls[0][1]).toEqual({ timeout: 1234 });

    // Simulate the browser firing the idle callback
    requestIdleCallback.mock.calls[0][0]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancel unregisters the idle callback', () => {
    const requestIdleCallback = vi.fn().mockReturnValue(42);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const cancel = runWhenIdle(vi.fn());
    cancel();

    expect(cancelIdleCallback).toHaveBeenCalledWith(42);
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    const original = (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;

    try {
      const callback = vi.fn();
      runWhenIdle(callback, { fallbackDelay: 100 });

      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      if (original !== undefined) {
        (window as { requestIdleCallback?: unknown }).requestIdleCallback = original;
      }
    }
  });

  it('cancel clears the setTimeout fallback', () => {
    const original = (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;

    try {
      const callback = vi.fn();
      const cancel = runWhenIdle(callback, { fallbackDelay: 100 });
      cancel();

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) {
        (window as { requestIdleCallback?: unknown }).requestIdleCallback = original;
      }
    }
  });
});
