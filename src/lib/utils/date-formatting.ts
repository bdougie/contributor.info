/**
 * Centralized date formatting utilities for consistent date handling across the codebase.
 * Addresses timezone bugs and data mismatches by providing standardized formatters.
 * Also includes monthly cycle calculations and contributor tracking date helpers.
 */

import { MonthlyCycleState, CyclePhase } from '../contributors/types';

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
 * Format is determined by the dateOnly parameter.
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
    end: createDateForDBQuery(endDate, dateOnly),
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

  return dates.map((date) => {
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

/**
 * Gets the current monthly cycle state
 */
export function getCurrentMonthlyCycleState(): MonthlyCycleState {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calculate previous month
  const previousDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousDate.getMonth();
  const previousYear = previousDate.getFullYear();

  // Determine phase: 1st-7th = winner announcement, 8th+ = running leaderboard
  const phase = dayOfMonth <= 7 ? CyclePhase.WINNER_ANNOUNCEMENT : CyclePhase.RUNNING_LEADERBOARD;

  return {
    phase,
    currentMonth: {
      month: currentMonth,
      year: currentYear,
    },
    previousMonth: {
      month: previousMonth,
      year: previousYear,
    },
    dayOfMonth,
    isTransitioning: dayOfMonth <= 2, // First few days might have transition effects
  };
}

/**
 * Gets the start and end dates for a specific month
 */
export function getMonthDateRange(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month, end of day

  return { startDate, endDate };
}

/**
 * Gets the start and end dates for the current month
 */
export function getCurrentMonthDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  return getMonthDateRange(now.getMonth(), now.getFullYear());
}

/**
 * Gets the start and end dates for the previous month
 */
export function getPreviousMonthDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return getMonthDateRange(previousDate.getMonth(), previousDate.getFullYear());
}

/**
 * Checks if a date falls within a specific month and year
 */
export function isDateInMonth(date: Date, month: number, year: number): boolean {
  return date.getMonth() === month && date.getFullYear() === year;
}

/**
 * Checks if the current time is within the winner announcement phase (1st-7th of month)
 */
export function isWinnerAnnouncementPhase(): boolean {
  const now = new Date();
  const dayOfMonth = now.getDate();
  return dayOfMonth <= 7;
}

/**
 * Checks if the current time is within the running leaderboard phase (8th+ of month)
 */
export function isRunningLeaderboardPhase(): boolean {
  return !isWinnerAnnouncementPhase();
}

/**
 * Gets the number of days remaining in the current month
 */
export function getDaysRemainingInMonth(): number {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDayOfMonth - now.getDate();
}

/**
 * Gets the number of days elapsed in the current month
 */
export function getDaysElapsedInMonth(): number {
  const now = new Date();
  return now.getDate();
}

/**
 * Formats a month and year for display
 */
export function formatMonth(month: number, year: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Gets a human-readable phase description
 */
export function getPhaseDescription(phase: CyclePhase): string {
  switch (phase) {
    case CyclePhase.WINNER_ANNOUNCEMENT:
      return 'Winner Announcement Period';
    case CyclePhase.RUNNING_LEADERBOARD:
      return 'Active Competition Period';
    default:
      return 'Unknown Phase';
  }
}

/**
 * Calculates the time until the next phase transition
 */
export function getTimeUntilNextPhase(): { days: number; phase: CyclePhase } {
  const now = new Date();
  const dayOfMonth = now.getDate();

  if (dayOfMonth <= 7) {
    // Currently in winner announcement, next transition is to running leaderboard on 8th
    const nextPhaseDate = new Date(now.getFullYear(), now.getMonth(), 8);
    const timeDiff = nextPhaseDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    return {
      days: daysUntil,
      phase: CyclePhase.RUNNING_LEADERBOARD,
    };
  } else {
    // Currently in running leaderboard, next transition is to winner announcement on 1st of next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const timeDiff = nextMonth.getTime() - now.getTime();
    const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    return {
      days: daysUntil,
      phase: CyclePhase.WINNER_ANNOUNCEMENT,
    };
  }
}

/**
 * Checks if two dates are in the same month and year
 */
export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
}

/**
 * Gets the first and last day of the current week
 */
export function getCurrentWeekDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate start of week (Sunday)
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - day);
  startDate.setHours(0, 0, 0, 0);

  // Calculate end of week (Saturday)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}
