/**
 * Centralized date formatting utilities for consistent date handling across the codebase.
 * Addresses timezone bugs and data mismatches by providing standardized formatters.
 */

/**
 * Converts a Date object to a date-only string (YYYY-MM-DD).
 * Use this for database queries that compare dates without time components.
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * const dateOnly = toDateOnlyString(new Date()); // "2025-01-27"
 */
export const toDateOnlyString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Converts a Date object to a full UTC timestamp string.
 * Use this for storing exact timestamps with timezone information.
 *
 * @param date - The date to format
 * @returns Full ISO 8601 timestamp string
 *
 * @example
 * const timestamp = toUTCTimestamp(new Date()); // "2025-01-27T14:30:00.000Z"
 */
export const toUTCTimestamp = (date: Date): string => {
  return date.toISOString();
};

/**
 * Creates a date string formatted for database queries.
 * Automatically determines the appropriate format based on the use case.
 *
 * @param date - The date to format
 * @param dateOnly - Whether to return date-only (true) or full timestamp (false)
 * @returns Formatted date string for database queries
 *
 * @example
 * // For date comparison queries
 * const queryDate = createDateForDBQuery(new Date(), true); // "2025-01-27"
 *
 * // For timestamp storage
 * const timestamp = createDateForDBQuery(new Date(), false); // "2025-01-27T14:30:00.000Z"
 */
export const createDateForDBQuery = (date: Date, dateOnly: boolean = false): string => {
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
 */
export const createDateRange = (
  startDate: Date,
  endDate: Date,
  dateOnly: boolean = true
): { start: string; end: string } => {
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
 *
 * @example
 * const thirtyDaysAgo = getDateDaysAgo(30, true); // "2024-12-28"
 */
export const getDateDaysAgo = (days: number, dateOnly: boolean = true): string => {
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
 */
export const formatByType = (date: Date, type: DateFormatType): string => {
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