# Quick Guide: Using GitHub API with Exponential Backoff

## When to Use

Use the GitHubAPIService whenever making GitHub API calls to:
- Prevent rate limiting errors
- Handle transient failures gracefully
- Improve user experience with automatic retries

## Quick Start

### 1. Import the Service

```typescript
import GitHubAPIService from '@/services/github-api.service';
// or use the adapter
import { getGitHubAPIAdapter } from '@/lib/github-api-adapter';
```

### 2. Basic Usage

```typescript
// Create service instance
const githubAPI = new GitHubAPIService(authToken);

// Fetch data with automatic retry
const pulls = await githubAPI.fetchPullRequests('owner', 'repo');
const repo = await githubAPI.fetchRepository('owner', 'repo');
const contributors = await githubAPI.fetchContributors('owner', 'repo');
```

### 3. Custom Retry Logic

```typescript
// Wrap any GitHub API call
const result = await githubAPI.executeWithBackoff(
  async () => {
    // Your custom GitHub API call
    return await fetch(`https://api.github.com/custom/endpoint`);
  },
  {
    maxRetries: 5,      // Try up to 5 times
    initialDelay: 2000, // Start with 2 second delay
    maxDelay: 30000,    // Max 30 second delay
    jitter: true        // Add randomization
  }
);
```

## Available Methods

### Repository Operations
- `fetchRepository(owner, repo)` - Get repository details
- `fetchContributors(owner, repo, options)` - Get contributors
- `fetchCommits(owner, repo, options)` - Get commits

### Pull Request Operations
- `fetchPullRequests(owner, repo, options)` - List PRs
- `fetchPullRequest(owner, repo, number)` - Get single PR
- `fetchReviews(owner, repo, number)` - Get PR reviews
- `fetchComments(owner, repo, number)` - Get PR comments

### Issue Operations
- `fetchIssues(owner, repo, options)` - List issues

### Rate Limit Operations
- `checkRateLimit()` - Get current rate limit status
- `getRateLimitInfo()` - Get cached rate limit info

## Common Patterns

### Pattern 1: Fetching with Pagination

```typescript
const allPulls = [];
let page = 1;
let hasMore = true;

while (hasMore) {
  const pulls = await githubAPI.fetchPullRequests('owner', 'repo', {
    state: 'all',
    per_page: 100,
    page
  });

  allPulls.push(...pulls);
  hasMore = pulls.length === 100;
  page++;
}
```

### Pattern 2: Handling Errors

```typescript
try {
  const data = await githubAPI.fetchRepository('owner', 'repo');
  // Process data
} catch (error) {
  if (error.status === 404) {
    // Repository not found - this won't be retried
    console.log('Repository does not exist');
  } else {
    // Other errors were already retried
    console.error('Failed after retries:', error);
  }
}
```

### Pattern 3: Checking Rate Limits

```typescript
// Before making many requests
const rateLimit = await githubAPI.checkRateLimit();
if (rateLimit.rate.remaining < 100) {
  console.warn('Low on API calls, be careful!');
}

// After requests
const info = githubAPI.getRateLimitInfo();
console.log(`Remaining API calls: ${info?.remaining}`);
```

## Integration Examples

### In React Hooks

```typescript
export function useGitHubData(owner: string, repo: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const githubAPI = new GitHubAPIService();

    githubAPI.fetchRepository(owner, repo)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return { data, loading };
}
```

### In API Routes

```typescript
export async function GET(request: Request) {
  const githubAPI = new GitHubAPIService(process.env.GITHUB_TOKEN);

  try {
    const data = await githubAPI.fetchPullRequests('owner', 'repo');
    return Response.json(data);
  } catch (error) {
    // Error already retried multiple times
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### With Supabase Edge Functions

```typescript
// In sync-pr-reviewers
import { syncPullRequestReviewers } from '@/lib/sync-pr-reviewers';

// Will automatically use exponential backoff
const prs = await syncPullRequestReviewers(owner, repo, workspaceId, {
  useLocalBackoff: true, // Force client-side backoff
  includeClosedPRs: true,
  maxClosedDays: 30
});
```

## Configuration Guide

### Default (Balanced)
```typescript
// No config needed - uses sensible defaults
const githubAPI = new GitHubAPIService();
```

### Aggressive (More Retries)
```typescript
const config = {
  maxRetries: 10,
  initialDelay: 500,
  maxDelay: 60000,
  factor: 1.5
};
```

### Conservative (Fewer Retries)
```typescript
const config = {
  maxRetries: 2,
  initialDelay: 2000,
  maxDelay: 10000,
  factor: 2
};
```

### Real-time (Fast Fail)
```typescript
const config = {
  maxRetries: 1,
  initialDelay: 500,
  maxDelay: 1000,
  factor: 2
};
```

## What Gets Retried?

### ✅ Automatically Retried
- Rate limit errors (429)
- Server errors (500, 502, 503, etc.)
- Network/connection errors
- Timeouts

### ❌ Not Retried
- Not Found (404)
- Unauthorized (401)
- Forbidden (403) - except rate limits
- Bad Request (400)
- Other 4xx client errors

## Debugging

### Enable Detailed Logging

The service automatically logs retry attempts:
```
Retrying after 2000ms (attempt 2/3)...
Rate limited. Waiting 45 seconds until reset...
```

### Monitor Rate Limits

```typescript
// Log rate limit after operations
const rateLimitInfo = githubAPI.getRateLimitInfo();
console.log('API calls remaining:', rateLimitInfo?.remaining);
console.log('Resets at:', new Date(rateLimitInfo?.reset * 1000));
```

## Best Practices

1. **Use singleton instances** when possible to maintain rate limit state
2. **Set appropriate retry configs** based on feature criticality
3. **Monitor rate limits** proactively in high-traffic features
4. **Handle 404s explicitly** as they won't be retried
5. **Use pagination** to reduce per-request load
6. **Cache responses** when data doesn't change frequently

## Migration Checklist

When migrating existing code:

- [ ] Replace direct `fetch()` calls with service methods
- [ ] Remove manual retry logic
- [ ] Update error handling (errors are now post-retry)
- [ ] Add rate limit monitoring if needed
- [ ] Test with artificial rate limits
- [ ] Monitor error rates after deployment

## Troubleshooting

### "Maximum retries exceeded"
- Check if API endpoint exists (404s don't retry)
- Verify authentication token is valid
- Check GitHub API status page

### "Rate limit exceeded" still appearing
- Increase `maxRetries` configuration
- Add longer `maxDelay`
- Consider caching responses
- Use multiple API tokens

### Slow response times
- Reduce `maxRetries` for user-facing features
- Use `useLocalBackoff: false` to skip client-side retries
- Implement caching layer

## Related Documentation

- [Full Architecture Document](../architecture/github-api-exponential-backoff.md)
- [GitHub API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits)
- [Testing Guidelines](../testing/BULLETPROOF_TESTING_GUIDELINES.md)