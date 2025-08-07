/**
 * Retry utility with exponential backoff and circuit breaker pattern
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: Set<string>;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

// Default retry configuration
export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: new Set(['NetworkError', 'TimeoutError', '503', '429', '500', '502', '504'])
};

// Default circuit breaker configuration
export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 3
};

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  canAttempt(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenAttempts = 0;
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return this.halfOpenAttempts < this.config.halfOpenRequests;
      
      default:
        return false;
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.halfOpenAttempts = 0;
      this.successCount = 0;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenAttempts = 0;
  }
}

// Global circuit breakers per endpoint
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const delay = Math.min(exponentialDelay, config.maxDelay);
  
  // Add jitter (±25% randomization) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof Error) {
    // Check error name
    if (config.retryableErrors.has(error.name)) {
      return true;
    }
    
    // Check error message for HTTP status codes
    const message = error.message.toLowerCase();
    for (const retryable of config.retryableErrors) {
      if (message.includes(retryable.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Check if it's a fetch response with retryable status
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = String((error as { status: number }).status);
    return config.retryableErrors.has(status);
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff and circuit breaker
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  circuitBreakerKey?: string,
  circuitBreakerConfig: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  const retryConfig = { ...defaultRetryConfig, ...config };
  
  // Get or create circuit breaker if key provided
  let circuitBreaker: CircuitBreaker | undefined;
  if (circuitBreakerKey) {
    if (!circuitBreakers.has(circuitBreakerKey)) {
      circuitBreakers.set(
        circuitBreakerKey,
        new CircuitBreaker({ ...defaultCircuitBreakerConfig, ...circuitBreakerConfig })
      );
    }
    circuitBreaker = circuitBreakers.get(circuitBreakerKey);
  }
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
    // Check circuit breaker
    if (circuitBreaker && !circuitBreaker.canAttempt()) {
      throw new Error(`Circuit breaker is open for ${circuitBreakerKey}`);
    }
    
    try {
      const result = await fn();
      
      // Record success in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Record failure in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }
      
      // Check if we should retry
      if (attempt <= retryConfig.maxRetries && isRetryableError(error, retryConfig)) {
        const delay = calculateDelay(attempt, retryConfig);
        
        // Call onRetry callback if provided
        if (retryConfig.onRetry) {
          retryConfig.onRetry(error as Error, attempt);
        }
        
        // Log retry attempt
        console.log(
          `%s`,
          `Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms for error:`,
          error
        );
        
        await sleep(delay);
      } else {
        // Non-retryable error or max retries reached
        break;
      }
    }
  }
  
  throw lastError;
}

/**
 * Create a retryable version of a function
 */
export function createRetryableFunction<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  config: Partial<RetryConfig> = {},
  circuitBreakerKey?: string
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), config, circuitBreakerKey);
  }) as T;
}

/**
 * Reset a circuit breaker
 */
export function resetCircuitBreaker(key: string): void {
  const breaker = circuitBreakers.get(key);
  if (breaker) {
    breaker.reset();
  }
}

/**
 * Get circuit breaker state
 */
export function getCircuitBreakerState(key: string): string | null {
  const breaker = circuitBreakers.get(key);
  return breaker ? breaker.getState() : null;
}

/**
 * Clear all circuit breakers
 */
export function clearAllCircuitBreakers(): void {
  circuitBreakers.clear();
}