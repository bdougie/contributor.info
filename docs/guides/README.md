# How-To Guides

This folder contains practical how-to guides for common development tasks and workflows.

## Contents

### API Integration

- **[using-github-api-backoff.md](./using-github-api-backoff.md)** - Quick guide for using GitHub API with exponential backoff service

## Purpose

This directory provides:
- Step-by-step instructions for common tasks
- Quick reference guides
- Code examples and snippets
- Best practices for specific workflows
- Integration tutorials

## Guide Categories

### API Integration
- Using GitHub API with backoff
- Making resilient API calls
- Handling rate limits
- Managing authentication

### Development Workflows
- Setting up local environment
- Running tests
- Deploying features
- Debugging issues

### Data Management
- Querying Supabase
- Managing migrations
- Optimizing queries
- Handling large datasets

### Testing
- Writing unit tests
- Integration testing
- E2E testing
- Performance testing

## Quick Reference: GitHub API with Backoff

### Import
```typescript
import GitHubAPIService from '@/services/github-api.service';
```

### Basic Usage
```typescript
const githubAPI = new GitHubAPIService(authToken);
const pulls = await githubAPI.fetchPullRequests('owner', 'repo');
```

### Custom Retry
```typescript
const result = await githubAPI.executeWithBackoff(
  async () => fetch('https://api.github.com/custom/endpoint'),
  { maxRetries: 5, initialDelay: 2000 }
);
```

## Common Patterns

### Pattern 1: Fetching with Pagination
Loop through pages until no more results.

### Pattern 2: Handling Errors
Try-catch with specific error handling for 404s vs retryable errors.

### Pattern 3: Checking Rate Limits
Check before making many requests to avoid hitting limits.

## Available Methods

### Repository Operations
- `fetchRepository(owner, repo)`
- `fetchContributors(owner, repo)`
- `fetchCommits(owner, repo)`

### Pull Request Operations
- `fetchPullRequests(owner, repo)`
- `fetchPullRequest(owner, repo, number)`
- `fetchReviews(owner, repo, number)`

### Rate Limit Operations
- `checkRateLimit()`
- `getRateLimitInfo()`

## Configuration Recommendations

### Default (Balanced)
```typescript
const githubAPI = new GitHubAPIService();
```

### Aggressive (More Retries)
```typescript
const config = { maxRetries: 10, initialDelay: 500 };
```

### Conservative (Fewer Retries)
```typescript
const config = { maxRetries: 2, initialDelay: 2000 };
```

## Best Practices

1. Use singleton instances to maintain rate limit state
2. Set appropriate retry configs based on feature criticality
3. Monitor rate limits proactively
4. Handle 404s explicitly (not retried)
5. Use pagination to reduce per-request load
6. Cache responses when data doesn't change frequently

## Related Documentation

- [Architecture](../architecture/) - System architecture patterns
- [API](../api/) - API endpoint documentation
- [Integrations](../integrations/) - Third-party integrations
- [Testing](../testing/) - Testing guidelines
