import { graphql } from 'https://esm.sh/@octokit/graphql@7.0.2';

// Export NonRetriableError for use in other files
export class NonRetriableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetriableError';
  }
}

// GitHub token from server environment
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN') || '';

// GraphQL query for fetching recent PRs
const GET_RECENT_PRS_QUERY = `
  query GetRecentPRs($owner: String!, $repo: String!, $since: DateTime!, $first: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}, states: [OPEN, CLOSED, MERGED]) {
        nodes {
          id
          databaseId
          number
          title
          state
          isDraft
          createdAt
          updatedAt
          closedAt
          mergedAt
          merged
          additions
          deletions
          changedFiles
          baseRefName
          headRefName
          author {
            login
            avatarUrl
            ... on User {
              databaseId
              name
              email
              bio
              company
              location
              blog
              createdAt
            }
            ... on Bot {
              databaseId
            }
          }
          commits {
            totalCount
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
      rateLimit {
        limit
        remaining
        resetAt
        cost
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
      cost
    }
  }
`;

// GraphQL query for comprehensive PR details
const GET_PR_DETAILS_QUERY = `
  query GetPullRequestDetails($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        databaseId
        number
        title
        body
        state
        isDraft
        createdAt
        updatedAt
        closedAt
        mergedAt
        merged
        mergeable

        author {
          login
          avatarUrl
          ... on User {
            databaseId
            name
            email
          }
          ... on Bot {
            databaseId
          }
        }

        mergedBy {
          login
          avatarUrl
          ... on User {
            databaseId
          }
        }

        additions
        deletions
        changedFiles
        commits {
          totalCount
        }

        baseRefName
        headRefName
        headRef {
          target {
            oid
          }
        }

        reviews(first: 100) {
          totalCount
          nodes {
            databaseId
            state
            body
            submittedAt
            author {
              login
              avatarUrl
              ... on User {
                databaseId
              }
            }
            commit {
              oid
            }
            comments(first: 50) {
              nodes {
                databaseId
                body
                createdAt
                updatedAt
                position
                outdated
                diffHunk
                path
                author {
                  login
                  avatarUrl
                  ... on User {
                    databaseId
                  }
                }
              }
            }
          }
        }

        comments(first: 100) {
          totalCount
          nodes {
            databaseId
            body
            createdAt
            updatedAt
            author {
              login
              avatarUrl
              ... on User {
                databaseId
              }
            }
          }
        }

        files(first: 100) {
          totalCount
          nodes {
            path
            additions
            deletions
            changeType
          }
        }

        labels(first: 20) {
          nodes {
            name
            color
            description
          }
        }
      }
      rateLimit {
        limit
        remaining
        resetAt
        cost
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
      cost
    }
  }
`;

// Time-windowed metrics to prevent memory leaks
interface MetricsWindow {
  timestamp: number;
  queries: number;
  pointsUsed: number;
  fallbacks: number;
}

export class GraphQLClient {
  private client: typeof graphql;
  private rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
    cost: number;
  } | null = null;

  // Use a rolling window of metrics (last hour)
  private metricsWindows: MetricsWindow[] = [];
  private readonly WINDOW_SIZE_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_WINDOWS = 60; // Keep max 60 windows (1 per minute)

  constructor() {
    if (!GITHUB_TOKEN) {
      throw new Error('GitHub token is required for GraphQL client');
    }

    this.client = graphql.defaults({
      headers: {
        authorization: `token ${GITHUB_TOKEN}`,
      },
    });
  }

  // Clean up old metrics windows
  private cleanupOldWindows(): void {
    const now = Date.now();
    const cutoff = now - this.WINDOW_SIZE_MS;

    // Remove windows older than 1 hour
    this.metricsWindows = this.metricsWindows.filter((w) => w.timestamp > cutoff);

    // If we still have too many windows, keep only the most recent
    if (this.metricsWindows.length > this.MAX_WINDOWS) {
      this.metricsWindows = this.metricsWindows.slice(-this.MAX_WINDOWS);
    }
  }

  // Add metrics to current window
  private recordMetric(type: 'query' | 'points' | 'fallback', value: number = 1): void {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000; // Round to nearest minute

    let window = this.metricsWindows.find((w) => w.timestamp === currentMinute);
    if (!window) {
      window = {
        timestamp: currentMinute,
        queries: 0,
        pointsUsed: 0,
        fallbacks: 0,
      };
      this.metricsWindows.push(window);
    }

    switch (type) {
      case 'query':
        window.queries += value;
        break;
      case 'points':
        window.pointsUsed += value;
        break;
      case 'fallback':
        window.fallbacks += value;
        break;
    }

    // Clean up old windows periodically
    if (Math.random() < 0.1) {
      // 10% chance to clean up on each record
      this.cleanupOldWindows();
    }
  }

  // Get aggregated metrics for the last hour
  private getAggregatedMetrics() {
    this.cleanupOldWindows();

    const totals = this.metricsWindows.reduce(
      (acc, window) => ({
        totalQueries: acc.totalQueries + window.queries,
        totalPointsUsed: acc.totalPointsUsed + window.pointsUsed,
        fallbackCount: acc.fallbackCount + window.fallbacks,
      }),
      { totalQueries: 0, totalPointsUsed: 0, fallbackCount: 0 }
    );

    return totals;
  }

  async getRecentPRs(
    owner: string,
    repo: string,
    since: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      console.log(`Fetching recent PRs for ${owner}/${repo} since ${since}`);

      const response = await this.client(GET_RECENT_PRS_QUERY, {
        owner,
        repo,
        since,
        first: Math.min(limit, 100),
      });

      this.recordMetric('query');

      if (response.rateLimit) {
        this.rateLimit = response.rateLimit;
        this.recordMetric('points', response.rateLimit.cost || 0);
      }

      return response.repository?.pullRequests?.nodes || [];
    } catch (error: any) {
      console.error(`GraphQL error for ${owner}/${repo}:`, error.message);

      if (error.message?.includes('NOT_FOUND')) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }

      if (error.message?.includes('rate limit')) {
        throw new Error(`GraphQL rate limit exceeded`);
      }

      this.recordMetric('fallback');
      throw error;
    }
  }

  async getPRDetails(owner: string, repo: string, prNumber: number): Promise<any> {
    try {
      console.log(`Fetching PR details for ${owner}/${repo}#${prNumber}`);

      const response = await this.client(GET_PR_DETAILS_QUERY, {
        owner,
        repo,
        number: prNumber,
      });

      this.recordMetric('query');

      if (response.rateLimit) {
        this.rateLimit = response.rateLimit;
        this.recordMetric('points', response.rateLimit.cost || 0);
      }

      return response.repository?.pullRequest;
    } catch (error: any) {
      console.error(`GraphQL error for PR ${owner}/${repo}#${prNumber}:`, error.message);

      if (error.message?.includes('NOT_FOUND')) {
        throw new Error(`PR ${owner}/${repo}#${prNumber} not found`);
      }

      if (error.message?.includes('rate limit')) {
        throw new Error(`GraphQL rate limit exceeded`);
      }

      this.recordMetric('fallback');
      throw error;
    }
  }

  getRateLimit() {
    return this.rateLimit;
  }

  getMetrics() {
    const metrics = this.getAggregatedMetrics();
    return {
      ...metrics,
      averagePointsPerQuery:
        metrics.totalQueries > 0 ? metrics.totalPointsUsed / metrics.totalQueries : 0,
      fallbackRate:
        metrics.totalQueries > 0 ? (metrics.fallbackCount / metrics.totalQueries) * 100 : 0,
      rateLimit: this.rateLimit,
      windowCount: this.metricsWindows.length,
      windowPeriod: '1 hour rolling window',
    };
  }
}
