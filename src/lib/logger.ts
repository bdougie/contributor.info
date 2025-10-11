/**
 * Production-safe logging utility
 * 
 * Console logs are disabled in production to reduce noise.
 * Use Inngest logs for production debugging.
 */

import { env } from './env';

const isDevelopment = env.DEV || env.MODE === 'development';

/**
 * Log only in development mode
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
    // Always log errors even in production
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
