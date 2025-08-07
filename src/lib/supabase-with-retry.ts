/**
 * Supabase operations with retry logic and circuit breaker
 */

import { supabase } from './supabase';
import { withRetry, type RetryConfig } from './retry-utils';

// Custom retry configuration for Supabase operations
const supabaseRetryConfig: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: new Set([
    'NetworkError',
    'TimeoutError',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    '500',
    '502',
    '503',
    '504',
    '429', // Rate limit
    'FetchError',
    'AbortError'
  ]),
  onRetry: (error, attempt) => {
    console.log(`%s`, `Supabase retry attempt ${attempt}:`, error.message);
  }
};

// GitHub API retry configuration (more aggressive for rate limits)
const githubRetryConfig: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 3,
  retryableErrors: new Set([
    'NetworkError',
    'TimeoutError',
    '500',
    '502',
    '503',
    '504',
    '429', // Rate limit - retry with longer backoff
    '403', // Sometimes indicates rate limit
  ]),
  onRetry: (error, attempt) => {
    const isRateLimit = error.message.includes('429') || error.message.includes('rate limit');
    if (isRateLimit) {
      console.log(`%s`, `GitHub rate limit hit, waiting longer (attempt ${attempt})...`);
    }
  }
};

/**
 * Execute a Supabase query with retry logic
 */
export async function supabaseWithRetry<T>(
  queryBuilder: () => Promise<{ data: T | null; error: Error | null }>,
  circuitBreakerKey?: string
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await withRetry(
      queryBuilder,
      supabaseRetryConfig,
      circuitBreakerKey
    );
    return result;
  } catch (error) {
    // Return in Supabase format
    return {
      data: null,
      error: error as Error
    };
  }
}


/**
 * Fetch with retry for GitHub API calls
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  customConfig?: Partial<RetryConfig>
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, options);
      
      // Check for rate limit or server errors
      if (response.status === 429 || response.status >= 500) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }
      
      // For 403, check if it's a rate limit
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateLimitRemaining === '0') {
          const error = new Error('GitHub API rate limit exceeded');
          (error as any).status = 429; // Treat as rate limit
          throw error;
        }
      }
      
      return response;
    },
    { ...githubRetryConfig, ...customConfig },
    `github-api-${new URL(url).pathname}`
  );
}

/**
 * Retryable Supabase operations factory
 */
export const retryableSupabase = {
  /**
   * Query repositories with retry
   */
  queryRepositories: async (owner: string, name: string) => {
    return withRetry(
      async () => {
        return await supabase
          .from('repositories')
          .select('*')
          .eq('owner', owner)
          .eq('name', name)
          .single();
      },
      supabaseRetryConfig,
      'supabase-repositories'
    );
  },

  /**
   * Query pull requests with retry
   */
  queryPullRequests: async (repositoryId: string, since?: Date) => {
    return withRetry(
      async () => {
        let query = supabase
          .from('pull_requests')
          .select(`
            *,
            contributors:author_id(*),
            reviews(*),
            comments(*)
          `)
          .eq('repository_id', repositoryId)
          .order('created_at', { ascending: false });
        
        if (since) {
          query = query.gte('created_at', since.toISOString());
        }
        
        return await query;
      },
      supabaseRetryConfig,
      'supabase-pull-requests'
    );
  },

  /**
   * Insert or update repository with retry
   */
  upsertRepository: async (data: Record<string, unknown>) => {
    return withRetry(
      async () => {
        return await supabase
          .from('repositories')
          .upsert(data, { onConflict: 'owner,name' })
          .select()
          .single();
      },
      supabaseRetryConfig,
      'supabase-upsert-repository'
    );
  },
};

/**
 * Track retry metrics
 */
interface RetryMetrics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  circuitBreakerTrips: number;
}

const retryMetrics: RetryMetrics = {
  totalRetries: 0,
  successfulRetries: 0,
  failedRetries: 0,
  circuitBreakerTrips: 0,
};

export function getRetryMetrics(): RetryMetrics {
  return { ...retryMetrics };
}

export function resetRetryMetrics(): void {
  retryMetrics.totalRetries = 0;
  retryMetrics.successfulRetries = 0;
  retryMetrics.failedRetries = 0;
  retryMetrics.circuitBreakerTrips = 0;
}