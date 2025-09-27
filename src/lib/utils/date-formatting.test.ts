import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toDateOnlyString,
  toUTCTimestamp,
  createDateForDBQuery,
  formatDateSafely,
  createDateRange,
  getDateDaysAgo,
  formatByType,
  type DateFormatType
} from './date-formatting';

describe('Date Formatting Utilities', () => {
  // Use a fixed date for consistent testing
  const testDate = new Date('2025-01-27T14:30:00.000Z');
  const mockCurrentDate = new Date('2025-01-27T12:00:00.000Z');

  beforeEach(() => {
    // Mock Date constructor to return consistent dates
    vi.useFakeTimers();
    vi.setSystemTime(mockCurrentDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toDateOnlyString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      expect(toDateOnlyString(testDate)).toBe('2025-01-27');
    });

    it('should handle dates across different timezones consistently', () => {
      const utcDate = new Date('2025-01-27T23:59:59.999Z');
      expect(toDateOnlyString(utcDate)).toBe('2025-01-27');
    });

    it('should handle dates at midnight UTC', () => {
      const midnightDate = new Date('2025-01-27T00:00:00.000Z');
      expect(toDateOnlyString(midnightDate)).toBe('2025-01-27');
    });
  });

  describe('toUTCTimestamp', () => {
    it('should return full ISO 8601 timestamp', () => {
      expect(toUTCTimestamp(testDate)).toBe('2025-01-27T14:30:00.000Z');
    });

    it('should preserve milliseconds in timestamp', () => {
      const dateWithMs = new Date('2025-01-27T14:30:00.123Z');
      expect(toUTCTimestamp(dateWithMs)).toBe('2025-01-27T14:30:00.123Z');
    });
  });

  describe('createDateForDBQuery', () => {
    it('should return date-only when dateOnly is true', () => {
      expect(createDateForDBQuery(testDate, true)).toBe('2025-01-27');
    });

    it('should return full timestamp when dateOnly is false', () => {
      expect(createDateForDBQuery(testDate, false)).toBe('2025-01-27T14:30:00.000Z');
    });

    it('should default to full timestamp when dateOnly is not specified', () => {
      expect(createDateForDBQuery(testDate)).toBe('2025-01-27T14:30:00.000Z');
    });
  });

  describe('formatDateSafely', () => {
    it('should format valid Date objects', () => {
      expect(formatDateSafely(testDate, true)).toBe('2025-01-27');
      expect(formatDateSafely(testDate, false)).toBe('2025-01-27T14:30:00.000Z');
    });

    it('should format valid date strings', () => {
      expect(formatDateSafely('2025-01-27T14:30:00.000Z', true)).toBe('2025-01-27');
      expect(formatDateSafely('2025-01-27', false)).toBe('2025-01-27T00:00:00.000Z');
    });

    it('should return null for null or undefined values', () => {
      expect(formatDateSafely(null)).toBeNull();
      expect(formatDateSafely(undefined)).toBeNull();
    });

    it('should return null for invalid date strings', () => {
      expect(formatDateSafely('invalid-date')).toBeNull();
      expect(formatDateSafely('2025-13-45')).toBeNull(); // Invalid month/day
    });

    it('should handle empty strings', () => {
      expect(formatDateSafely('')).toBeNull();
    });
  });

  describe('createDateRange', () => {
    it('should create date-only range by default', () => {
      const startDate = new Date('2025-01-01T00:00:00.000Z');
      const endDate = new Date('2025-01-31T23:59:59.999Z');
      const range = createDateRange(startDate, endDate);

      expect(range.start).toBe('2025-01-01');
      expect(range.end).toBe('2025-01-31');
    });

    it('should create timestamp range when dateOnly is false', () => {
      const startDate = new Date('2025-01-01T00:00:00.000Z');
      const endDate = new Date('2025-01-31T23:59:59.999Z');
      const range = createDateRange(startDate, endDate, false);

      expect(range.start).toBe('2025-01-01T00:00:00.000Z');
      expect(range.end).toBe('2025-01-31T23:59:59.999Z');
    });

    it('should handle same-day ranges', () => {
      const sameDay = new Date('2025-01-27T12:00:00.000Z');
      const range = createDateRange(sameDay, sameDay, true);

      expect(range.start).toBe('2025-01-27');
      expect(range.end).toBe('2025-01-27');
    });
  });

  describe('getDateDaysAgo', () => {
    it('should calculate date N days ago in date-only format', () => {
      // Current mock date is 2025-01-27
      expect(getDateDaysAgo(30)).toBe('2024-12-28');
      expect(getDateDaysAgo(7)).toBe('2025-01-20');
      expect(getDateDaysAgo(1)).toBe('2025-01-26');
    });

    it('should return timestamp format when dateOnly is false', () => {
      const result = getDateDaysAgo(7, false);
      expect(result).toBe('2025-01-20T12:00:00.000Z');
    });

    it('should handle zero days (today)', () => {
      expect(getDateDaysAgo(0)).toBe('2025-01-27');
    });

    it('should handle large day values', () => {
      // Account for leap years - 2024 is a leap year
      expect(getDateDaysAgo(365)).toBe('2024-01-28');
    });
  });

  describe('formatByType', () => {
    it('should format as date-only', () => {
      expect(formatByType(testDate, 'date-only')).toBe('2025-01-27');
    });

    it('should format as full-timestamp', () => {
      expect(formatByType(testDate, 'full-timestamp')).toBe('2025-01-27T14:30:00.000Z');
    });

    it('should format as utc-timestamp', () => {
      expect(formatByType(testDate, 'utc-timestamp')).toBe('2025-01-27T14:30:00.000Z');
    });

    it('should default to full timestamp for unknown type', () => {
      expect(formatByType(testDate, 'unknown' as DateFormatType)).toBe('2025-01-27T14:30:00.000Z');
    });
  });

  describe('Timezone edge cases', () => {
    it('should handle dates near timezone boundaries consistently', () => {
      // Test dates that might be different days in different timezones
      const edgeCases = [
        new Date('2025-01-27T23:59:59.999Z'), // End of day UTC
        new Date('2025-01-28T00:00:00.000Z'), // Start of next day UTC
        new Date('2025-01-27T00:00:00.000Z'), // Start of day UTC
      ];

      expect(toDateOnlyString(edgeCases[0])).toBe('2025-01-27');
      expect(toDateOnlyString(edgeCases[1])).toBe('2025-01-28');
      expect(toDateOnlyString(edgeCases[2])).toBe('2025-01-27');
    });

    it('should maintain consistency across DST transitions', () => {
      // Test dates around daylight saving time transitions
      const dstSpring = new Date('2025-03-09T07:00:00.000Z'); // Spring forward
      const dstFall = new Date('2025-11-02T06:00:00.000Z'); // Fall back

      expect(toDateOnlyString(dstSpring)).toBe('2025-03-09');
      expect(toDateOnlyString(dstFall)).toBe('2025-11-02');
    });
  });

  describe('Performance considerations', () => {
    it('should handle bulk date formatting efficiently', () => {
      const dates = Array.from({ length: 1000 }, (_, i) =>
        new Date(2025, 0, i % 28 + 1)
      );

      const startTime = performance.now();
      dates.forEach(date => toDateOnlyString(date));
      const endTime = performance.now();

      // Should process 1000 dates in under 50ms
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});