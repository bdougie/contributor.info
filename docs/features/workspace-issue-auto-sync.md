# Workspace Issue Auto-Sync Feature

## Overview

The Workspace Issue Auto-Sync feature provides real-time updates of workspace issue data, particularly focusing on assignee changes. When users assign themselves to issues on GitHub, those changes are automatically detected and reflected in the workspace issues tab without requiring manual refresh.

## Problem Statement

Previously, workspace issue assignments were only synced on:
- Manual user refresh (click button)
- 60-minute automatic refresh cycle
- Initial page load

This meant that users who assigned themselves to issues on GitHub would not see the updated assignment for up to 60 minutes in the workspace dashboard.

## Solution Architecture

### Core Components

#### 1. **Issue Data Sync Function** (`src/lib/sync-workspace-issues.ts`)

Fetches fresh issue data from GitHub REST API:
- Retrieves assignee information
- Updates labels and metadata
- Captures comment counts
- Handles pagination for large repositories
- Rate limit aware (respects GitHub API limits)

```typescript
// Key function: syncWorkspaceIssuesForRepositories
// - Syncs multiple repos in parallel
// - Updates database with latest data
// - Logs success/failure for monitoring
```

#### 2. **Enhanced Hook** (`src/hooks/useWorkspaceIssues.ts`)

Updated `useWorkspaceIssues` hook now:
- Calls issue sync function before linked PR sync
- Maintains staleness checking (60 min default)
- Provides manual refresh capability
- Supports auto-sync on mount and intervals

#### 3. **Visibility Change Detection** (`src/components/features/workspace/WorkspaceIssuesTab.tsx`)

Detects when user returns to workspace tab:
- Triggers automatic sync if data is >5 minutes old
- Uses browser's `visibilitychange` event
- Logs refresh events for debugging
- Doesn't interrupt user experience

### Data Flow

```
GitHub
  ↓
GitHub API (fetchIssuesFromGitHub)
  ↓
Database Update (Supabase upsert)
  ↓
Hook State Update (setIssues)
  ↓
Component Re-render (WorkspaceIssuesTab)
```

## How It Works

### Scenario: User Assigns Themselves to an Issue

1. **On GitHub**: User clicks "Assign" on issue #42 in `owner/repo`
2. **User Switches to App**: Returns to workspace issues tab
3. **Visibility Detection**: Browser's `visibilitychange` fires
4. **Staleness Check**: Hook checks if data is >5 minutes old
5. **Auto-Sync Triggered**: Calls `syncWorkspaceIssuesForRepositories`
6. **GitHub API Call**: Fetches fresh issue data including assignees
7. **Database Update**: Upserts issue with new assignee
8. **UI Update**: Component re-renders showing user in assignees list

### Alternative Flows

**Manual Refresh**:
- User clicks refresh button → Manual refresh triggered → Same flow as above

**Auto-Sync on Mount**:
- Component mounts → Checks staleness → Syncs if needed

**Periodic Refresh**:
- Default 60-minute interval → Runs in background

## Configuration

### In `WorkspaceIssuesTab.tsx`

```typescript
const { issues, loading, error, lastSynced, isStale, refresh } = useWorkspaceIssues({
  repositories,
  selectedRepositories,
  workspaceId,
  refreshInterval: 60,        // Hourly refresh (minutes)
  maxStaleMinutes: 60,        // Data stale after 60 min
  autoSyncOnMount: true,      // Auto-sync if stale on mount
});
```

### Visibility Check Threshold

In `WorkspaceIssuesTab.tsx` visibility effect:
```typescript
if (timeSinceLastSync > 5) {  // 5 minutes
  refresh();
}
```

Adjust this threshold to be more/less aggressive.

## Database Schema

Issues updated in `public.issues` table:

| Field | Type | Updated By |
|-------|------|-----------|
| `assignees` | JSONB | sync function |
| `labels` | JSONB | sync function |
| `comments_count` | INT | sync function |
| `last_synced_at` | TIMESTAMP | sync function |

## Performance Considerations

### Optimizations

- **Database-first**: Cached data loads immediately, sync happens in background
- **Batch operations**: Multiple repos synced in parallel with `Promise.allSettled`
- **Pagination**: Only fetches last 30 days of issues to reduce API calls
- **Rate limiting**: Respects GitHub API rate limits (60 calls/hour for OAuth)

### API Call Budget

Per workspace per hour:
- Initial load: ~1 call (list issues)
- Auto-sync on visibility: ~1 call (if away >5 min)
- 60-min interval: ~1 call
- **Total**: ~2-3 API calls/hour per workspace

For a 500-issue repo:
- Pagination: ~5 API calls (100 issues per page)
- Total monthly: ~150-200 API calls (well within GitHub limits)

## Error Handling

### Graceful Degradation

- **No GitHub token**: Warns user, uses cached data
- **API rate limit**: Waits for rate limit reset, retries
- **Network error**: Continues with cached data, logs error
- **Database error**: Shows error toast, suggests retry

### Monitoring

Enable debug logs with:
```typescript
console.log('[WorkspaceIssuesTab] Refreshing stale issue data...');
console.log('[workspace-sync] Syncing issues for owner/repo');
```

## Testing

### Manual Testing

1. **Assign yourself to issue on GitHub**
   - Go to GitHub issue
   - Click "Assign" and select yourself

2. **Return to workspace tab**
   - Switch tabs or wait for visibility change
   - Should see yourself in assignees within 5 seconds

3. **Check console logs**
   - Look for refresh logs
   - Verify sync completion

### Edge Cases

- [ ] Assign/unassign while on tab (manual refresh needed)
- [ ] Return to tab after >1 hour (triggered by interval)
- [ ] Assign to issue not in workspace (doesn't affect display)
- [ ] Network offline during sync (falls back to cached data)

## Related Features

- **PR Tab**: Uses similar pattern for PR reviewer/author updates
- **Workspace Auto-Sync**: Generic sync endpoint that marks repos for sync
- **Progressive Data Capture**: Background sync strategy

## Future Enhancements

### Potential Improvements

1. **WebSocket Real-Time Updates**: Replace polling with live WebSocket
2. **Partial Sync**: Only sync changed issues instead of full list
3. **User Preferences**: Allow configurable sync intervals per workspace
4. **Selective Syncing**: Only sync assigned-to-me issues
5. **Conflict Resolution**: Handle concurrent updates better

### Deprecation Strategy

If moving to WebSocket:
1. Keep polling as fallback
2. Graceful degradation if WebSocket unavailable
3. Monitor metrics during transition
4. Remove polling after 1-2 release cycles

## Debugging

### Common Issues

**Issue updates not appearing**:
- Check console for error logs
- Verify GitHub token is valid
- Check GitHub API rate limits
- Manual refresh to force sync

**Performance issues**:
- Check number of issues being synced
- Reduce sync frequency if high volume
- Monitor browser memory usage

**Excessive API calls**:
- Increase `maxStaleMinutes` threshold
- Reduce `refreshInterval`
- Check for duplicate refresh triggers

## References

- [Database-First Smart Fetching](../data-fetching/database-first-smart-fetching.md)
- [PR Reviewer Sync](../data-fetching/README.md)
- [Workspace Priority System](../data-fetching/workspace-priority-system.md)
