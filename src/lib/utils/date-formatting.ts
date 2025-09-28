/**
 * Centralized date formatting utilities for consistent date handling across the codebase.
 * Addresses timezone bugs and data mismatches by providing standardized formatters.
 */

/**
 * Validates that a value is a valid Date object
 * @param date - The value to validate
 * @throws Error if the date is invalid
 */
function validateDate(date: unknown, functionName: string): asserts date is Date {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error(`Invalid date provided to ${functionName}: ${date}`);
  }
}

/**
 * Converts a Date object to a date-only string (YYYY-MM-DD).
 * Use this for database queries that compare dates without time components.
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 * @throws Error if the date is invalid
 *
 * @example
 * const dateOnly = toDateOnlyString(new Date()); // "2025-01-27"
 */
export const toDateOnlyString = (date: Date): string => {
  validateDate(date, 'toDateOnlyString');
  // Use ISO string and extract date portion for consistency
  return date.toISOString().split('T')[0];
};

/**
 * Converts a Date object to a full UTC timestamp string.
 * Use this for storing exact timestamps with timezone information.
 *
 * @param date - The date to format
 * @returns Full ISO 8601 timestamp string
 * @throws Error if the date is invalid
 *
 * @example
 * const timestamp = toUTCTimestamp(new Date()); // "2025-01-27T14:30:00.000Z"
 */
export const toUTCTimestamp = (date: Date): string => {
  validateDate(date, 'toUTCTimestamp');
  return date.toISOString();
};

/**
 * Creates a date string formatted for database queries.
 * Automatically determines the appropriate format based on the use case.
 *
 * @param date - The date to format
 * @param dateOnly - Whether to return date-only (true) or full timestamp (false)
 * @returns Formatted date string for database queries
 * @throws Error if the date is invalid
 *
 * @example
 * // For date comparison queries
 * const queryDate = createDateForDBQuery(new Date(), true); // "2025-01-27"
 *
 * // For timestamp storage
 * const timestamp = createDateForDBQuery(new Date(), false); // "2025-01-27T14:30:00.000Z"
 */
export const createDateForDBQuery = (date: Date, dateOnly: boolean = false): string => {
  validateDate(date, 'createDateForDBQuery');
  return dateOnly ? toDateOnlyString(date) : toUTCTimestamp(date);
};

/**
 * Safely formats a date from various input types.
 * Handles Date objects, strings, and null/undefined values.
 *
 * @param value - Date, string, or null/undefined
 * @param dateOnly - Whether to return date-only format
 * @returns Formatted date string or null
 */
export const formatDateSafely = (
  value: Date | string | null | undefined,
  dateOnly: boolean = false
): string | null => {
  if (!value) return null;

  try {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;

    return createDateForDBQuery(date, dateOnly);
  } catch {
    return null;
  }
};

/**
 * Creates a date range for database queries.
 * Ensures consistent formatting for start and end dates.
 *
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param dateOnly - Whether to use date-only format
 * @returns Object with formatted start and end dates
 * @throws Error if either date is invalid or if startDate > endDate
 */
export const createDateRange = (
  startDate: Date,
  endDate: Date,
  dateOnly: boolean = true
): { start: string; end: string } => {
  validateDate(startDate, 'createDateRange (startDate)');
  validateDate(endDate, 'createDateRange (endDate)');

  if (startDate > endDate) {
    throw new Error(`Invalid date range: startDate (${startDate}) is after endDate (${endDate})`);
  }

  return {
    start: createDateForDBQuery(startDate, dateOnly),
    end: createDateForDBQuery(endDate, dateOnly)
  };
};

/**
 * Calculates a date in the past from the current date.
 * Useful for creating cutoff dates for queries.
 *
 * @param days - Number of days in the past
 * @param dateOnly - Whether to return date-only format
 * @returns Formatted date string
 * @throws Error if days is negative or not a number
 *
 * @example
 * const thirtyDaysAgo = getDateDaysAgo(30, true); // "2024-12-28"
 */
export const getDateDaysAgo = (days: number, dateOnly: boolean = true): string => {
  if (typeof days !== 'number' || days < 0 || !isFinite(days)) {
    throw new Error(`Invalid days parameter: ${days}. Must be a non-negative number.`);
  }

  const date = new Date();
  date.setDate(date.getDate() - days);
  return createDateForDBQuery(date, dateOnly);
};

/**
 * Type definitions for date format types
 */
export type DateFormatType = 'date-only' | 'full-timestamp' | 'utc-timestamp';

/**
 * Format a date based on the specified type
 * @throws Error if the date is invalid
 */
export const formatByType = (date: Date, type: DateFormatType): string => {
  validateDate(date, 'formatByType');

  switch (type) {
    case 'date-only':
      return toDateOnlyString(date);
    case 'full-timestamp':
    case 'utc-timestamp':
      return toUTCTimestamp(date);
    default:
      return toUTCTimestamp(date);
  }
};

// Performance optimization: Memoized date formatter for bulk operations
const dateCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 1000;

/**
 * Optimized date formatting for bulk operations with caching.
 * Useful when processing large arrays of dates.
 *
 * @param dates - Array of dates to format
 * @param dateOnly - Whether to return date-only format
 * @returns Array of formatted date strings
 */
export const formatDatesInBulk = (dates: Date[], dateOnly: boolean = true): string[] => {
  // Clear cache if it gets too large
  if (dateCache.size > CACHE_SIZE_LIMIT) {
    dateCache.clear();
  }

  return dates.map(date => {
    const cacheKey = `${date.getTime()}_${dateOnly}`;

    if (dateCache.has(cacheKey)) {
      return dateCache.get(cacheKey)!;
    }

    const formatted = createDateForDBQuery(date, dateOnly);
    dateCache.set(cacheKey, formatted);
    return formatted;
  });
};

/**
 * Clear the date format cache.
 * Call this when memory usage is a concern.
 */
export const clearDateCache = (): void => {
  dateCache.clear();
};