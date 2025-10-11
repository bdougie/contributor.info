/**
 * Production-safe logging utility
 *
 * Debug/info/log output is disabled in production to reduce noise.
 * Errors remain visible in production for critical debugging.
 * Use Inngest logs for detailed production debugging.
 */

import { env } from './env';

const isDevelopment = env.DEV || env.MODE === 'development';

/**
 * Logging utility with production-safe defaults
 * - debug/info/log: Development only
 * - warn: Development only
 * - error: Always logged (production and development) - errors are critical
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: unknown[]) => {
    // ALWAYS log errors, even in production - they are critical for debugging
    console.error(...args);
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

/**
 * Legacy support - export console-like object
 */
export default logger;
