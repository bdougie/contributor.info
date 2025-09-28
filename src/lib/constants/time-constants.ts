/**
 * Time-related constants used throughout the application
 */

// Time unit multipliers
export const MILLISECONDS_PER_SECOND = 1000 as const;
export const SECONDS_PER_MINUTE = 60 as const;
export const MINUTES_PER_HOUR = 60 as const;
export const HOURS_PER_DAY = 24 as const;
export const DAYS_PER_WEEK = 7 as const;
export const DAYS_PER_MONTH = 30 as const; // Approximate

// Milliseconds conversions
export const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * HOURS_PER_DAY;
export const MILLISECONDS_PER_WEEK = MILLISECONDS_PER_DAY * DAYS_PER_WEEK;
export const MILLISECONDS_PER_MONTH = MILLISECONDS_PER_DAY * DAYS_PER_MONTH;

// Time periods in days
export const TIME_PERIODS = {
  ONE_DAY: 1,
  ONE_WEEK: 7,
  TWO_WEEKS: 14,
  ONE_MONTH: 30,
  TWO_MONTHS: 60,
  THREE_MONTHS: 90,
  SIX_MONTHS: 180,
  ONE_YEAR: 365,
  DEFAULT_METRICS_DAYS: 30,
  DEFAULT_HISTORY_DAYS: 90,
  DEFAULT_ACTIVITY_DAYS: 7,
} as const;

// Cache and TTL settings
export const CACHE_SETTINGS = {
  DEFAULT_TTL_MINUTES: 15,
  LONG_TTL_MINUTES: 60,
  SHORT_TTL_MINUTES: 5,
  STALE_DATA_HOURS: 24,
  CACHE_VERSION_TTL_HOURS: 48,
} as const;

// Timeout settings
export const TIMEOUT_SETTINGS = {
  API_TIMEOUT_MS: 30000,
  DEBOUNCE_DELAY_MS: 300,
  THROTTLE_DELAY_MS: 1000,
  RETRY_DELAY_MS: 2000,
  POLLING_INTERVAL_MS: 5000,
} as const;

// Rate limiting
export const RATE_LIMIT = {
  REQUESTS_PER_MINUTE: 60,
  REQUESTS_PER_HOUR: 1000,
  BURST_LIMIT: 10,
} as const;

// Helper functions for common conversions
export const timeHelpers = {
  daysToMs: (days: number) => days * MILLISECONDS_PER_DAY,
  hoursToMs: (hours: number) => hours * MILLISECONDS_PER_HOUR,
  minutesToMs: (minutes: number) => minutes * MILLISECONDS_PER_MINUTE,
  secondsToMs: (seconds: number) => seconds * MILLISECONDS_PER_SECOND,

  msToDays: (ms: number) => Math.floor(ms / MILLISECONDS_PER_DAY),
  msToHours: (ms: number) => Math.floor(ms / MILLISECONDS_PER_HOUR),
  msToMinutes: (ms: number) => Math.floor(ms / MILLISECONDS_PER_MINUTE),
  msToSeconds: (ms: number) => Math.floor(ms / MILLISECONDS_PER_SECOND),

  daysAgo: (days: number) => new Date(Date.now() - days * MILLISECONDS_PER_DAY),
  hoursAgo: (hours: number) => new Date(Date.now() - hours * MILLISECONDS_PER_HOUR),
  minutesAgo: (minutes: number) => new Date(Date.now() - minutes * MILLISECONDS_PER_MINUTE),
} as const;