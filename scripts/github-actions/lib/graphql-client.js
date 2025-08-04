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
}

export function getGraphQLClient() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  return new GraphQLClient(GITHUB_TOKEN);
}

export { GraphQLClient };