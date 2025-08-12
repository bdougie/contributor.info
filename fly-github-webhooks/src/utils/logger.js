/**
 * Structured logger utility for GitHub webhook service
 * Provides consistent logging format with context prefixes
 */

class Logger {
  constructor(context = 'WebhookService') {
    this.context = context;
  }

  /**
   * Format log message with context prefix and metadata
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${this.context}]`;
    
    // Handle parameterized logging to prevent format string vulnerabilities
    if (args.length > 0) {
      return { timestamp, level, context: this.context, message, params: args };
    }
    
    return { timestamp, level, context: this.context, message };
  }

  /**
   * Log info message
   */
  info(message, ...args) {
    const formatted = this.formatMessage('INFO', message, ...args);
    
    // Use parameterized console.log to prevent format string vulnerabilities
    if (args.length > 0) {
      console.log(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`, ...args);
    } else {
      console.log(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`);
    }
  }

  /**
   * Log error message
   */
  error(message, ...args) {
    const formatted = this.formatMessage('ERROR', message, ...args);
    
    // Use parameterized console.error to prevent format string vulnerabilities
    if (args.length > 0) {
      console.error(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`, ...args);
    } else {
      console.error(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`);
    }
  }

  /**
   * Log warning message
   */
  warn(message, ...args) {
    const formatted = this.formatMessage('WARN', message, ...args);
    
    if (args.length > 0) {
      console.warn(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`, ...args);
    } else {
      console.warn(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`);
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('DEBUG', message, ...args);
      
      if (args.length > 0) {
        console.log(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`, ...args);
      } else {
        console.log(`${formatted.timestamp} [${formatted.context}] ${formatted.level}: ${message}`);
      }
    }
  }

  /**
   * Log webhook event with structured data
   */
  webhook(event, delivery, repository, action, installation) {
    const data = {
      event,
      delivery,
      repository: repository || 'unknown',
      action,
      installation
    };
    
    console.log(`${new Date().toISOString()} [${this.context}] WEBHOOK:`, JSON.stringify(data));
  }

  /**
   * Create a child logger with additional context
   */
  child(subContext) {
    return new Logger(`${this.context}:${subContext}`);
  }
}

// Export singleton instance for main server
export const logger = new Logger('WebhookService');

// Export class for creating child loggers
export default Logger;