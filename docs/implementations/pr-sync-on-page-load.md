# PR Data Sync on Page Load Implementation

## Overview
This implementation provides an on-demand PR data synchronization pattern that updates pull request data (including closed PRs) only when the workspace page is loaded, ensuring fresh data for PR Author Status and Reviewer Distribution charts without unnecessary background syncing.

## Key Features

### 1. **On-Demand Sync Strategy**
- PR data is synced from GitHub API only when the workspace page loads
- Includes both open and recently closed PRs (last 30 days by default)
- Stores synced data in database with timestamp for staleness checking

### 2. **Smart Caching**
- Checks if existing data is stale (default: older than 60 minutes)
- Only syncs from GitHub if data is stale or missing
- Returns cached data if fresh, minimizing API calls

### 3. **Complete Reviewer Data**
- Fetches reviewer data for both open and closed PRs
- Preserves reviewer history when PRs close
- Stores reviewer data in JSONB column for fast access

## Implementation Components

### Modified Files

1. **`src/lib/sync-pr-reviewers.ts`**
   - Added `SyncOptions` interface for configurable syncing
   - Support for fetching closed PRs with `includeClosedPRs` option
   - Database update capability with `updateDatabase` flag

2. **`supabase/functions/sync-pr-reviewers/index.ts`**
   - Enhanced to fetch both open and closed PRs
   - Filters closed PRs by date range (configurable)
   - Stores reviewer data in database for caching
   - Returns counts of open vs closed PRs

3. **`src/hooks/useWorkspacePRs.ts`** (New)
   - Custom hook for managing PR data fetching
   - Automatic staleness checking
   - Smart caching with configurable refresh intervals
   - Transforms database data to component format

4. **Database Migration**
   - Adds `reviewer_data` JSONB column for storing reviewer information
   - Adds `last_synced_at` timestamp for staleness tracking
   - Creates indexes for efficient queries

## Usage Example

```typescript
// In your workspace component
import { useWorkspacePRs } from '@/hooks/useWorkspacePRs';

function WorkspacePRs({ repositories, selectedRepositories, workspaceId }) {
  const { 
    pullRequests, 
    loading, 
    error, 
    lastSynced, 
    isStale, 
    refresh 
  } = useWorkspacePRs({
    repositories,
    selectedRepositories,
    workspaceId,
    maxStaleMinutes: 60, // Consider data stale after 1 hour
    refreshInterval: 0,   // No auto-refresh (0 = disabled)
  });

  // Use pullRequests in your charts
  return (
    <>
      {isStale && (
        <Banner>Data is stale. <button onClick={refresh}>Refresh</button></Banner>
      )}
      <PRAuthorStatusChart pullRequests={pullRequests} />
      <ReviewerDistributionChart pullRequests={pullRequests} />
    </>
  );
}
```

## Configuration

### Sync Options
```typescript
{
  includeClosedPRs: true,  // Fetch closed PRs
  maxClosedDays: 30,       // How far back to look for closed PRs
  updateDatabase: true,    // Store results in database
}
```

### Hook Options
```typescript
{
  maxStaleMinutes: 60,     // When to consider data stale
  refreshInterval: 0,      // Auto-refresh interval (0 = disabled)
}
```

## Performance Considerations

1. **API Rate Limits**: The sync function fetches up to 100 open + 100 closed PRs per repository
2. **Database Storage**: Reviewer data is stored as JSONB for efficient querying
3. **Caching**: Data is cached for 60 minutes by default, reducing API calls
4. **Indexing**: Database indexes on `repository_id`, `state`, and `last_synced_at` for fast queries

## Benefits

1. **Efficiency**: Only syncs when needed (page load + stale data)
2. **Completeness**: Includes closed PRs for accurate reviewer distribution
3. **Performance**: Smart caching reduces GitHub API calls
4. **Accuracy**: Real-time data when viewed, not when page is idle
5. **Simplicity**: No background jobs or webhooks to manage

## Migration Steps

1. Run the database migration to add new columns
2. Deploy the updated edge function
3. Update your components to use the new sync pattern
4. Test with repositories that have both open and closed PRs

## Monitoring

Track these metrics to ensure the system is working well:
- Sync frequency per workspace
- Average staleness of data when viewed
- GitHub API rate limit usage
- Database query performance

## Future Enhancements

1. **Differential Sync**: Only fetch PRs updated since last sync
2. **Pagination**: Handle repositories with >100 PRs
3. **Webhook Integration**: Optional real-time updates for critical changes
4. **Configurable Staleness**: Per-workspace staleness thresholds