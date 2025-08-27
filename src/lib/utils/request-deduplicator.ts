/**
 * Request Deduplicator Utility
 *
 * Prevents duplicate API calls when multiple components mount concurrently
 * and request the same data. Extends the existing progressive cache patterns
 * with sophisticated promise sharing and cleanup.
 *
 * Philosophy: Invisible to users, seamless integration with existing patterns
 */

interface PendingRequest<T = any> {
  key: string;
  promise: Promise<T>;
  timestamp: number;
  abortController?: AbortController;
  subscribers: number;
}

interface RequestOptions {
  /** Time in milliseconds to consider a pending request valid (default: 5000ms) */
  ttl?: number;
  /** Whether this request supports abortion */
  abortable?: boolean;
  /** Custom key generator for cache key */
  keyGenerator?: (...args: any[]) => string;
}

/**
 * Centralized request deduplication service
 * Integrates with existing progressive loading patterns
 */
export class RequestDeduplicator {
  private pending = new Map<string, PendingRequest>();
  private readonly DEFAULT_TTL = 5000; // 5 seconds - aligns with existing patterns

  /**
   * Deduplicate concurrent requests for the same resource
   * @param key Unique identifier for the request
   * @param fetcher Function that performs the actual fetch
   * @param options Configuration options
   */
  async dedupe<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const { ttl = this.DEFAULT_TTL, abortable = true } = options;

    // Check for existing pending request
    const existing = this.pending.get(key);
    if (existing && this.isRequestValid(existing, ttl)) {
      // Increment subscriber count
      existing.subscribers++;

      try {
        return await existing.promise;
      } finally {
        // Decrement subscriber count
        existing.subscribers--;
        this.maybeCleanupRequest(key, existing);
      }
    }

    // Create new request
    const abortController = abortable ? new AbortController() : undefined;
    const signal = abortController?.signal;

    // Cancel previous request if it exists and is abortable
    if (existing?.abortController && !existing.abortController.signal.aborted) {
      existing.abortController.abort();
    }

    const promise = this.createManagedPromise(key, fetcher, signal);

    const pendingRequest: PendingRequest<T> = {
      key,
      promise,
      timestamp: Date.now(),
      abortController,
      subscribers: 1,
    };

    this.pending.set(key, pendingRequest);

    try {
      return await promise;
    } finally {
      pendingRequest.subscribers--;
      this.maybeCleanupRequest(key, pendingRequest);
    }
  }

  /**
   * Generate standard cache keys for common patterns
   */
  static generateKey = {
    /** Generate key for repository-based requests */
    repository: (owner: string, repo: string, ...params: any[]): string =>
      `repo:${owner}/${repo}:${params.join(':')}`,

    /** Generate key for user-based requests */
    user: (username: string, ...params: any[]): string => `user:${username}:${params.join(':')}`,

    /** Generate key for progressive loading stages */
    progressiveStage: (
      stage: string,
      owner: string,
      repo: string,
      timeRange: string,
      includeBots: boolean
    ): string => `progressive:${stage}:${owner}/${repo}:${timeRange}:${includeBots}`,

    /** Generate custom key with prefix */
    custom: (prefix: string, ...params: any[]): string => `${prefix}:${params.join(':')}`,
  };

  /**
   * Cancel all pending requests (cleanup utility)
   */
  cancelAll(): void {
    for (const [, request] of this.pending) {
      if (request.abortController && !request.abortController.signal.aborted) {
        request.abortController.abort();
      }
    }
    this.pending.clear();
  }

  /**
   * Cancel specific request by key
   */
  cancel(key: string): boolean {
    const request = this.pending.get(key);
    if (request?.abortController && !request.abortController.signal.aborted) {
      request.abortController.abort();
      this.pending.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Get stats for monitoring and debugging
   */
  getStats() {
    const now = Date.now();
    const requests = Array.from(this.pending.values());

    return {
      totalPending: requests.length,
      totalSubscribers: requests.reduce((sum, req) => sum + req.subscribers, 0),
      oldestRequestAge:
        requests.length > 0 ? now - Math.min(...requests.map((req) => req.timestamp)) : 0,
      averageAge:
        requests.length > 0
          ? now - requests.reduce((sum, req) => sum + req.timestamp, 0) / requests.length
          : 0,
      pendingRequests: requests.map((req) => ({
        key: req.key,
        age: now - req.timestamp,
        subscribers: req.subscribers,
      })),
    };
  }

  private async createManagedPromise<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    try {
      const result = await fetcher(signal);
      return result;
    } catch (error) {
      // Clean up failed request immediately
      this.pending.delete(key);
      throw error;
    }
  }

  private isRequestValid(request: PendingRequest, ttl: number): boolean {
    return Date.now() - request.timestamp < ttl;
  }

  private maybeCleanupRequest(key: string, request: PendingRequest): void {
    // Only clean up if no more subscribers
    if (request.subscribers <= 0) {
      this.pending.delete(key);
    }
  }
}

// Global instance - follows the existing pattern of global caches in the codebase
export const requestDeduplicator = new RequestDeduplicator();

/**
 * React hook for request deduplication
 * Integrates cleanly with existing useEffect patterns
 */
export function useRequestDeduplication() {
  return {
    dedupe: requestDeduplicator.dedupe.bind(requestDeduplicator),
    cancel: requestDeduplicator.cancel.bind(requestDeduplicator),
    generateKey: RequestDeduplicator.generateKey,
    getStats: requestDeduplicator.getStats.bind(requestDeduplicator),
  };
}

/**
 * Higher-order function to wrap existing data fetchers with deduplication
 * Perfect for integrating with existing fetchPRDataSmart and similar functions
 */
export function withRequestDeduplication<TArgs extends any[], TResult>(
  fetcher: (...args: TArgs) => Promise<TResult>,
  keyGenerator: (...args: TArgs) => string,
  options: RequestOptions = {}
) {
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args);
    return requestDeduplicator.dedupe(key, () => fetcher(...args), options);
  };
}

export default requestDeduplicator;
