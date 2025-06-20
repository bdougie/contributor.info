/**
 * Comprehensive resilience service with circuit breaker, bulkhead, and timeout patterns
 */

export interface ResilienceConfig {
  circuitBreaker: {
    failureThreshold: number
    resetTimeout: number
    halfOpenMaxCalls: number
  }
  timeout: {
    defaultTimeout: number
    slowCallThreshold: number
  }
  bulkhead: {
    maxConcurrentCalls: number
    maxWaitTime: number
  }
  retry: {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
  }
}

export interface ResilienceMetrics {
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureRate: number
  averageResponseTime: number
  slowCallRate: number
  rejectedCalls: number
  successfulCalls: number
  failedCalls: number
  timeoutCalls: number
  concurrentCalls: number
  queuedCalls: number
}

/**
 * Circuit breaker with enhanced states and metrics
 */
class EnhancedCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private halfOpenCalls = 0
  private metrics = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rejectedCalls: 0,
    responseTimes: [] as number[]
  }

  constructor(
    private failureThreshold = 5,
    private resetTimeout = 60000,
    private halfOpenMaxCalls = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.metrics.totalCalls++

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.transitionToHalfOpen()
      } else {
        this.metrics.rejectedCalls++
        throw new Error(`Circuit breaker is OPEN - service unavailable for ${Math.ceil((this.resetTimeout - (Date.now() - this.lastFailureTime)) / 1000)}s`)
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      this.metrics.rejectedCalls++
      throw new Error('Circuit breaker is HALF_OPEN - max test calls reached')
    }

    const startTime = performance.now()

    try {
      const result = await operation()
      const responseTime = performance.now() - startTime
      
      this.onSuccess(responseTime)
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(responseTime: number): void {
    this.metrics.successfulCalls++
    this.metrics.responseTimes.push(responseTime)
    
    // Keep only last 100 response times
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift()
    }

    if (this.state === 'HALF_OPEN') {
      this.successCount++
      this.halfOpenCalls++
      
      if (this.successCount >= this.halfOpenMaxCalls) {
        this.transitionToClosed()
      }
    } else {
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    this.metrics.failedCalls++
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      this.transitionToOpen()
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionToOpen()
    }
  }

  private transitionToOpen(): void {
    this.state = 'OPEN'
    this.halfOpenCalls = 0
    this.successCount = 0
  }

  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN'
    this.halfOpenCalls = 0
    this.successCount = 0
  }

  private transitionToClosed(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.halfOpenCalls = 0
    this.successCount = 0
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state
  }

  getMetrics(): Partial<ResilienceMetrics> {
    const failureRate = this.metrics.totalCalls > 0 
      ? this.metrics.failedCalls / this.metrics.totalCalls 
      : 0

    const averageResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length
      : 0

    const slowCallRate = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.filter(time => time > 2000).length / this.metrics.responseTimes.length
      : 0

    return {
      circuitBreakerState: this.state,
      failureRate,
      averageResponseTime,
      slowCallRate,
      rejectedCalls: this.metrics.rejectedCalls,
      successfulCalls: this.metrics.successfulCalls,
      failedCalls: this.metrics.failedCalls
    }
  }

  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenCalls = 0
    this.lastFailureTime = 0
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      responseTimes: []
    }
  }
}

/**
 * Bulkhead pattern implementation for resource isolation
 */
class Bulkhead {
  private activeCalls = 0
  private queue: Array<{
    operation: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
    timestamp: number
  }> = []

  constructor(
    private maxConcurrentCalls = 10,
    private maxWaitTime = 5000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeCalls < this.maxConcurrentCalls) {
      return this.executeImmediately(operation)
    }

    // Queue the operation
    return new Promise<T>((resolve, reject) => {
      const queueItem = {
        operation: operation as () => Promise<any>,
        resolve,
        reject,
        timestamp: Date.now()
      }

      this.queue.push(queueItem)
      
      // Set timeout for queued operation
      setTimeout(() => {
        const index = this.queue.indexOf(queueItem)
        if (index !== -1) {
          this.queue.splice(index, 1)
          reject(new Error('Bulkhead timeout - operation queued too long'))
        }
      }, this.maxWaitTime)
    })
  }

  private async executeImmediately<T>(operation: () => Promise<T>): Promise<T> {
    this.activeCalls++
    
    try {
      const result = await operation()
      return result
    } finally {
      this.activeCalls--
      this.processQueue()
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeCalls >= this.maxConcurrentCalls) {
      return
    }

    const queueItem = this.queue.shift()
    if (queueItem) {
      this.executeImmediately(queueItem.operation)
        .then(queueItem.resolve)
        .catch(queueItem.reject)
    }
  }

  getMetrics(): Partial<ResilienceMetrics> {
    return {
      concurrentCalls: this.activeCalls,
      queuedCalls: this.queue.length
    }
  }

  reset(): void {
    this.activeCalls = 0
    this.queue.forEach(item => {
      item.reject(new Error('Bulkhead reset'))
    })
    this.queue = []
  }
}

/**
 * Timeout handler with slow call detection
 */
class TimeoutHandler {
  private slowCalls = 0
  private totalCalls = 0

  constructor(
    private defaultTimeout = 30000,
    private slowCallThreshold = 2000
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    timeout: number = this.defaultTimeout
  ): Promise<T> {
    this.totalCalls++
    const startTime = performance.now()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`))
      }, timeout)
    })

    try {
      const result = await Promise.race([operation(), timeoutPromise])
      const responseTime = performance.now() - startTime
      
      if (responseTime > this.slowCallThreshold) {
        this.slowCalls++
      }
      
      return result
    } catch (error) {
      const responseTime = performance.now() - startTime
      
      if (responseTime >= timeout) {
        // This was a timeout
        throw new Error(`Timeout: Operation exceeded ${timeout}ms`)
      }
      
      throw error
    }
  }

  getMetrics(): Partial<ResilienceMetrics> {
    return {
      slowCallRate: this.totalCalls > 0 ? this.slowCalls / this.totalCalls : 0,
      timeoutCalls: this.slowCalls // Approximation
    }
  }

  reset(): void {
    this.slowCalls = 0
    this.totalCalls = 0
  }
}

/**
 * Main resilience service combining all patterns
 */
export class ResilienceService {
  private circuitBreaker: EnhancedCircuitBreaker
  private bulkhead: Bulkhead
  private timeoutHandler: TimeoutHandler

  constructor(private config: ResilienceConfig) {
    this.circuitBreaker = new EnhancedCircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.resetTimeout,
      config.circuitBreaker.halfOpenMaxCalls
    )

    this.bulkhead = new Bulkhead(
      config.bulkhead.maxConcurrentCalls,
      config.bulkhead.maxWaitTime
    )

    this.timeoutHandler = new TimeoutHandler(
      config.timeout.defaultTimeout,
      config.timeout.slowCallThreshold
    )
  }

  /**
   * Execute operation with full resilience patterns
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: {
      useCircuitBreaker?: boolean
      useBulkhead?: boolean
      useTimeout?: boolean
      timeout?: number
    } = {}
  ): Promise<T> {
    const {
      useCircuitBreaker = true,
      useBulkhead = true,
      useTimeout = true,
      timeout = this.config.timeout.defaultTimeout
    } = options

    let wrappedOperation = operation

    // Wrap with timeout if enabled
    if (useTimeout) {
      const originalOperation = wrappedOperation
      wrappedOperation = () => this.timeoutHandler.execute(originalOperation, timeout)
    }

    // Wrap with bulkhead if enabled
    if (useBulkhead) {
      const originalOperation = wrappedOperation
      wrappedOperation = () => this.bulkhead.execute(originalOperation)
    }

    // Wrap with circuit breaker if enabled
    if (useCircuitBreaker) {
      const originalOperation = wrappedOperation
      wrappedOperation = () => this.circuitBreaker.execute(originalOperation)
    }

    return wrappedOperation()
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): ResilienceMetrics {
    const circuitBreakerMetrics = this.circuitBreaker.getMetrics()
    const bulkheadMetrics = this.bulkhead.getMetrics()
    const timeoutMetrics = this.timeoutHandler.getMetrics()

    return {
      circuitBreakerState: circuitBreakerMetrics.circuitBreakerState || 'CLOSED',
      failureRate: circuitBreakerMetrics.failureRate || 0,
      averageResponseTime: circuitBreakerMetrics.averageResponseTime || 0,
      slowCallRate: timeoutMetrics.slowCallRate || 0,
      rejectedCalls: circuitBreakerMetrics.rejectedCalls || 0,
      successfulCalls: circuitBreakerMetrics.successfulCalls || 0,
      failedCalls: circuitBreakerMetrics.failedCalls || 0,
      timeoutCalls: timeoutMetrics.timeoutCalls || 0,
      concurrentCalls: bulkheadMetrics.concurrentCalls || 0,
      queuedCalls: bulkheadMetrics.queuedCalls || 0
    }
  }

  /**
   * Reset all resilience components
   */
  reset(): void {
    this.circuitBreaker.reset()
    this.bulkhead.reset()
    this.timeoutHandler.reset()
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResilienceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Note: This would require recreating components with new config
    // For now, log that config update was requested
    console.log('Resilience config updated:', newConfig)
  }

  /**
   * Health check for the service
   */
  getHealthStatus(): {
    healthy: boolean
    issues: string[]
    metrics: ResilienceMetrics
  } {
    const metrics = this.getMetrics()
    const issues: string[] = []

    if (metrics.circuitBreakerState === 'OPEN') {
      issues.push('Circuit breaker is OPEN - service calls are being rejected')
    }

    if (metrics.failureRate > 0.5) {
      issues.push(`High failure rate: ${(metrics.failureRate * 100).toFixed(1)}%`)
    }

    if (metrics.slowCallRate > 0.3) {
      issues.push(`High slow call rate: ${(metrics.slowCallRate * 100).toFixed(1)}%`)
    }

    if (metrics.queuedCalls > 10) {
      issues.push(`High queue depth: ${metrics.queuedCalls} calls waiting`)
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics
    }
  }
}

// Default configuration
const defaultConfig: ResilienceConfig = {
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenMaxCalls: 3
  },
  timeout: {
    defaultTimeout: 30000, // 30 seconds
    slowCallThreshold: 2000 // 2 seconds
  },
  bulkhead: {
    maxConcurrentCalls: 10,
    maxWaitTime: 5000 // 5 seconds
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }
}

// Global instances for different service types
export const githubResilienceService = new ResilienceService(defaultConfig)

export const highVolumeResilienceService = new ResilienceService({
  ...defaultConfig,
  bulkhead: {
    maxConcurrentCalls: 20,
    maxWaitTime: 2000
  },
  timeout: {
    defaultTimeout: 10000,
    slowCallThreshold: 1000
  }
})

export const criticalResilienceService = new ResilienceService({
  ...defaultConfig,
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30000,
    halfOpenMaxCalls: 2
  },
  timeout: {
    defaultTimeout: 5000,
    slowCallThreshold: 500
  }
})