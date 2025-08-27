import { graphql } from '@octokit/graphql';

// GitHub token from server environment - this runs in Inngest functions (server context)
// Note: In production Netlify functions, we need to ensure GITHUB_TOKEN is set as an env var
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || '';

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
        
        # Author information
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
        
        # Merge information
        mergedBy {
          login
          avatarUrl
          ... on User {
            databaseId
          }
        }
        
        # File changes
        additions
        deletions
        changedFiles
        commits {
          totalCount
        }
        
        # Branch information
        baseRefName
        headRefName
        headRef {
          target {
            oid
          }
        }
        
        # Reviews with details including review comments
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
            # Review comments within each review
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
                replyTo {
                  databaseId
                }
                commit {
                  oid
                }
                originalCommit {
                  oid
                }
              }
            }
          }
        }
        
        # Issue comments (general PR comments)
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
      }
    }
    
    # Rate limit information
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

// GraphQL query for recent PRs
const GET_RECENT_PRS_QUERY = `
  query GetRecentPRs($owner: String!, $repo: String!, $first: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
        totalCount
        nodes {
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
          commits {
            totalCount
          }
          author {
            login
            avatarUrl
            ... on User {
              databaseId
            }
          }
          baseRefName
          headRefName
        }
      }
    }
    
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

export interface RateLimitInfo {
  limit: number;
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface GraphQLResponse {
  repository: any;
  rateLimit?: RateLimitInfo;
}

export interface PRDetailsResponse extends GraphQLResponse {
  pullRequest: any;
}

export interface PaginatedPRsResponse {
  repository: {
    pullRequests: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: Array<{
        id: string;
        databaseId: number;
        number: number;
        title: string;
        body: string;
        state: string;
        isDraft: boolean;
        createdAt: string;
        updatedAt: string;
        closedAt: string | null;
        mergedAt: string | null;
        merged: boolean;
        additions: number;
        deletions: number;
        changedFiles: number;
        baseRefName: string;
        headRefName: string;
        author: {
          login: string;
          avatarUrl: string;
          databaseId?: number;
        } | null;
        commits: {
          totalCount: number;
        };
        cursor?: string;
      }>;
    };
  };
  rateLimit?: RateLimitInfo;
}

export class GraphQLClient {
  private client: typeof graphql;
  private lastRateLimit: RateLimitInfo | null = null;
  private metrics = {
    queriesExecuted: 0,
    totalPointsUsed: 0,
    fallbackCount: 0,
  };

  constructor() {
    if (!GITHUB_TOKEN) {
      const env = process.env.NODE_ENV || 'unknown';
      const hasGithubToken = !!process.env.GITHUB_TOKEN;
      const hasViteGithubToken = !!process.env.VITE_GITHUB_TOKEN;
      throw new Error(
        `GitHub token not found in environment variables. Environment: ${env}, GITHUB_TOKEN exists: ${hasGithubToken}, VITE_GITHUB_TOKEN exists: ${hasViteGithubToken}`
      );
    }

    this.client = graphql.defaults({
      headers: {
        authorization: `token ${GITHUB_TOKEN}`,
      },
    });
  }

  /**
   * Get comprehensive PR details using GraphQL
   */
  async getPRDetails(owner: string, repo: string, prNumber: number): Promise<PRDetailsResponse> {
    try {
      const startTime = Date.now();

      const result = (await this.client(GET_PR_DETAILS_QUERY, {
        owner,
        repo,
        number: prNumber,
      })) as GraphQLResponse;

      const duration = Date.now() - startTime;

      // Track metrics
      this.metrics.queriesExecuted++;
      this.metrics.totalPointsUsed += result.rateLimit?.cost || 0;
      this.lastRateLimit = result.rateLimit || null;

      // Log performance
      console.log(
        '[GraphQL] PR #%s query completed in %sms (cost: %s points)',
        prNumber,
        duration,
        result.rateLimit?.cost
      );

      // Warn if approaching rate limits
      if (result.rateLimit && result.rateLimit.remaining < 1000) {
        console.warn(`[GraphQL] Rate limit low: ${result.rateLimit.remaining} points remaining`);
      }

      return {
        ...result,
        pullRequest: result.repository?.pullRequest,
      };
    } catch (error: any) {
      this.metrics.fallbackCount++;

      // Enhanced error handling for GraphQL
      if (error.message?.includes('rate limit')) {
        throw new Error(`GraphQL rate limit exceeded`);
      }

      if (error.message?.includes('NOT_FOUND')) {
        throw new Error(`PR #${prNumber} not found in ${owner}/${repo}`);
      }

      // Log the error but don't modify it - let caller handle fallback
      console.error(`[GraphQL] Query failed for ${owner}/${repo}#${prNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Get recent PRs using GraphQL
   */
  async getRecentPRs(
    owner: string,
    repo: string,
    since: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const result = (await this.client(GET_RECENT_PRS_QUERY, {
        owner,
        repo,
        first: Math.min(limit, 100), // GraphQL API limit
      })) as GraphQLResponse;

      this.metrics.queriesExecuted++;
      this.metrics.totalPointsUsed += result.rateLimit?.cost || 0;
      this.lastRateLimit = result.rateLimit || null;

      console.log(
        '[GraphQL] Recent PRs query for %s/%s (cost: %s points)',
        owner,
        repo,
        result.rateLimit?.cost
      );

      const allPRs = result.repository?.pullRequests?.nodes || [];

      // Filter PRs updated since the given date (client-side filtering)
      const sinceDate = new Date(since);
      const filteredPRs = allPRs.filter((pr: any) => {
        const updatedAt = new Date(pr.updatedAt);
        return updatedAt >= sinceDate;
      });

      return filteredPRs;
    } catch (error: any) {
      this.metrics.fallbackCount++;
      console.error(`[GraphQL] Recent PRs query failed for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a page of repository PRs using cursor-based pagination
   * Used for progressive backfill to get historical PRs efficiently
   */
  async getRepositoryPRsPage(
    owner: string,
    repo: string,
    pageSize: number = 25,
    cursor: string | null = null,
    direction: 'ASC' | 'DESC' = 'DESC'
  ): Promise<any[]> {
    const PAGINATED_PRS_QUERY = `
      query GetPaginatedPRs($owner: String!, $repo: String!, $first: Int!, $after: String, $orderBy: IssueOrder!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: $first, after: $after, orderBy: $orderBy) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
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
                }
                ... on Bot {
                  databaseId
                }
              }
              commits {
                totalCount
              }
            }
          }
        }
      }
    `;

    try {
      const startTime = Date.now();

      const response = await this.client<PaginatedPRsResponse>({
        query: PAGINATED_PRS_QUERY,
        owner,
        repo,
        first: pageSize,
        after: cursor,
        orderBy: {
          field: 'CREATED_AT',
          direction,
        },
      });

      const duration = Date.now() - startTime;
      console.log(
        '[GraphQL] Fetched page of %s PRs in %sms',
        response.repository.pullRequests.nodes.length,
        duration
      );

      // Update metrics
      this.metrics.queriesExecuted++;
      if (response.rateLimit) {
        this.lastRateLimit = response.rateLimit;
      }

      // Return PRs with cursor info
      const prs = response.repository.pullRequests.nodes;
      const pageInfo = response.repository.pullRequests.pageInfo;

      // Add cursor to last PR for tracking
      if (prs.length > 0 && pageInfo.endCursor) {
        prs[prs.length - 1].cursor = pageInfo.endCursor;
      }

      return prs;
    } catch (error: any) {
      console.error(`[GraphQL] Paginated PRs query failed for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimit(): RateLimitInfo | null {
    return this.lastRateLimit;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      fallbackRate:
        this.metrics.queriesExecuted > 0
          ? (this.metrics.fallbackCount / this.metrics.queriesExecuted) * 100
          : 0,
      averagePointsPerQuery:
        this.metrics.queriesExecuted > 0
          ? this.metrics.totalPointsUsed / this.metrics.queriesExecuted
          : 0,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      queriesExecuted: 0,
      totalPointsUsed: 0,
      fallbackCount: 0,
    };
  }
}

// Singleton instance for reuse
let graphqlClient: GraphQLClient | null = null;

export function getGraphQLClient(): GraphQLClient {
  if (!graphqlClient) {
    graphqlClient = new GraphQLClient();
  }
  return graphqlClient;
}
