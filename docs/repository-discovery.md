# Repository discovery

## How it works

When you visit a repository page for the first time, we automatically gather contributor data in the background. You'll see cached data immediately if it exists, or a brief setup process for new repositories.

## User experience

### Existing repositories
- **Instant results**: Cached data loads immediately
- **Background updates**: Fresh data syncs automatically
- **No interruption**: Continue viewing insights while updates happen

### New repositories
1. **Setup notification**: "Setting up pytorch/pytorch..."
2. **Background processing**: We analyze pull requests, reviews, and contributions
3. **Ready notification**: "Repository data updated! Fresh data is now available"
4. **Duration**: Usually 1-2 minutes for most repositories

## Technical implementation

### Components

**Repository discovery hook** (`useRepositoryDiscovery`)
- Checks if repository exists in database
- Triggers discovery for new repositories
- Manages UI state and notifications
- Polls for completion

**Discovery API** (`/api/discover-repository`)
- Validates repository format
- Sends discovery event to background processor
- Returns immediately for responsive UI

**Background processor** (`discover-new-repository`)
- Fetches repository data from GitHub API
- Creates repository record
- Triggers data sync for pull requests
- Handles errors and retries

### States

```typescript
type DiscoveryState = 
  | 'checking'     // Verifying repository exists
  | 'ready'        // Repository data available
  | 'discovering'  // Setting up new repository
  | 'error'        // Something went wrong
```

### Error handling

**Repository not found**
- Shows "Repository not found" page
- Suggests checking the URL
- Provides search to find similar repositories

**Setup timeout** 
- Shows helpful error after 2 minutes
- Suggests refreshing the page
- Background process continues running

**API failures**
- Graceful fallback to cached data
- User-friendly error messages
- Retry mechanisms for transient failures

## Configuration

### Rate limits
- **GitHub API**: Respectful usage with exponential backoff
- **Discovery requests**: One per repository to prevent duplicates
- **Polling frequency**: Every 2 seconds during setup

### Supported repositories
- **Public repositories**: Full access to data
- **Private repositories**: Requires authentication
- **Large repositories**: Intelligent batching for performance

## Monitoring

Track discovery performance:
- Setup success rate
- Average completion time
- Error frequencies
- User satisfaction

## Future improvements

**Planned enhancements**
- Pre-discovery for popular repositories
- Real-time progress indicators
- Partial data loading for faster initial results
- Smart caching based on repository activity

**Performance optimizations**
- GraphQL queries for efficient data fetching
- Parallel processing for multiple data sources
- Incremental updates for active repositories