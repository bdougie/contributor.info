# GitHub GraphQL API Migration Plan

## Executive Summary

Migrating from GitHub's REST API to GraphQL API will significantly improve our rate limit efficiency and reduce the number of API calls needed for progressive data capture.

## Rate Limit Comparison

### Current REST API Limitations
- **Primary Limit**: 5,000 requests/hour
- **Secondary Limit**: 900 points/minute (GET=1pt, POST=5pts)
- **Problem**: Each PR requires 3-5 separate REST calls
  - GET `/repos/{owner}/{repo}/pulls/{number}` (PR details)
  - GET `/repos/{owner}/{repo}/pulls/{number}/reviews` (reviews)
  - GET `/repos/{owner}/{repo}/pulls/{number}/comments` (review comments)
  - GET `/repos/{owner}/{repo}/issues/{number}/comments` (issue comments)
  - GET `/repos/{owner}/{repo}/pulls/{number}/files` (file changes)

### GraphQL API Advantages
- **Primary Limit**: 5,000 points/hour (same total, but smarter allocation)
- **Secondary Limit**: 2,000 points/minute (higher than REST)
- **Efficiency**: Single query can fetch all PR data (1-10 points vs 5 requests)
- **Flexibility**: Request only needed fields, reducing bandwidth and processing

## Efficiency Analysis

### Current Approach (REST)
```
1 PR = 5 REST calls = 5 rate limit units
100 PRs = 500 rate limit units
1000 PRs = 5000 rate limit units (entire hourly limit!)
```

### Proposed Approach (GraphQL)
```
1 PR = 1 GraphQL query = 3-8 points (depending on complexity)
100 PRs = 300-800 points 
1000 PRs = 3000-8000 points (can process more than hourly limit allows)
```

**Result**: 2-5x more efficient rate limit usage

## Implementation Plan

### Phase 1: GraphQL Client Setup

#### 1.1 Install Dependencies
```bash
npm install @octokit/graphql @octokit/graphql-schema
```

#### 1.2 Create GraphQL Client
```typescript
// src/lib/github/graphql-client.ts
import { graphql } from '@octokit/graphql';

export class GitHubGraphQLClient {
  private client: typeof graphql;
  
  constructor(token: string) {
    this.client = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
  }

  async query(query: string, variables?: Record<string, any>) {
    try {
      return await this.client(query, variables);
    } catch (error) {
      // Handle rate limiting and errors
      throw error;
    }
  }
}
```

### Phase 2: GraphQL Queries

#### 2.1 Comprehensive PR Query
```graphql
query GetPullRequestDetails($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      id
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
          id: databaseId
          type: __typename
        }
        ... on Bot {
          id: databaseId
          type: __typename
        }
      }
      
      # Merge information
      mergedBy {
        login
        avatarUrl
        ... on User {
          id: databaseId
          type: __typename
        }
      }
      
      # File changes
      additions
      deletions
      changedFiles
      commits {
        totalCount
      }
      
      # Reviews with details
      reviews(first: 100) {
        totalCount
        nodes {
          id: databaseId
          state
          body
          submittedAt
          author {
            login
            avatarUrl
            ... on User {
              id: databaseId
              type: __typename
            }
          }
          commit {
            oid
          }
        }
      }
      
      # Review comments (code comments)
      reviewComments(first: 100) {
        totalCount
        nodes {
          id: databaseId
          body
          createdAt
          updatedAt
          position
          originalPosition
          diffHunk
          path
          author {
            login
            avatarUrl
            ... on User {
              id: databaseId
              type: __typename
            }
          }
          inReplyTo {
            id: databaseId
          }
        }
      }
      
      # Issue comments (general PR comments)
      comments(first: 100) {
        totalCount
        nodes {
          id: databaseId
          body
          createdAt
          updatedAt
          author {
            login
            avatarUrl
            ... on User {
              id: databaseId
              type: __typename
            }
          }
        }
      }
      
      # Branch information
      baseRefName
      headRefName
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
```

#### 2.2 Batch PR Query
```graphql
query GetMultiplePRs($owner: String!, $repo: String!, $prNumbers: [Int!]!) {
  repository(owner: $owner, name: $repo) {
    # Use aliases to fetch multiple PRs in one query
    pr1: pullRequest(number: $prNumbers[0]) { ...PRFragment }
    pr2: pullRequest(number: $prNumbers[1]) { ...PRFragment }
    pr3: pullRequest(number: $prNumbers[2]) { ...PRFragment }
    # ... up to reasonable limit
  }
  rateLimit { limit cost remaining resetAt }
}

fragment PRFragment on PullRequest {
  # Same fields as above
}
```

### Phase 3: Migration Strategy

#### 3.1 Hybrid Approach
```typescript
// src/lib/github/hybrid-client.ts
export class HybridGitHubClient {
  private rest: Octokit;
  private graphql: GitHubGraphQLClient;
  
  async getPRDetails(owner: string, repo: string, prNumber: number) {
    try {
      // Try GraphQL first (more efficient)
      return await this.getPRDetailsGraphQL(owner, repo, prNumber);
    } catch (error) {
      // Fallback to REST if GraphQL fails
      console.warn('GraphQL failed, falling back to REST:', error);
      return await this.getPRDetailsREST(owner, repo, prNumber);
    }
  }

  async getPRDetailsGraphQL(owner: string, repo: string, prNumber: number) {
    const result = await this.graphql.query(GET_PR_DETAILS_QUERY, {
      owner,
      repo,
      number: prNumber
    });
    
    // Transform GraphQL response to our internal format
    return this.transformGraphQLResponse(result);
  }
}
```

#### 3.2 Update Inngest Functions
```typescript
// src/lib/inngest/functions/capture-pr-details-graphql.ts
export const capturePrDetailsGraphQL = inngest.createFunction(
  {
    id: "capture-pr-details-graphql",
    name: "Capture PR Details (GraphQL)",
    concurrency: { limit: 10 }, // Can increase due to better rate limits
    throttle: { limit: 50, period: "1m" } // More generous
  },
  { event: "capture/pr.details.graphql" },
  async ({ event, step }) => {
    const { repositoryId, prNumber, prId } = event.data;

    // Single GraphQL query gets everything
    const prData = await step.run("fetch-pr-all-data", async () => {
      const result = await hybridClient.getPRDetails(owner, repo, prNumber);
      return result;
    });

    // Single database transaction for all data
    await step.run("store-all-data", async () => {
      await supabase.rpc('upsert_pr_complete_data', {
        pr_data: prData.pullRequest,
        reviews_data: prData.reviews,
        comments_data: prData.comments,
        review_comments_data: prData.reviewComments
      });
    });

    return { success: true, pointsUsed: prData.rateLimit.cost };
  }
);
```

### Phase 4: Database Optimizations

#### 4.1 Stored Procedure for Bulk Upserts
```sql
-- Create stored procedure for efficient bulk operations
CREATE OR REPLACE FUNCTION upsert_pr_complete_data(
  pr_data JSONB,
  reviews_data JSONB,
  comments_data JSONB,
  review_comments_data JSONB
) RETURNS void AS $$
BEGIN
  -- Upsert PR
  INSERT INTO pull_requests (...)
  VALUES (...)
  ON CONFLICT (github_id) DO UPDATE SET ...;
  
  -- Upsert reviews
  INSERT INTO reviews (...)
  SELECT * FROM jsonb_to_recordset(reviews_data) AS r(...)
  ON CONFLICT (github_id) DO UPDATE SET ...;
  
  -- Upsert comments
  INSERT INTO comments (...)
  SELECT * FROM jsonb_to_recordset(comments_data) AS c(...)
  ON CONFLICT (github_id) DO UPDATE SET ...;
  
  -- Upsert review comments
  INSERT INTO comments (...)
  SELECT * FROM jsonb_to_recordset(review_comments_data) AS rc(...)
  ON CONFLICT (github_id) DO UPDATE SET ...;
END;
$$ LANGUAGE plpgsql;
```

### Phase 5: Rate Limit Monitoring

#### 5.1 GraphQL Rate Limit Tracking
```typescript
export class GraphQLRateLimitTracker {
  private lastRateLimit: RateLimitInfo | null = null;
  
  trackRateLimit(rateLimit: RateLimitInfo) {
    this.lastRateLimit = rateLimit;
    
    // Warn if approaching limits
    if (rateLimit.remaining < 1000) {
      console.warn(`GraphQL rate limit low: ${rateLimit.remaining} points remaining`);
    }
    
    // Log efficiency metrics
    console.log(`Query cost: ${rateLimit.cost} points`);
  }
  
  getEfficiencyScore(): number {
    // Calculate points per data item retrieved
    return this.lastRateLimit?.cost / this.itemsRetrieved || 0;
  }
}
```

## Expected Benefits

### Performance Improvements
- **2-5x fewer API calls** needed for the same data
- **Reduced latency** from fewer round trips
- **Better timeout resilience** from consolidated requests

### Rate Limit Efficiency
- **Higher throughput** within the same rate limits
- **Smarter resource usage** with point-based allocation
- **Better secondary limit utilization** (2,000 vs 900 points/minute)

### Code Simplification
- **Single query** replaces multiple function calls
- **Atomic data fetching** reduces race conditions
- **Better error handling** with consolidated requests

## Migration Timeline

### Week 1: Setup & Basic Queries
- [ ] Install GraphQL dependencies
- [ ] Create basic GraphQL client
- [ ] Implement simple PR details query
- [ ] Test against existing REST implementation

### Week 2: Comprehensive Queries
- [ ] Build complete PR data query
- [ ] Add batch processing capabilities
- [ ] Implement fallback mechanisms
- [ ] Create rate limit monitoring

### Week 3: Inngest Integration
- [ ] Create GraphQL-based Inngest functions
- [ ] Update queue managers
- [ ] Implement database optimizations
- [ ] Run parallel testing

### Week 4: Production Migration
- [ ] Deploy with feature flags
- [ ] Monitor performance and rate limits
- [ ] Gradually migrate traffic
- [ ] Document learnings and optimizations

## Risk Mitigation

### Technical Risks
- **GraphQL query complexity**: Start simple, optimize iteratively
- **Schema changes**: Monitor GitHub's GraphQL schema updates
- **Error handling**: Robust fallback to REST API

### Operational Risks
- **Learning curve**: Team training on GraphQL concepts
- **Debugging**: Different tooling for GraphQL vs REST
- **Monitoring**: New metrics and alerting needed

## Success Metrics

### Performance Targets
- **50% reduction** in API call volume
- **30% improvement** in data capture speed
- **2x increase** in hourly processing capacity

### Rate Limit Efficiency
- **Track points per PR** processed
- **Monitor secondary limits** utilization
- **Measure timeout reduction** from fewer calls

## Future Opportunities

### Advanced GraphQL Features
- **Subscriptions**: Real-time data updates
- **Fragments**: Reusable query components
- **Batch operations**: Process multiple repositories

### Intelligence Optimizations
- **Dynamic query building**: Request only missing data
- **Cost prediction**: Estimate query costs before execution
- **Adaptive batching**: Optimize batch sizes based on complexity

This migration to GraphQL represents a significant step toward more efficient GitHub API usage and will provide a solid foundation for the hybrid Inngest + GitHub Actions architecture.