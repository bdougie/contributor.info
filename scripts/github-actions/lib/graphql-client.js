#!/usr/bin/env node

// Simple GraphQL client for GitHub Actions
// This provides a minimal GraphQL client for use in GitHub Actions scripts

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

class GraphQLClient {
  constructor(token) {
    this.token = token;
  }

  async query(query, variables = {}) {
    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const data = await response.json();

    // Check for rate limit errors specifically
    if (data.errors) {
      const rateLimitError = data.errors.find(
        (err) =>
          err.type === 'RATE_LIMITED' ||
          (err.message && err.message.toLowerCase().includes('rate limit'))
      );

      if (rateLimitError) {
        // Extract rate limit reset time if available
        const resetAt =
          data.data?.rateLimit?.resetAt || new Date(Date.now() + 3600000).toISOString();
        const waitTime = new Date(resetAt) - new Date();

        const error = new Error(`GraphQL rate limit exceeded. Reset at: ${resetAt}`);
        error.type = 'RATE_LIMITED';
        error.resetAt = resetAt;
        error.waitTime = waitTime;
        throw error;
      }

      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  async checkRateLimitBeforeQuery(estimatedCost = 1, minRemainingPoints = 100) {
    const rateLimit = await this.getRateLimit();

    if (rateLimit.remaining < minRemainingPoints) {
      const error = new Error(
        `GraphQL rate limit too low: ${rateLimit.remaining} points remaining (minimum: ${minRemainingPoints})`
      );
      error.type = 'RATE_LIMIT_LOW';
      error.rateLimit = rateLimit;
      throw error;
    }

    if (rateLimit.remaining < estimatedCost) {
      const error = new Error(
        `Insufficient rate limit for query. Need ${estimatedCost} points, have ${rateLimit.remaining}`
      );
      error.type = 'INSUFFICIENT_RATE_LIMIT';
      error.rateLimit = rateLimit;
      throw error;
    }

    return rateLimit;
  }

  async getRateLimit() {
    const query = `
      query {
        rateLimit {
          limit
          cost
          remaining
          resetAt
          nodeCount
          used
        }
      }
    `;

    const data = await this.query(query);

    // Calculate GraphQL-specific metrics
    const rateLimit = data.rateLimit;
    const percentageUsed = (rateLimit.used / rateLimit.limit) * 100;
    const averageCostPerQuery = rateLimit.nodeCount > 0 ? rateLimit.used / rateLimit.nodeCount : 1;

    return {
      ...rateLimit,
      percentageUsed,
      averageCostPerQuery,
      estimatedQueriesRemaining: Math.floor(rateLimit.remaining / Math.max(averageCostPerQuery, 1)),
    };
  }

  async getRepositoryPRsPage(owner, name, pageSize = 100, cursor = null, direction = 'DESC') {
    const query = `
      query($owner: String!, $name: String!, $first: Int!, $after: String, $orderBy: IssueOrder!) {
        repository(owner: $owner, name: $name) {
          pullRequests(first: $first, after: $after, orderBy: $orderBy) {
            edges {
              cursor
              node {
                id
                databaseId
                number
                title
                body
                state
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
                url
                author {
                  login
                  ... on User {
                    id
                    databaseId
                    avatarUrl
                  }
                  ... on Bot {
                    id
                    databaseId
                    avatarUrl
                  }
                }
                commits(first: 1) {
                  totalCount
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const variables = {
      owner,
      name,
      first: pageSize,
      after: cursor,
      orderBy: {
        field: 'CREATED_AT',
        direction: direction,
      },
    };

    const data = await this.query(query, variables);

    if (!data.repository) {
      throw new Error(`Repository ${owner}/${name} not found`);
    }

    // Transform to match expected format
    return data.repository.pullRequests.edges.map((edge) => ({
      ...edge.node,
      cursor: edge.cursor,
    }));
  }
}

export function getGraphQLClient() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  return new GraphQLClient(GITHUB_TOKEN);
}

export { GraphQLClient };
