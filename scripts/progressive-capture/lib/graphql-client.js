import { graphql } from '@octokit/graphql';

export class GitHubGraphQLClient {
  constructor(token) {
    this.client = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
    this.lastRateLimit = null;
  }

  async query(query, variables = {}) {
    try {
      const result = await this.client(query, variables);

      // Track rate limit information
      if (result.rateLimit) {
        this.lastRateLimit = result.rateLimit;
        this.logRateLimit(result.rateLimit);
      }

      return result;
    } catch (error) {
      // Handle GraphQL-specific errors
      if (error.name === 'GraphqlResponseError') {
        console.error('GraphQL Error:', error.message);
        if (error.errors) {
          error.errors.forEach((err) => {
            console.error('  -', err.message);
          });
        }
      }
      throw error;
    }
  }

  logRateLimit(rateLimit) {
    const { cost, remaining, limit, resetAt } = rateLimit;
    console.log(
      `GraphQL Rate Limit - Cost: ${cost}, Remaining: ${remaining}/${limit}, Reset: ${resetAt}`
    );

    // Warn if approaching limits
    if (remaining < 1000) {
      console.warn(`⚠️  GraphQL rate limit low: ${remaining} points remaining`);
    }
  }

  getRateLimit() {
    return this.lastRateLimit;
  }

  // Calculate efficiency score (points per data item)
  getEfficiencyScore(itemsRetrieved) {
    if (!this.lastRateLimit || !itemsRetrieved) return 0;
    return this.lastRateLimit.cost / itemsRetrieved;
  }
}
