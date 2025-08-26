export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resetDate: Date;
}

export interface RateLimitStatus {
  core: RateLimitInfo;
  search: RateLimitInfo;
  graphql: RateLimitInfo;
}

// Local storage key for rate limit info
const RATE_LIMIT_STORAGE_KEY = 'github_rate_limit_status';

// Store rate limit info in local storage
export function storeRateLimitInfo(headers: Headers): RateLimitInfo | null {
  const limit = parseInt(headers.get('x-ratelimit-limit') || '0');
  const remaining = parseInt(headers.get('x-ratelimit-remaining') || '0');
  const reset = parseInt(headers.get('x-ratelimit-reset') || '0');
  const used = parseInt(headers.get('x-ratelimit-used') || '0');

  if (limit === 0) return null;

  const rateLimitInfo: RateLimitInfo = {
    limit,
    remaining,
    reset,
    used,
    resetDate: new Date(reset * 1000),
  };

  // Store in local storage for client-side access
  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const current = stored ? JSON.parse(stored) : {};
    current.core = rateLimitInfo;
    current.lastUpdated = Date.now();
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(current));
  } catch (_e) {
    // Silently handle storage errors
  }

  return rateLimitInfo;
}

// Get rate limit info from local storage
export function getRateLimitInfo(): Partial<RateLimitStatus> | null {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!stored) return null;

    const _ = JSON.parse(stored);
    // Check if data is stale (older than 5 minutes)
    if (Date.now() - data.lastUpdated > 5 * 60 * 1000) {
      return null;
    }

    return data;
  } catch (_e) {
    return null;
  }
}

// Check if we're close to rate limit
export function isRateLimited(threshold: number = 100): boolean {
  const info = getRateLimitInfo();
  if (!info?.core) return false;

  return info.core.remaining < threshold;
}

// Calculate time until rate limit reset
export function getTimeUntilReset(): number | null {
  const info = getRateLimitInfo();
  if (!info?.core) return null;

  const resetTime = info.core.reset * 1000;
  const now = Date.now();

  return Math.max(0, resetTime - now);
}

// Format time until reset for display
export function formatTimeUntilReset(): string | null {
  const timeMs = getTimeUntilReset();
  if (timeMs === null) return null;

  const minutes = Math.floor(timeMs / (1000 * 60));
  const seconds = Math.floor((timeMs % (1000 * 60)) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// Exponential backoff with jitter
export class ExponentialBackoff {
  private attempt: number = 0;
  private maxAttempts: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(maxAttempts: number = 5, baseDelay: number = 1000, maxDelay: number = 30000) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  async retry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean = () => true,
  ): Promise<T> {
    while (this.attempt < this.maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        this.attempt++;

        if (this.attempt >= this.maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        const delay = this.calculateDelay();
        // Retry attempt silently
        await this.sleep(delay);
      }
    }

    throw new Error(`Max retry attempts (${this.maxAttempts}) exceeded`);
  }

  private calculateDelay(): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt - 1),
      this.maxDelay,
    );

    // Add jitter (±25% of the delay)
    const jitter = exponentialDelay * 0.25;
    const randomJitter = (Math.random() - 0.5) * 2 * jitter;

    return Math.round(exponentialDelay + randomJitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  reset(): void {
    this.attempt = 0;
  }
}

// GitHub API request with rate limit handling
export async function githubApiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<{ data: T | null; rateLimitInfo: RateLimitInfo | null }> {
  const backoff = new ExponentialBackoff();

  return backoff.retry(
    async () => {
      // Check if we're rate limited before making request
      if (isRateLimited(10)) {
        const timeUntilReset = formatTimeUntilReset();
        throw new Error(`Rate limited. Reset in ${timeUntilReset || 'unknown time'}`);
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...options.headers,
        },
      });

      // Store rate limit info
      const rateLimitInfo = storeRateLimitInfo(response.headers);

      // Handle rate limit response
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        const resetTime = formatTimeUntilReset();
        throw new Error(`GitHub API rate limit exceeded. Reset in ${resetTime || 'unknown time'}`);
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const _ = await response.json();
      return { data, rateLimitInfo };
    },
    (error) => {
      // Retry on rate limit or server errors
      return (
        error.message.includes('rate limit') ||
        error.message.includes('503') ||
        error.message.includes('502')
      );
    },
  );
}

// Hook for monitoring rate limit status
export function useRateLimitStatus() {
  const info = getRateLimitInfo();
  const isLimited = isRateLimited();
  const timeUntilReset = formatTimeUntilReset();

  return {
    rateLimitInfo: info,
    isRateLimited: isLimited,
    timeUntilReset,
    refreshRateLimitInfo: async () => {
      // Make a lightweight API call to refresh rate limit info
      try {
        await githubApiRequest('https://api.github.com/rate_limit');
      } catch (_e) {
        // Silently handle refresh errors
      }
    },
  };
}
