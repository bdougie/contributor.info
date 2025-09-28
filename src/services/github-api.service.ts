import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';

interface BackoffConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
}

interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
  used: number;
}

interface GitHubError extends Error {
  status?: number;
  response?: {
    headers?: {
      'x-ratelimit-remaining'?: string;
      'x-ratelimit-reset'?: string;
      'x-ratelimit-limit'?: string;
      'x-ratelimit-used'?: string;
    };
  };
}

class GitHubAPIService {
  private octokit: Octokit;
  private defaultConfig: Required<BackoffConfig> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
  };

  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(auth?: string) {
    const MyOctokit = Octokit.plugin(throttling);
    this.octokit = new MyOctokit({
      auth,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          console.warn(`Rate limit detected, retrying after ${retryAfter} seconds`, {
            method: options.method,
            url: options.url,
          });
          return true;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          console.warn(`Secondary rate limit detected, retrying after ${retryAfter} seconds`, {
            method: options.method,
            url: options.url,
          });
          return true;
        },
      },
    });
  }

  private calculateDelay(attempt: number, config: Required<BackoffConfig>): number {
    const baseDelay = Math.min(
      config.initialDelay * Math.pow(config.factor, attempt),
      config.maxDelay
    );

    if (!config.jitter) {
      return baseDelay;
    }

    // Add jitter to prevent thundering herd
    const jitterAmount = baseDelay * 0.3;
    const jitter = Math.random() * jitterAmount * 2 - jitterAmount;
    return Math.max(0, baseDelay + jitter);
  }

  private parseRateLimitHeaders(headers: Record<string, string | undefined>): RateLimitInfo | null {
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const limit = headers['x-ratelimit-limit'];
    const used = headers['x-ratelimit-used'];

    if (!remaining || !reset || !limit) {
      return null;
    }

    // Add null checks and safer type conversion
    const parsedRemaining = remaining ? parseInt(remaining, 10) : 0;
    const parsedReset = reset ? parseInt(reset, 10) : 0;
    const parsedLimit = limit ? parseInt(limit, 10) : 0;
    const parsedUsed = used ? parseInt(used, 10) : 0;

    // Validate parsed values
    if (isNaN(parsedRemaining) || isNaN(parsedReset) || isNaN(parsedLimit)) {
      return null;
    }

    return {
      remaining: parsedRemaining,
      reset: parsedReset,
      limit: parsedLimit,
      used: parsedUsed,
    };
  }

  private shouldRetry(error: GitHubError, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    const status = error.status;
    if (!status) {
      // Network errors or other non-HTTP errors
      return true;
    }

    // Retry on rate limiting
    if (status === 429) {
      return true;
    }

    // Retry on server errors
    if (status >= 500 && status < 600) {
      return true;
    }

    // Don't retry on client errors (except rate limiting)
    if (status >= 400 && status < 500) {
      return false;
    }

    return true;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeWithBackoff<T>(
    operation: () => Promise<T>,
    customConfig?: BackoffConfig
  ): Promise<T> {
    const config = { ...this.defaultConfig, ...customConfig };
    let lastError: GitHubError | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();

        // Update rate limit info from successful response if available
        if (typeof result === 'object' && result !== null && 'headers' in result) {
          const headers = (result as any).headers;
          const rateLimitInfo = this.parseRateLimitHeaders(headers);
          if (rateLimitInfo) {
            this.rateLimitInfo = rateLimitInfo;
          }
        }

        return result;
      } catch (error) {
        lastError = error as GitHubError;

        // Parse rate limit headers from error response
        if (lastError.response?.headers) {
          const rateLimitInfo = this.parseRateLimitHeaders(lastError.response.headers as Record<string, string>);
          if (rateLimitInfo) {
            this.rateLimitInfo = rateLimitInfo;
          }
        }

        if (!this.shouldRetry(lastError, attempt, config.maxRetries)) {
          throw lastError;
        }

        if (attempt < config.maxRetries) {
          const delay = this.calculateDelay(attempt, config);

          // If rate limited, wait until reset time
          if (lastError.status === 429 && this.rateLimitInfo) {
            const resetTime = this.rateLimitInfo.reset * 1000;
            const now = Date.now();
            const waitTime = Math.max(resetTime - now, delay);

            console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset...`);
            await this.sleep(waitTime);
          } else {
            console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})...`);
            await this.sleep(delay);
          }
        }
      }
    }

    throw lastError || new Error('Operation failed after maximum retries');
  }

  async fetchPullRequests(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
    page?: number;
  }) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: options?.state || 'open',
        per_page: options?.per_page || 30,
        page: options?.page || 1,
      });
      return response.data;
    });
  }

  async fetchPullRequest(owner: string, repo: string, pull_number: number) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number,
      });
      return response.data;
    });
  }

  async fetchReviews(owner: string, repo: string, pull_number: number) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number,
      });
      return response.data;
    });
  }

  async fetchComments(owner: string, repo: string, pull_number: number) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number,
      });
      return response.data;
    });
  }

  async fetchRepository(owner: string, repo: string) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });
      return response.data;
    });
  }

  async fetchContributors(owner: string, repo: string, options?: {
    per_page?: number;
    page?: number;
  }) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: options?.per_page || 30,
        page: options?.page || 1,
      });
      return response.data;
    });
  }

  async fetchIssues(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
    page?: number;
  }) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: options?.state || 'open',
        per_page: options?.per_page || 30,
        page: options?.page || 1,
      });
      return response.data;
    });
  }

  async fetchCommits(owner: string, repo: string, options?: {
    per_page?: number;
    page?: number;
    sha?: string;
    since?: string;
    until?: string;
  }) {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: options?.per_page || 30,
        page: options?.page || 1,
        sha: options?.sha,
        since: options?.since,
        until: options?.until,
      });
      return response.data;
    });
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  async checkRateLimit() {
    return this.executeWithBackoff(async () => {
      const response = await this.octokit.rest.rateLimit.get();
      return response.data;
    });
  }
}

export default GitHubAPIService;
export type { BackoffConfig, RateLimitInfo };