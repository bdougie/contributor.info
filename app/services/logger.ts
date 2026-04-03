/**
 * Structured logger utility for services
 * Provides consistent logging format with context prefixes
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
   * Format log message with context prefix and metadata
   */
  private formatMessage(level: string, message: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();

    // Handle parameterized logging to prevent format string vulnerabilities
    if (args.length > 0) {
      return { timestamp, level, context: this.context, message, params: args };
    }

    return { timestamp, level, context: this.context, message };
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('INFO', message, ...args);

    // Use parameterized console.log to prevent format string vulnerabilities
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
    const formatted = this.formatMessage('WARN', message, ...args);

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
    const formatted = this.formatMessage('ERROR', message, ...args);

    // Use parameterized console.error to prevent format string vulnerabilities
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
      const formatted = this.formatMessage('DEBUG', message, ...args);

      if (args.length > 0) {
        console.log('[%s] DEBUG: %s', this.context, message, ...args);
      } else {
        console.log('[%s] DEBUG: %s', this.context, message);
      }
    }
  }
}

// Default logger instance
export default new Logger();
