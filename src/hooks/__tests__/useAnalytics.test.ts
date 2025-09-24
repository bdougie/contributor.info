import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAnalytics } from '../useAnalytics';

describe('useAnalytics', () => {
  let originalEnv: boolean | undefined;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = import.meta.env?.DEV;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    if (import.meta.env) {
      import.meta.env.DEV = originalEnv;
    }
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should return a track function', () => {
    const { result } = renderHook(() => useAnalytics());
    expect(result.current).toHaveProperty('track');
    expect(typeof result.current.track).toBe('function');
  });

  it('should log events in development mode', () => {
    import.meta.env.DEV = true;
    const { result } = renderHook(() => useAnalytics());

    result.current.track('test_event', { foo: 'bar' });

    expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'test_event', { foo: 'bar' });
  });

  it('should not log events in production mode', () => {
    import.meta.env.DEV = false;
    const { result } = renderHook(() => useAnalytics());

    result.current.track('test_event', { foo: 'bar' });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should warn about non-snake_case event names in development', () => {
    import.meta.env.DEV = true;
    const { result } = renderHook(() => useAnalytics());

    result.current.track('testEvent', { foo: 'bar' });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Analytics] Event name "%s" should be snake_case',
      'testEvent'
    );
  });

  it('should handle events without properties', () => {
    import.meta.env.DEV = true;
    const { result } = renderHook(() => useAnalytics());

    result.current.track('simple_event');

    expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'simple_event', undefined);
  });

  it('should not throw errors even if logging fails', () => {
    import.meta.env.DEV = true;
    consoleLogSpy.mockImplementation(() => {
      throw new Error('Console log failed');
    });

    const { result } = renderHook(() => useAnalytics());

    // Should not throw
    expect(() => {
      result.current.track('test_event');
    }).not.toThrow();
  });

  it('should handle different property types', () => {
    import.meta.env.DEV = true;
    const { result } = renderHook(() => useAnalytics());

    const properties = {
      stringProp: 'test',
      numberProp: 123,
      booleanProp: true,
    };

    result.current.track('typed_event', properties);

    expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'typed_event', properties);
  });

  it('should be a stable reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useAnalytics());
    const firstTrack = result.current.track;

    rerender();
    const secondTrack = result.current.track;

    expect(firstTrack).toBe(secondTrack);
  });
});
