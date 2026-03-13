/**
 * Tests for useTimeFormatter hook
 * Per BULLETPROOF_TESTING_GUIDELINES.md - simple, synchronous tests only
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimeFormatter } from '../use-time-formatter';

describe('useTimeFormatter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    it('returns "Just now" for recent timestamps', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime('2026-03-12T11:59:30Z')).toBe('Just now');
    });

    it('returns minutes ago', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime('2026-03-12T11:55:00Z')).toBe('5 minutes ago');
    });

    it('returns hours ago', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime('2026-03-12T09:00:00Z')).toBe('3 hours ago');
    });

    it('returns days ago', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime('2026-03-10T12:00:00Z')).toBe('2 days ago');
    });

    it('returns "Unknown" for invalid date strings', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime('not-a-date')).toBe('Unknown');
    });

    it('returns "Just now" for future dates', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime('2026-03-13T12:00:00Z')).toBe('Just now');
    });

    it('accepts Date objects', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.formatRelativeTime(new Date('2026-03-12T11:55:00Z'))).toBe(
        '5 minutes ago'
      );
    });
  });

  describe('getTimeDifference', () => {
    it('returns seconds for short durations', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('2026-03-12T11:59:30Z', '2026-03-12T11:59:55Z')).toBe(
        '25 seconds'
      );
    });

    it('returns minutes for medium durations', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('2026-03-12T11:00:00Z', '2026-03-12T11:30:00Z')).toBe(
        '30 minutes'
      );
    });

    it('returns hours for longer durations', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('2026-03-12T09:00:00Z', '2026-03-12T12:00:00Z')).toBe(
        '3 hours'
      );
    });

    it('returns "Unknown duration" for invalid start date', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('garbage', '2026-03-12T12:00:00Z')).toBe(
        'Unknown duration'
      );
    });

    it('returns "Unknown duration" for invalid end date', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('2026-03-12T12:00:00Z', 'garbage')).toBe(
        'Unknown duration'
      );
    });

    it('returns "0 seconds" for negative durations', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('2026-03-12T12:00:00Z', '2026-03-12T09:00:00Z')).toBe(
        '0 seconds'
      );
    });

    it('defaults endDate to now when omitted', () => {
      const { result } = renderHook(() => useTimeFormatter());
      expect(result.current.getTimeDifference('2026-03-12T09:00:00Z')).toBe('3 hours');
    });
  });
});
