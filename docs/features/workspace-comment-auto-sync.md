# Workspace Comment Auto-Sync

## Overview

Automatic comment synchronization for the My Work Replies tab, ensuring users always see fresh comment data without manual intervention. This feature addresses GitHub issue #1131 (stale comment data) through a combination of on-demand auto-sync and scheduled background maintenance.

## Architecture

### Components

```
User opens Replies tab
        ↓
MyWorkCard detects staleness (>1 hour)
        ↓
Auto-triggers syncWorkspaceComments()
        ↓
Queues Inngest events per repository
        ↓
capture/repository.comments.all handler
        ↓
Finds recent PRs/issues (last 30 days)
        ↓
Queues individual comment capture jobs
        ↓
capture/pr.comments & capture/issue.comments
        ↓
Fetches from GitHub API & updates database
        ↓
UI refreshes with fresh data (3s delay)
```

### Background Maintenance

```
Cron: Every 4 hours (0 */4 * * *)
        ↓
syncWorkspaceCommentsCron
        ↓
Finds active workspace repositories
        ↓
Queues low-priority sync events
        ↓
Keeps data fresh during work hours
```

## Implementation Details

### Staleness Detection

**Threshold**: 1 hour
**Location**: `src/lib/workspace/comment-sync-service.ts:checkCommentStaleness()`

Logic:
1. Query `sync_logs` table for most recent `repository_comments_all` sync
2. Filter by workspace repositories
3. Calculate hours since last sync
4. Return `isStale: true` if >1 hour old

```typescript
const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
return {
  isStale: hoursSinceSync > 1,
  lastSyncedAt: lastSync,
};
```

**Rationale**: 1 hour balances data freshness with API rate limit preservation. Most active discussions see updates within this window.

### Auto-Sync Trigger

**Location**: `src/components/features/workspace/MyWorkCard.tsx:114-127`

Conditions for auto-sync:
- User switches to `issueTab === 'replies'`
- `!hasAutoSynced` (prevents multiple triggers)
- `commentSyncStatus?.isStale` (data is >1 hour old)
- `!isSyncingComments` (no sync already in progress)

```typescript
useEffect(() => {
  const shouldAutoSync =
    issueTab === 'replies' &&
    !hasAutoSynced &&
    onSyncComments &&
    commentSyncStatus?.isStale &&
    !isSyncingComments;

  if (shouldAutoSync) {
    setHasAutoSynced(true);
    onSyncComments();
  }
}, [issueTab, hasAutoSynced, onSyncComments, commentSyncStatus, isSyncingComments]);
```

**Reset**: `hasAutoSynced` resets when user navigates away from Replies tab, allowing fresh auto-sync on return.

### Event Orchestration

**Parent Job**: `capture-repository-comments-all`
- **Location**: `src/lib/inngest/functions/capture-repository-comments-all.ts`
- **Event**: `capture/repository.comments.all`
- **Purpose**: Find recent PRs/issues and queue individual comment capture jobs

**Steps**:
1. Get repository details from Supabase
2. Find recent PRs (last N days, limit 100)
3. Queue `capture/pr.comments` events for each PR
4. Find recent issues (last N days, limit 100)
5. Queue `capture/issue.comments` events for each issue
6. Log sync completion to `sync_logs`

**Configuration**:
- Concurrency: 2 per repository (prevents overwhelming API)
- Retries: 2 attempts
- Throttle: 20 events per minute
- Time range: 30 days for user-triggered, 7 days for cron

**Child Jobs**:
- `capture/pr.comments` - Fetches comments for single PR
- `capture/issue.comments` - Fetches comments for single issue

### Cron Schedule

**Frequency**: Every 4 hours (`0 */4 * * *`)
**Location**: `src/lib/inngest/functions/sync-workspace-comments-cron.ts`

**Rationale**:
- Ensures 2-3 updates during typical work day (8am-6pm)
- User requested change from 6 hours for better coverage
- Low-priority events don't compete with user actions

**Strategy**:
- Targets repositories in active workspaces (has members)
- Filters to repositories updated in last 30 days
- Deduplicates repos across multiple workspaces
- Syncs last 7 days of comments (shorter window than user-triggered)

```typescript
{ cron: '0 */4 * * *' }, // Runs at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
```

### User Feedback

**Visual Indicators**:
- **Stale (>1 hour)**: Orange badge with AlertCircle icon
- **Fresh (≤1 hour)**: Emerald badge with CheckCircle icon
- **Timestamp**: "Last synced X minutes/hours ago"

**Toast Notifications**:
- Triggers when sync completes while on Replies tab
- Message: "Comments synced - Latest comments have been fetched from GitHub"
- Duration: 3 seconds
- Location: `src/components/features/workspace/MyWorkCard.tsx:129-143`

## Database Schema

### sync_logs Table

Tracks all sync operations for monitoring and staleness detection.

**Key columns**:
- `sync_type`: 'repository_comments_all'
- `entity_id`: Repository ID
- `status`: 'success' | 'in_progress' | 'failed'
- `started_at`: Sync start timestamp
- `completed_at`: Sync completion timestamp
- `metadata`: JSON with PR/issue counts, jobs queued

**Queries used**:
```sql
-- Check staleness
SELECT completed_at, sync_type
FROM sync_logs
WHERE sync_type IN ('pr_comments', 'issue_comments')
  AND repository_id IN (SELECT repository_id FROM workspace_repositories WHERE workspace_id = $1)
  AND status = 'completed'
ORDER BY completed_at DESC
LIMIT 1;

-- Find active syncs
SELECT id, sync_type, started_at
FROM sync_logs
WHERE sync_type IN ('pr_comments', 'issue_comments')
  AND repository_id IN (SELECT repository_id FROM workspace_repositories WHERE workspace_id = $1)
  AND status = 'running'
LIMIT 1;
```

## Performance Characteristics

### API Rate Limits

**GitHub API**: 5,000 requests/hour (authenticated)

**Estimated usage per repository sync**:
- 1 request: Get repository details
- 1 request: List recent PRs
- 1 request: List recent issues
- N requests: PR comments (1 per PR)
- M requests: Issue comments (1 per issue)

**Example**: Repository with 20 recent PRs and 15 recent issues = ~38 API calls

**Mitigation**:
- 100-item limits prevent runaway API usage
- Throttling: 20 events/minute
- Low-priority background jobs
- Concurrency limits: 2 per repository

### User Experience

**Auto-sync latency**:
- Staleness check: <100ms (database query)
- Event queuing: <500ms (Inngest API call)
- Full sync completion: 30-60 seconds (depends on comment volume)
- UI refresh: +3 seconds (allows backend to finish)

**Total time from tab open to fresh data**: ~35-65 seconds

## Testing

### Manual Testing

1. **Verify staleness detection**:
   ```typescript
   // In browser console
   const status = await checkCommentStaleness(workspaceId);
   console.log(status); // { isStale: true, lastSyncedAt: Date }
   ```

2. **Trigger manual sync**:
   - Open My Work page
   - Switch to Replies tab
   - Observe auto-sync trigger (if data >1 hour old)
   - Verify toast notification appears
   - Check staleness indicator changes to "Up to date"

3. **Verify cron execution**:
   - Check Inngest dashboard at scheduled times (00:00, 04:00, etc.)
   - Verify events queued for workspace repositories
   - Monitor `sync_logs` table for completion

### Database Verification

```sql
-- Check recent sync logs
SELECT
  sync_type,
  entity_id,
  status,
  started_at,
  completed_at,
  metadata
FROM sync_logs
WHERE sync_type = 'repository_comments_all'
ORDER BY started_at DESC
LIMIT 10;

-- Check comment freshness
SELECT
  pr.number,
  pr.title,
  COUNT(c.id) as comment_count,
  MAX(c.created_at) as latest_comment
FROM pull_requests pr
LEFT JOIN comments c ON c.pull_request_id = pr.id
WHERE pr.repository_id = 'REPO_ID'
GROUP BY pr.id, pr.number, pr.title
ORDER BY latest_comment DESC;
```

## Monitoring

### Key Metrics

1. **Sync Success Rate**: % of `repository_comments_all` syncs with status='success'
2. **Average Sync Duration**: Time from `started_at` to `completed_at`
3. **API Calls per Sync**: From `metadata.github_api_calls_used`
4. **Jobs Queued per Sync**: From `metadata.totalJobsQueued`

### Alerts

Consider alerting on:
- Sync success rate <95% over 24 hours
- Average sync duration >5 minutes
- No successful syncs in last 6 hours (cron may be failing)

## Future Enhancements

### Potential Improvements

1. **Adaptive Cron Frequency**: Increase frequency for highly active workspaces
2. **Selective Sync**: Only sync repositories with recent activity
3. **Incremental Updates**: Use GitHub's `since` parameter to fetch only new comments
4. **WebSocket Updates**: Real-time comment updates via GitHub webhooks
5. **User Preferences**: Allow users to configure auto-sync behavior

### Known Limitations

1. **Initial Load Delay**: First-time workspace users may wait 35-65 seconds for data
2. **Large Repositories**: Repos with >100 recent PRs/issues only sync most recent 100
3. **API Rate Limits**: Heavy usage could hit rate limits (mitigated by throttling)
4. **Stale Edge Cases**: Comments posted <1 hour ago might not trigger sync immediately

## Troubleshooting

### Issue: Auto-sync not triggering

**Check**:
1. Verify `commentSyncStatus.isStale === true` in React DevTools
2. Check browser console for errors in staleness check
3. Verify `sync_logs` table has recent entries for workspace repositories
4. Ensure `onSyncComments` prop is passed through component hierarchy

### Issue: Sync completes but data not updating

**Check**:
1. Verify 3-second delay passes before refresh
2. Check `sync_logs` for error messages in metadata
3. Verify GitHub API rate limit not exceeded
4. Check Inngest dashboard for failed child jobs

### Issue: Cron not running

**Check**:
1. Verify Inngest function deployed: `npm run inngest:deploy`
2. Check Inngest dashboard for cron execution history
3. Verify `syncWorkspaceCommentsCron` exported in `functions/index.ts`
4. Check system time matches cron schedule (UTC)

## Related Files

- `src/lib/workspace/comment-sync-service.ts` - Core sync logic
- `src/hooks/use-my-work.ts` - React hook integration
- `src/components/features/workspace/MyWorkCard.tsx` - UI component
- `src/lib/inngest/functions/capture-repository-comments-all.ts` - Event handler
- `src/lib/inngest/functions/sync-workspace-comments-cron.ts` - Cron job
- `src/lib/inngest/functions/capture-pr-comments.ts` - PR comment capture
- `src/lib/inngest/functions/capture-issue-comments.ts` - Issue comment capture

## References

- GitHub Issue: #1131 (stale comment data in Replies tab)
- Inngest Documentation: https://www.inngest.com/docs
- GitHub API Rate Limits: https://docs.github.com/en/rest/rate-limit
