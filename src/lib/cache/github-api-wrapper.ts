/**
 * Enhanced GitHub API wrapper with caching, rate limiting, and circuit breaker
 */

import { githubApiRequest, RateLimitInfo } from '@/lib/github-rate-limit';
import { githubCache, repositoryCache, userCache, contributorCache } from './github-cache-service';
import { githubResilienceService } from '@/lib/resilience/resilience-service';

export interface ApiCallOptions {
  useCache?: boolean;
  cacheTtl?: number;
  forceRefresh?: boolean;
  retryOnFailure?: boolean;
  timeout?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  success: boolean;
  fromCache: boolean;
  rateLimitInfo: RateLimitInfo | null;
  responseTime: number;
  error?: string;
}

/**
 * Enhanced GitHub API client with caching and resilience patterns
 */
export class CachedGitHubApiClient {
  private baseUrl = 'https://api.github.com';

  constructor(private token?: string) {}

  /**
   * Generic API call with caching and circuit breaker
   */
  async makeRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: ApiCallOptions = {},
  ): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    const {
      useCache = true,
      cacheTtl = 5 * 60 * 1000,
      forceRefresh = false,
      timeout = 30000,
    } = options;

    const url = this.buildUrl(endpoint, params);
    const cacheKey = githubCache.createKey(endpoint, params);

    try {
      // Try cache first (unless force refresh)
      if (useCache && !forceRefresh) {
        const cached = await githubCache.get<T>(cacheKey);
        if (cached) {
          return {
            data: cached,
            success: true,
            fromCache: true,
            rateLimitInfo: null,
            responseTime: performance.now() - startTime,
          };
        }
      }

      // Execute with enhanced resilience service
      const result = await githubResilienceService.execute(
        async () => {
          return await this.executeRequest<T>(url, timeout);
        },
        {
          useCircuitBreaker: true,
          useBulkhead: true,
          useTimeout: true,
          timeout,
        },
      );

      // Cache successful responses
      if (useCache && result._data) {
        await githubCache.set(cacheKey, result.data, cacheTtl, {
          rateLimitInfo: result.rateLimitInfo || undefined,
        });
      }

      return {
        ...result,
        success: true,
        fromCache: false,
        responseTime: performance.now() - startTime,
      };
    } catch (_error) {
      return {
        data: null,
        success: false,
        fromCache: false,
        rateLimitInfo: null,
        responseTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Repository-specific API calls with specialized caching
   */
  async getRepository(
    owner: string,
    repo: string,
    options: ApiCallOptions = {},
  ): Promise<ApiResponse<any>> {
    const cacheKey = repositoryCache.createKey('repo', { owner, repo });

    if (options.useCache !== false && !options.forceRefresh) {
      const cached = await repositoryCache.get(cacheKey);
      if (cached) {
        return {
          data: cached,
          success: true,
          fromCache: true,
          rateLimitInfo: null,
          responseTime: 0,
        };
      }
    }

    const result = await this.makeRequest(
      `/repos/${owner}/${repo}`,
      {},
      {
        ...options,
        cacheTtl: 15 * 60 * 1000, // 15 minutes for repo data
      },
    );

    if (result.success && result._data && options.useCache !== false) {
      await repositoryCache.set(cacheKey, result._data, 15 * 60 * 1000);
    }

    return result;
  }

  /**
   * User-specific API calls with specialized caching
   */
  async getUser(username: string, options: ApiCallOptions = {}): Promise<ApiResponse<any>> {
    const cacheKey = userCache.createKey('user', { username });

    if (options.useCache !== false && !options.forceRefresh) {
      const cached = await userCache.get(cacheKey);
      if (cached) {
        return {
          data: cached,
          success: true,
          fromCache: true,
          rateLimitInfo: null,
          responseTime: 0,
        };
      }
    }

    const result = await this.makeRequest(
      `/users/${username}`,
      {},
      {
        ...options,
        cacheTtl: 30 * 60 * 1000, // 30 minutes for user data
      },
    );

    if (result.success && result._data && options.useCache !== false) {
      await userCache.set(cacheKey, result._data, 30 * 60 * 1000);
    }

    return result;
  }

  /**
   * Pull requests with caching
   */
  async getPullRequests(
    owner: string,
    repo: string,
    params: Record<string, unknown> = {},
    options: ApiCallOptions = {},
  ): Promise<ApiResponse<any[]>> {
    return this.makeRequest(`/repos/${owner}/${repo}/pulls`, params, {
      ...options,
      cacheTtl: 5 * 60 * 1000, // 5 minutes for PR data
    });
  }

  /**
   * Repository events with caching
   */
  async getRepositoryEvents(
    owner: string,
    repo: string,
    params: Record<string, unknown> = {},
    options: ApiCallOptions = {},
  ): Promise<ApiResponse<any[]>> {
    return this.makeRequest(`/repos/${owner}/${repo}/events`, params, {
      ...options,
      cacheTtl: 2 * 60 * 1000, // 2 minutes for events
    });
  }

  /**
   * Contributor activity with specialized caching
   */
  async getContributorActivity(
    repositories: string[],
    timeframe: { month: number; year: number },
    options: ApiCallOptions = {},
  ): Promise<ApiResponse<any>> {
    const cacheKey = contributorCache.createKey('contributor-activity', {
      repositories: repositories.sort(),
      ...timeframe,
    });

    if (options.useCache !== false && !options.forceRefresh) {
      const cached = await contributorCache.get(cacheKey);
      if (cached) {
        return {
          data: cached,
          success: true,
          fromCache: true,
          rateLimitInfo: null,
          responseTime: 0,
        };
      }
    }

    // This would typically aggregate multiple API calls
    // For now, return a placeholder that would be implemented with actual logic
    const result: ApiResponse<any> = {
      data: null,
      success: false,
      fromCache: false,
      rateLimitInfo: null,
      responseTime: 0,
      error: 'Contributor activity aggregation not implemented in wrapper yet',
    };

    return result;
  }

  /**
   * Batch API calls with intelligent caching
   */
  async batchRequest<T>(
    requests: Array<{
      endpoint: string;
      params?: Record<string, unknown>;
      options?: ApiCallOptions;
    }>,
    concurrencyLimit = 5,
  ): Promise<ApiResponse<T>[]> {
    const results: ApiResponse<T>[] = [];

    const executeRequest = async (request: (typeof requests)[0]): Promise<ApiResponse<T>> => {
      return this.makeRequest<T>(request.endpoint, request.params, request.options);
    };

    // Process requests in batches with concurrency limit
    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(batch.map(executeRequest));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Clear cache for specific patterns
   */
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      // For now, clear entire cache - could be enhanced to support patterns
      await githubCache.clear();
      await repositoryCache.clear();
      await userCache.clear();
      await contributorCache.clear();
    } else {
      await githubCache.clear();
      await repositoryCache.clear();
      await userCache.clear();
      await contributorCache.clear();
    }
  }

  /**
   * Get comprehensive cache and resilience statistics
   */
  getCacheStats() {
    return {
      github: githubCache.getStats(),
      repository: repositoryCache.getStats(),
      user: userCache.getStats(),
      contributor: contributorCache.getStats(),
      resilience: githubResilienceService.getMetrics(),
      health: githubResilienceService.getHealthStatus(),
    };
  }

  /**
   * Private helper methods
   */
  private buildUrl(endpoint: string, params: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  private async executeRequest<T>(
    url: string,
    timeout: number,
  ): Promise<{ data: T | null; rateLimitInfo: RateLimitInfo | null }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const result = await githubApiRequest<T>(url, {
        signal: controller.signal,
        headers: this.getAuthHeaders(),
      });

      clearTimeout(timeoutId);
      return result;
    } catch (_error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }
}

// Export factory function for creating cached clients
export function createCachedGitHubClient(token?: string): CachedGitHubApiClient {
  return new CachedGitHubApiClient(token);
}

// Export global instance
export const cachedGitHubClient = new CachedGitHubApiClient();
