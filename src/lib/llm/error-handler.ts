/**
 * Centralized error handling for LLM services
 * Provides consistent error reporting and fallback strategies
 */

export interface LLMError {
  type: 'api_error' | 'network_error' | 'rate_limit' | 'auth_error' | 'timeout' | 'unknown';
  message: string;
  code?: string | number;
  retryable: boolean;
  fallbackAvailable: boolean;
  userMessage: string;
  timestamp: Date;
}

export interface ErrorHandlingConfig {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  enableFallbacks: boolean;
  logErrors: boolean;
}

class LLMErrorHandler {
  private config: ErrorHandlingConfig;
  private errorLog: LLMError[] = [];

  constructor(config: Partial<ErrorHandlingConfig> = {}) {
    this.config = {
      enableRetry: true,
      maxRetries: 2,
      retryDelay: 1000, // 1 second
      enableFallbacks: true,
      logErrors: true,
      ...config,
    };
  }

  /**
   * Process and categorize errors from LLM operations
   */
  handleError(error: Error | { message?: string; code?: string | number; name?: string }, context: string): LLMError {
    const llmError = this.categorizeError(error, context);

    if (this.config.logErrors) {
      this.logError(llmError);
    }

    return llmError;
  }

  /**
   * Categorize error based on type and provide appropriate handling
   */
  private categorizeError(error: Error | { message?: string; code?: string | number; name?: string }, context: string): LLMError {
    const timestamp = new Date();

    // OpenAI API specific errors
    if (error.message?.includes('rate limit')) {
      return {
        type: 'rate_limit',
        message: `Rate limit exceeded in ${context}`,
        code: 429,
        retryable: true,
        fallbackAvailable: true,
        userMessage:
          'AI insights temporarily unavailable due to high demand. Using cached or rule-based insights.',
        timestamp,
      };
    }

    if (error.message?.includes('Invalid OpenAI API key') || error.message?.includes('401')) {
      return {
        type: 'auth_error',
        message: `Authentication failed in ${context}`,
        code: 401,
        retryable: false,
        fallbackAvailable: true,
        userMessage:
          'AI insights unavailable - configuration issue. Using rule-based insights instead.',
        timestamp,
      };
    }

    if (error.message?.includes('timeout') || error.name === 'AbortError') {
      return {
        type: 'timeout',
        message: `Request timeout in ${context}`,
        code: 'TIMEOUT',
        retryable: true,
        fallbackAvailable: true,
        userMessage:
          'AI service is slow - using cached or rule-based insights for faster response.',
        timestamp,
      };
    }

    // Network errors
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return {
        type: 'network_error',
        message: `Network error in ${context}: ${error.message}`,
        retryable: true,
        fallbackAvailable: true,
        userMessage: 'Connection issue detected. Using offline insights.',
        timestamp,
      };
    }

    // API errors (non-auth, non-rate-limit)
    const errorCode = 'code' in error ? error.code : undefined;
    if (error.message?.includes('API error') || (errorCode && typeof errorCode === 'number' && errorCode >= 400)) {
      return {
        type: 'api_error',
        message: `API error in ${context}: ${error.message}`,
        code: errorCode,
        retryable: typeof errorCode === 'number' && errorCode >= 500, // Server errors are retryable
        fallbackAvailable: true,
        userMessage: 'AI service temporarily unavailable. Using alternative insights.',
        timestamp,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: `Unknown error in ${context}: ${error.message || 'Unknown error'}`,
      retryable: false,
      fallbackAvailable: true,
      userMessage: 'Unexpected issue with AI insights. Using standard analysis instead.',
      timestamp,
    };
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(error: LLMError): void {
    console.error('LLM Error:', {
      type: error.type,
      message: error.message,
      code: error.code,
      timestamp: error.timestamp,
      retryable: error.retryable,
    });

    // Keep last 50 errors for debugging
    this.errorLog.push(error);
    if (this.errorLog.length > 50) {
      this.errorLog.shift();
    }
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error: LLMError, attemptCount: number): boolean {
    if (!this.config.enableRetry || attemptCount >= this.config.maxRetries) {
      return false;
    }

    return error.retryable;
  }

  /**
   * Get retry delay with exponential backoff
   */
  getRetryDelay(attemptCount: number): number {
    return this.config.retryDelay * Math.pow(2, attemptCount);
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: LLMError[];
    errorRate: number;
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentErrors = this.errorLog.filter((error) => error.timestamp > last24Hours);

    const errorsByType = this.errorLog.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      recentErrors,
      errorRate: recentErrors.length / 24, // errors per hour
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Generate user-friendly error message for UI
   */
  getUserMessage(error: LLMError): string {
    return error.userMessage;
  }

  /**
   * Check if fallback should be used
   */
  shouldUseFallback(error: LLMError): boolean {
    return this.config.enableFallbacks && error.fallbackAvailable;
  }
}

// Export singleton instance
export const llmErrorHandler = new LLMErrorHandler();

// Export utilities for components
export const createErrorBoundaryProps = () => ({
  onError: (error: Error) => {
    llmErrorHandler.handleError(error, 'React Error Boundary');
  },
});

export const withErrorHandling = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  fallbackFn?: (...args: T) => R
) => {
  return async (...args: T): Promise<R | null> => {
    let attemptCount = 0;

    while (attemptCount <= (llmErrorHandler as any).config.maxRetries) {
      try {
        return await fn(...args);
      } catch (error) {
        const llmError = llmErrorHandler.handleError(error as Error, context);

        if (llmErrorHandler.shouldRetry(llmError, attemptCount)) {
          attemptCount++;
          const delay = llmErrorHandler.getRetryDelay(attemptCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If fallback is available and should be used
        if (fallbackFn && llmErrorHandler.shouldUseFallback(llmError)) {
          try {
            return fallbackFn(...args);
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
          }
        }

        // Log final failure
        console.error('LLM operation failed after retries:', llmError.userMessage);
        return null;
      }
    }

    return null;
  };
};
