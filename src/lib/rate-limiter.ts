/**
 * Rate Limiter
 * Controls concurrent requests and implements delays to prevent API throttling
 */

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retryCount: number;
}

export class RateLimiter {
  private queue: QueuedRequest<unknown>[] = [];
  private activeRequests = 0;
  private readonly maxConcurrent: number;
  private readonly minDelay: number;
  private readonly maxRetries: number;
  private lastRequestTime = 0;
  private processing = false;

  constructor(
    options: {
      maxConcurrent?: number;
      minDelay?: number;
      maxRetries?: number;
    } = {}
  ) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.minDelay = options.minDelay ?? 100; // ms
    this.maxRetries = options.maxRetries ?? 3;
  }

  /**
   * Enqueue a function to be executed with rate limiting
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with concurrency and delay controls
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 || this.activeRequests > 0) {
      // Wait if we've hit max concurrent requests
      if (this.activeRequests >= this.maxConcurrent) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }

      // Check if we need to delay before next request
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelay) {
        await new Promise((resolve) => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
      }

      // Get next request from queue
      const request = this.queue.shift();
      if (!request) {
        // No more requests, wait a bit for active ones to complete
        if (this.activeRequests > 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        continue;
      }

      // Execute request
      this.activeRequests++;
      this.lastRequestTime = Date.now();

      this.executeRequest(request).finally(() => {
        this.activeRequests--;
      });
    }

    this.processing = false;
  }

  /**
   * Execute a request with retry logic
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      // Check if it's a rate limit error (status 403 or 429)
      const isRateLimitError =
        error instanceof Error &&
        'status' in error &&
        (error.status === 403 || error.status === 429);

      // Retry with exponential backoff if it's a rate limit error
      if (isRateLimitError && request.retryCount < this.maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, request.retryCount), 10000);
        console.warn(
          `Rate limited, retrying after ${backoffDelay}ms (attempt ${request.retryCount + 1}/${this.maxRetries})`
        );

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));

        // Re-queue with incremented retry count
        this.queue.unshift({
          ...request,
          retryCount: request.retryCount + 1,
        } as QueuedRequest<unknown>);
      } else {
        // Max retries reached or non-rate-limit error
        const errorMessage = error instanceof Error ? error.message : 'Request failed';
        request.reject(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }

  /**
   * Get current queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.processing,
    };
  }

  /**
   * Clear the queue (useful for cleanup)
   */
  clear() {
    const remainingRequests = this.queue.splice(0);
    remainingRequests.forEach((request) => {
      request.reject(new Error('Queue cleared'));
    });
  }
}

// Global rate limiter instance for GitHub API calls
export const githubRateLimiter = new RateLimiter({
  maxConcurrent: 3,
  minDelay: 100,
  maxRetries: 3,
});
