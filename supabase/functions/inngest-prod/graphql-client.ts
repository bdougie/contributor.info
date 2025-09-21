import { graphql } from 'https://esm.sh/@octokit/graphql@7.0.2';

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

export class GraphQLClient {
  private client: typeof graphql;
  private rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
    cost: number;
  } | null = null;

  private metrics = {
    totalQueries: 0,
    totalPointsUsed: 0,
    fallbackCount: 0,
  };

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

  async getRecentPRs(owner: string, repo: string, since: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`Fetching recent PRs for ${owner}/${repo} since ${since}`);

      const response = await this.client(GET_RECENT_PRS_QUERY, {
        owner,
        repo,
        since,
        first: Math.min(limit, 100),
      });

      this.metrics.totalQueries++;

      if (response.rateLimit) {
        this.rateLimit = response.rateLimit;
        this.metrics.totalPointsUsed += response.rateLimit.cost || 0;
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

      this.metrics.fallbackCount++;
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

      this.metrics.totalQueries++;

      if (response.rateLimit) {
        this.rateLimit = response.rateLimit;
        this.metrics.totalPointsUsed += response.rateLimit.cost || 0;
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

      this.metrics.fallbackCount++;
      throw error;
    }
  }

  getRateLimit() {
    return this.rateLimit;
  }

  getMetrics() {
    return {
      ...this.metrics,
      averagePointsPerQuery: this.metrics.totalQueries > 0
        ? this.metrics.totalPointsUsed / this.metrics.totalQueries
        : 0,
      fallbackRate: this.metrics.totalQueries > 0
        ? (this.metrics.fallbackCount / this.metrics.totalQueries) * 100
        : 0,
    };
  }
}