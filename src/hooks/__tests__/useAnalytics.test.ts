import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAnalytics } from '../useAnalytics';

describe('useAnalytics', () => {
  let originalEnv: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV || '';
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleLogSpy.mockRestore();
  });

  it('should return a track function', () => {
    const { result } = renderHook(() => useAnalytics());
    expect(result.current).toHaveProperty('track');
    expect(typeof result.current.track).toBe('function');
  });

  it('should log events in development mode', () => {
    process.env.NODE_ENV = 'development';
    const { result } = renderHook(() => useAnalytics());

    result.current.track('test_event', { foo: 'bar' });

    expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'test_event', { foo: 'bar' });
  });

  it('should not log events in production mode', () => {
    process.env.NODE_ENV = 'production';
    const { result } = renderHook(() => useAnalytics());

    result.current.track('test_event', { foo: 'bar' });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should handle events without properties', () => {
    process.env.NODE_ENV = 'development';
    const { result } = renderHook(() => useAnalytics());

    result.current.track('simple_event');

    expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'simple_event', undefined);
  });

  it('should not throw errors even if logging fails', () => {
    process.env.NODE_ENV = 'development';
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
    process.env.NODE_ENV = 'development';
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
