# GitHub API Strategy - Hybrid GraphQL/REST Implementation

## Overview

This document outlines our hybrid approach to GitHub API usage, where we strategically use both GraphQL and REST APIs based on specific use cases and performance requirements.

## Current Implementation Status

### GraphQL-Enabled Features

The following features have been migrated to GraphQL for improved efficiency:

#### Inngest Functions (Real-time Processing)
- **`capture-pr-details-graphql`** - Fetches complete PR data in a single query
  - Replaces 5 REST API calls with 1 GraphQL query
  - 2-5x rate limit efficiency improvement
- **`capture-repository-sync-graphql`** - Bulk repository synchronization
  - Optimized for processing multiple PRs efficiently

#### GitHub Actions Scripts (Batch Processing)
- **`capture-pr-details-graphql.js`** - Individual PR processing
- **`historical-pr-sync-graphql.js`** - Bulk historical data processing

### REST API Features (Intentionally Maintained)

The following features continue to use REST API by design:

#### Inngest Functions
- **`capture-pr-reviews`** - Fetches PR reviews
  - REST API provides simpler pagination for review data
  - Performance is acceptable with current rate limits
- **`capture-pr-comments`** - Fetches PR comments (issue + review comments)
  - Two REST calls still more efficient than complex GraphQL query
  - Easier to handle comment threading

#### Scripts
- **`capture-pr-reviews.js`** - Batch review processing
- **`capture-pr-comments.js`** - Batch comment processing

## Hybrid Client Architecture

### HybridGitHubClient Features

Our `HybridGitHubClient` (`scripts/progressive-capture/lib/hybrid-github-client.js`) provides:

1. **Automatic API Selection**
   - Defaults to GraphQL for supported operations
   - Falls back to REST on GraphQL errors
   - Configurable via `setGraphQLEnabled()`

2. **Performance Metrics**
   ```javascript
   client.getMetrics()
   // Returns:
   // {
   //   graphqlQueries: 150,
   //   restQueries: 50,
   //   fallbacks: 5,
   //   totalPointsSaved: 450,
   //   fallbackRate: 3.2%,
   //   efficiency: 2.25
   // }
   ```

3. **Unified Response Format**
   - GraphQL responses are transformed to match REST format
   - Seamless switching between APIs
   - No changes required in consuming code

## Decision Rationale

### Why Keep Some Features on REST?

1. **Simplicity**: Some operations are simpler with REST's predictable pagination
2. **Maintenance**: Less code complexity for features that don't benefit significantly from GraphQL
3. **Performance**: Current REST performance is acceptable for review/comment operations
4. **Reliability**: REST API has proven stability for these specific endpoints

### When to Use GraphQL vs REST

**Use GraphQL when:**
- Fetching related data that would require multiple REST calls
- Rate limits are a concern
- Need to minimize API calls for real-time operations

**Use REST when:**
- Simple, single-resource operations
- Well-established pagination patterns
- GraphQL query complexity would exceed benefits

## Monitoring and Optimization

### Rate Limit Tracking

Both APIs are monitored for rate limit usage:
- REST: 5,000 requests/hour limit
- GraphQL: 5,000 points/hour (complexity-based)

### Performance Monitoring

Track hybrid client metrics in production:
```javascript
// Log metrics periodically
setInterval(() => {
  console.log('API Performance:', hybridClient.getMetrics());
}, 300000); // Every 5 minutes
```

### Metrics Available

The hybrid client provides comprehensive metrics via `getMetrics()`:

```javascript
{
  graphqlQueries: 150,        // Total GraphQL queries made
  restQueries: 50,            // Total REST queries made
  fallbacks: 5,               // Times GraphQL failed and fell back to REST
  totalPointsSaved: 450,      // Rate limit points saved by using GraphQL
  totalQueries: 200,          // Combined total queries
  fallbackRate: 3.2,          // Percentage of GraphQL queries that failed
  efficiency: 2.25            // Average points saved per query
}
```

### Production Monitoring Example

```javascript
// In your script or function
import { HybridGitHubClient } from './lib/hybrid-github-client.js';

const client = new HybridGitHubClient(process.env.GITHUB_TOKEN);

// Process your data...
await client.getPRCompleteData(owner, repo, prNumber);

// Log metrics at the end
console.log('Session metrics:', client.getMetrics());

// Send to monitoring service
if (process.env.MONITORING_ENABLED) {
  await sendToMonitoring({
    service: 'github-api',
    metrics: client.getMetrics(),
    timestamp: new Date().toISOString()
  });
}
```

## Future Considerations

### Potential Full Migration

If rate limits become a constraint, we can complete the GraphQL migration:
1. The hybrid client already supports reviews/comments via GraphQL
2. Migration would involve creating GraphQL versions of remaining functions
3. Estimated effort: 2-3 days

### GraphQL Optimization Opportunities

1. **Batch Queries**: Fetch multiple PRs in single query
2. **Field Selection**: Request only needed fields to reduce response size
3. **Subscription Support**: Real-time updates for active repositories

## Migration Path (If Needed)

Should we need to migrate remaining REST features:

1. **Phase 1**: Create GraphQL versions alongside REST
   - `capture-pr-reviews-graphql`
   - `capture-pr-comments-graphql`

2. **Phase 2**: Test and validate GraphQL versions
   - Monitor performance metrics
   - Ensure data consistency

3. **Phase 3**: Switch hybrid client defaults
   - Update to prefer GraphQL for all operations
   - Keep REST as fallback only

## Conclusion

Our hybrid approach balances efficiency with maintainability. The current implementation achieves significant rate limit improvements where it matters most (PR details, repository sync) while maintaining simplicity for operations that don't require optimization.

The architecture supports easy migration if future requirements change, but the current state is intentional and well-suited to our needs.