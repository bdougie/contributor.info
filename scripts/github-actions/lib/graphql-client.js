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
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  async getRateLimit() {
    const query = `
      query {
        rateLimit {
          limit
          cost
          remaining
          resetAt
        }
      }
    `;

    const data = await this.query(query);
    return data.rateLimit;
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
        direction: direction
      }
    };

    const data = await this.query(query, variables);
    
    if (!data.repository) {
      throw new Error(`Repository ${owner}/${name} not found`);
    }

    // Transform to match expected format
    return data.repository.pullRequests.edges.map(edge => ({
      ...edge.node,
      cursor: edge.cursor
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