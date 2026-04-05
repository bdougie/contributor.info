/**
 * Structured logger utility for services
 * Provides consistent logging format with context prefixes
 *
 * All logging uses printf-style %s placeholders (never template literals)
 * to prevent format string injection vulnerabilities.
 *
 * @see https://contributor.info/docs
 */

export class Logger {
  private context: string;

  constructor(context = 'Service') {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.log('[%s] %s', this.context, message, ...args);
    } else {
      console.log('[%s] %s', this.context, message);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.warn('[%s] %s', this.context, message, ...args);
    } else {
      console.warn('[%s] %s', this.context, message);
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.error('[%s] ERROR: %s', this.context, message, ...args);
    } else {
      console.error('[%s] ERROR: %s', this.context, message);
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      if (args.length > 0) {
        console.log('[%s] DEBUG: %s', this.context, message, ...args);
      } else {
        console.log('[%s] DEBUG: %s', this.context, message);
      }
    }
  }
}

/**
 * Create a new Logger instance with the given context name.
 *
 * Usage:
 * ```ts
 * const logger = createLogger('my-module');
 * logger.info('something happened');
 * logger.error('failed to process', error);
 * ```
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Default logger instance
export default new Logger();
