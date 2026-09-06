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

#### 1. **Refresh Client and Edge Function**

- `src/lib/workspace/github-issue-refresh.ts` (browser): asks the backend for a
  refresh, overlays the returned rows on the saved rows, and turns per-repository
  outcomes into readable messages. It performs no database writes.
- `supabase/functions/workspace-issues-refresh` (backend): verifies the user JWT
  and workspace membership, fetches recent issues from GitHub server-side, stores
  them with the service role, and returns the fresh rows plus a per-repository
  status (`refreshed`, `fetched_not_stored`, `failed` with stage and cause).

The browser cannot upsert issue metadata: RLS reserves that for the service role.

#### 2. **Enhanced Hook** (`src/hooks/useWorkspaceIssues.ts`)

Updated `useWorkspaceIssues` hook now:
- Calls the refresh function, displays whatever came back, then syncs linked PRs
  for repositories whose rows were stored
- Exposes `syncError` (repositories that failed; saved rows shown), `syncWarning`
  (rows shown live but not saved), `lastSynced` (data confirmed current), and
  `lastRefreshAttempt` (a refresh was tried)
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
Browser (useWorkspaceIssues)
  ↓ supabase.functions.invoke (user JWT + GitHub token)
Edge function workspace-issues-refresh
  ↓ membership check → GitHub API → service-role upsert
Per-repository results + fresh rows
  ↓ mergeRefreshedIssues (saved rows kept for failures)
Hook State Update (setIssues, syncError, syncWarning, lastSynced)
  ↓
Component Re-render (WorkspaceIssuesTab)
```

## How It Works

### Scenario: User Assigns Themselves to an Issue

1. **On GitHub**: User clicks "Assign" on issue #42 in `owner/repo`
2. **User Switches to App**: Returns to workspace issues tab
3. **Visibility Detection**: Browser's `visibilitychange` fires
4. **Staleness Check**: Hook checks if data is >5 minutes old
5. **Auto-Sync Triggered**: Calls `requestWorkspaceIssuesRefresh`
6. **Backend Fetch**: The edge function fetches fresh issue data including assignees
7. **Database Update**: The function upserts the issue with the service role and returns it
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
| `assignees` | JSONB | edge function (service role) |
| `labels` | JSONB | edge function (service role) |
| `comments_count` | INT | edge function (service role) |
| `last_synced_at` | TIMESTAMP | edge function (service role) |

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

Outcomes are reported per repository; one failure never hides the others.

- **No GitHub authorization / expired session**: banner asks to sign in again; saved rows stay
- **Not a workspace member**: banner with the membership message
- **Repository not found (404)**: reported as a failure for that repository, never as an empty result
- **Rate limit (403/429)**: reported with the reset time
- **Issues disabled (410)**: reported for that repository
- **Database write rejected**: live GitHub rows are shown with a warning that they were not saved
- **Refresh service unreachable**: banner says so; saved rows stay
- **Saved rows cannot be loaded**: error card with retry

"Data refreshed" (from the hook's `lastSynced`) only advances when every
repository was fresh. "Refresh requested" in `WorkspaceAutoSync` is a separate
queue timestamp and does not claim the displayed data is current.

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
- **Workspace Auto-Sync**: `workspace-sync` edge function; a membership-checked request that marks `workspace_tracked_repositories.next_sync_at` due for the capture queue
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
