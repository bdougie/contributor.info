// Removed Sentry import - using simple logging instead

interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resource: string;
}

interface GitHubAPIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  rateLimitRemaining: number;
  rateLimitReset: number;
  cacheHit?: boolean;
  errorMessage?: string;
  timestamp: Date;
}

interface APIPerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitUtilization: number;
  cacheHitRate: number;
  errorsByType: Record<string, number>;
  slowRequests: number; // requests > 2 seconds
}

class GitHubAPIMonitoring {
  private apiMetrics: GitHubAPIMetrics[] = [];
  private rateLimits: Map<string, GitHubRateLimit> = new Map();
  private readonly SLOW_REQUEST_THRESHOLD = 2000; // 2 seconds
  private readonly RATE_LIMIT_WARNING_THRESHOLD = 0.8; // 80% of rate limit

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    // Set up periodic rate limit checking
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.checkRateLimitStatus();
      }, 60000); // Check every minute
    }
  }

  private async checkRateLimitStatus() {
    for (const [resource, rateLimit] of this.rateLimits) {
      const utilizationRate = (rateLimit.limit - rateLimit.remaining) / rateLimit.limit;
      
      if (utilizationRate > this.RATE_LIMIT_WARNING_THRESHOLD) {
        // Simple error logging without analytics
        console.error(`GitHub API rate limit warning for ${resource}`, {
          level: 'warning',
          tags: {
            component: 'github-api',
            resource: resource,
          },
          extra: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            utilizationRate: utilizationRate,
            resetTime: new Date(rateLimit.reset * 1000).toISOString(),
          },
        });
      }
    }
  }

  async wrapGitHubAPICall<T>(
    apiCall: () => Promise<Response>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> {
    const startTime = performance.now();
    const timestamp = new Date();

    try {
      const response = await apiCall();
      const duration = performance.now() - startTime;

      // Extract rate limit information from headers
      const rateLimit = this.extractRateLimitInfo(response, endpoint);
      if (rateLimit) {
        this.rateLimits.set(rateLimit.resource, rateLimit);
      }

      // Check for cache hit
      const cacheHit = response.headers.get('x-from-cache') === 'true' || 
                      response.headers.get('x-cache') === 'HIT';

      // Log metrics
      const metrics: GitHubAPIMetrics = {
        endpoint,
        method,
        statusCode: response.status,
        duration,
        rateLimitRemaining: rateLimit?.remaining || 0,
        rateLimitReset: rateLimit?.reset || 0,
        cacheHit,
        timestamp,
      };

      // Handle errors
      if (!response.ok) {
        const errorText = await response.text();
        metrics.errorMessage = `HTTP ${response.status}: ${errorText}`;
        
        // Simple error logging without analytics
        console.error(new Error(metrics.errorMessage), {
          tags: {
            component: 'github-api',
            endpoint: endpoint,
            statusCode: response.status.toString(),
          },
          extra: {
            method,
            duration,
            rateLimitRemaining: rateLimit?.remaining,
          },
        });
      }

      // Log slow requests
      if (duration > this.SLOW_REQUEST_THRESHOLD) {
        // Simple breadcrumb logging without analytics
        console.log('GitHub API breadcrumb:', {
          message: 'Slow GitHub API request detected',
          category: 'performance',
          level: 'warning',
          data: {
            endpoint,
            method,
            duration,
            statusCode: response.status,
          },
        });
      }

      this.recordMetrics(metrics);

      // Parse and return response data
      if (response.ok) {
        const data = await response.json();
        return data as T;
      } else {
        throw new Error(metrics.errorMessage);
      }

    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const metrics: GitHubAPIMetrics = {
        endpoint,
        method,
        statusCode: 0, // Network error
        duration,
        rateLimitRemaining: 0,
        rateLimitReset: 0,
        errorMessage,
        timestamp,
      };

      this.recordMetrics(metrics);

      // Simple error logging without analytics
      console.error(error, {
        tags: {
          component: 'github-api',
          endpoint: endpoint,
        },
        extra: {
          method,
          duration,
        },
      });

      throw error;
    }
  }

  private extractRateLimitInfo(response: Response, endpoint: string): GitHubRateLimit | null {
    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    const used = response.headers.get('x-ratelimit-used');

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset),
        used: used ? parseInt(used) : parseInt(limit) - parseInt(remaining),
        resource: this.determineRateLimitResource(endpoint),
      };
    }

    return null;
  }

  private determineRateLimitResource(endpoint: string): string {
    // GitHub has different rate limits for different resources
    if (endpoint.includes('/search/')) return 'search';
    if (endpoint.includes('/graphql')) return 'graphql';
    if (endpoint.includes('/repos/') && endpoint.includes('/contents/')) return 'core';
    if (endpoint.includes('/users/')) return 'core';
    if (endpoint.includes('/repos/')) return 'core';
    return 'core'; // default
  }

  private recordMetrics(metrics: GitHubAPIMetrics) {
    this.apiMetrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.apiMetrics.length > 1000) {
      this.apiMetrics = this.apiMetrics.slice(-1000);
    }

    // Send to Sentry for monitoring
    // Simple breadcrumb logging without analytics
    console.log('GitHub API breadcrumb:', {
      message: `GitHub API ${metrics.method} ${metrics.endpoint}`,
      category: 'http',
      level: metrics.statusCode >= 400 ? 'error' : 'info',
      data: {
        endpoint: metrics.endpoint,
        method: metrics.method,
        statusCode: metrics.statusCode,
        duration: metrics.duration,
        rateLimitRemaining: metrics.rateLimitRemaining,
        cacheHit: metrics.cacheHit,
      },
    });
  }

  getPerformanceStats(timeWindowMinutes: number = 60): APIPerformanceStats {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const recentMetrics = this.apiMetrics.filter(m => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        rateLimitUtilization: 0,
        cacheHitRate: 0,
        errorsByType: {},
        slowRequests: 0,
      };
    }

    const successfulRequests = recentMetrics.filter(m => m.statusCode >= 200 && m.statusCode < 300);
    const failedRequests = recentMetrics.filter(m => m.statusCode >= 400 || m.statusCode === 0);
    const slowRequests = recentMetrics.filter(m => m.duration > this.SLOW_REQUEST_THRESHOLD);
    const cachedRequests = recentMetrics.filter(m => m.cacheHit);

    // Calculate rate limit utilization (average across all resources)
    const rateLimitUtilization = Array.from(this.rateLimits.values()).reduce((sum, rl) => {
      return sum + ((rl.limit - rl.remaining) / rl.limit);
    }, 0) / Math.max(this.rateLimits.size, 1);

    // Group errors by type
    const errorsByType = failedRequests.reduce((errors, metric) => {
      const errorType = metric.statusCode === 0 ? 'Network Error' : `HTTP ${metric.statusCode}`;
      errors[errorType] = (errors[errorType] || 0) + 1;
      return errors;
    }, {} as Record<string, number>);

    return {
      totalRequests: recentMetrics.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length,
      rateLimitUtilization,
      cacheHitRate: cachedRequests.length / recentMetrics.length,
      errorsByType,
      slowRequests: slowRequests.length,
    };
  }

  getRateLimitStatus(): Map<string, GitHubRateLimit> {
    return new Map(this.rateLimits);
  }

  getRecentMetrics(count: number = 50): GitHubAPIMetrics[] {
    return this.apiMetrics.slice(-count);
  }

  // Helper method to create performance-aware fetch wrapper
  createMonitoredFetch(baseUrl: string = 'https://api.github.com') {
    return async (endpoint: string, options: RequestInit = {}) => {
      const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
      const method = options.method || 'GET';

      return this.wrapGitHubAPICall(
        () => fetch(url, options),
        endpoint,
        method
      );
    };
  }

  // Generate performance report
  generatePerformanceReport(): string {
    const stats = this.getPerformanceStats(60); // Last hour
    const rateLimits = this.getRateLimitStatus();

    let report = '📊 GitHub API Performance Report (Last Hour)\n';
    report += '='.repeat(50) + '\n\n';

    report += `Total Requests: ${stats.totalRequests}\n`;
    report += `Successful: ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%)\n`;
    report += `Failed: ${stats.failedRequests} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(1)}%)\n`;
    report += `Average Response Time: ${stats.averageResponseTime.toFixed(0)}ms\n`;
    report += `Slow Requests (>${this.SLOW_REQUEST_THRESHOLD}ms): ${stats.slowRequests}\n`;
    report += `Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%\n`;
    report += `Rate Limit Utilization: ${(stats.rateLimitUtilization * 100).toFixed(1)}%\n\n`;

    if (Object.keys(stats.errorsByType).length > 0) {
      report += 'Error Breakdown:\n';
      Object.entries(stats.errorsByType).forEach(([type, count]) => {
        report += `  ${type}: ${count}\n`;
      });
      report += '\n';
    }

    if (rateLimits.size > 0) {
      report += 'Rate Limit Status:\n';
      rateLimits.forEach((limit, resource) => {
        const utilizationPercent = ((limit.limit - limit.remaining) / limit.limit * 100).toFixed(1);
        const resetTime = new Date(limit.reset * 1000).toLocaleTimeString();
        report += `  ${resource}: ${limit.remaining}/${limit.limit} (${utilizationPercent}% used, resets at ${resetTime})\n`;
      });
    }

    return report;
  }

  // Cleanup method
  destroy() {
    this.apiMetrics = [];
    this.rateLimits.clear();
  }
}

// Create singleton instance
export const githubAPIMonitoring = new GitHubAPIMonitoring();

// Export monitoring utilities
export { GitHubAPIMonitoring };
export type { GitHubRateLimit, GitHubAPIMetrics, APIPerformanceStats };