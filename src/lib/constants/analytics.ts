/**
 * Constants for analytics dashboard
 */

// Time periods
export const TIME_PERIODS = {
  THIRTY_DAYS_MS: 30 * 24 * 60 * 60 * 1000,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
} as const;

// Data limits
export const DATA_LIMITS = {
  SHARE_EVENTS_LIMIT: 100,
  RECENT_SHARES_DISPLAY: 20,
  TOP_REPOSITORIES_DISPLAY: 10,
  REPOSITORY_LIST_DISPLAY: 8,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  SYSTEM_METRICS_FAILED: 'Unable to load system metrics. Please try again.',
  SHARE_METRICS_FAILED: 'Unable to load sharing metrics. Please try again.',
  GENERAL_FETCH_FAILED: 'Unable to load analytics data. Please check your connection and try again.',
} as const;