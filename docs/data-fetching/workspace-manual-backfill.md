# Workspace Manual Backfill

## Overview

The workspace manual backfill feature allows users to backfill up to 90 days of GitHub event data (WatchEvent, ForkEvent, etc.) for all repositories in a workspace. This enables accurate star velocity trend metrics by providing sufficient historical data for meaningful period-over-period comparisons.

## Problem Solved

Star velocity metrics require 60+ days of continuous event data to show meaningful trends. Without historical data:
- Velocity trends show "0% vs previous"
- Previous period (30-60 days ago) has no data for comparison
- Metrics dashboard shows incomplete/misleading information

## Architecture

### Components

**1. WorkspaceBackfillManager** (`src/components/features/workspace/WorkspaceBackfillManager.tsx`)
- Primary UI for managing workspace backfills
- Located in workspace settings page
- Features:
  - Table view of all workspace repositories
  - Individual repository status tracking
  - Checkbox selection for batch operations
  - Real-time progress indicators
  - Last backfill timestamp display
  - Overall progress bar

**2. WorkspaceBackfillButton** (`src/components/features/workspace/WorkspaceBackfillButton.tsx`)
- Compact button variant for quick backfills
- Can be used in other workspace contexts
- Features:
  - Single-click backfill trigger
  - Toast notification progress
  - Tooltip status display
  - Last backfill time indicator

### Data Flow

```
User clicks "Backfill Selected"
  → Sequential API calls to /api/backfill/trigger
    → Each repository: POST { repository: "owner/name", days: 90 }
      → gh-datapipe API fetches GitHub events
        → Events stored in github_events_cache table
          → workspace-events.service.ts queries for metrics
            → UI displays velocity trends with % change
```

### Integration Points

1. **Workspace Settings Page** (`src/pages/workspace-page.tsx`)
   - Passes repository data to WorkspaceSettings component
   - Only displayed when repositories exist in workspace

2. **API Endpoint** (`/api/backfill/trigger`)
   - Existing Netlify function at `netlify/functions/backfill-trigger.ts`
   - Validates repository format
   - Triggers gh-datapipe backfill job
   - Returns job status

3. **Database Table** (`github_events_cache`)
   - Stores WatchEvent, ForkEvent, and other GitHub events
   - Queried by `workspace-events.service.ts` for metrics
   - Indexed by repository_owner, repository_name, created_at

## Usage

### Accessing the Feature

1. Navigate to workspace page: `/i/{workspace-slug}`
2. Click "Settings" tab
3. Scroll to "Workspace Event Backfill" section
4. Select repositories to backfill
5. Click "Backfill Selected (N)" button

### Backfill Process

**Sequential Processing:**
- Repositories are processed one at a time
- 1-second delay between requests to avoid rate limits
- Progress toast every 3 repositories
- Overall progress bar shows completion percentage

**Status Tracking:**
- **Pending**: Not yet started
- **Processing**: Currently backfilling
- **Completed**: Successfully backfilled ✓
- **Failed**: Error occurred (see error message)

**Local Storage:**
- Last backfill time stored per repository
- Key format: `backfill-{workspaceId}-{repoFullName}`
- Persists across sessions for status display

### Monitoring Results

**Velocity Metrics Update:**
After backfill completes, velocity metrics in workspace dashboard will show:
- Accurate daily star/fork velocity
- Meaningful trend percentages (e.g., "+15% vs previous 30 days")
- Timeline charts with 90 days of data

**Verification:**
```sql
-- Check event data coverage for a repository
SELECT
  DATE(created_at) as date,
  event_type,
  COUNT(*) as event_count
FROM github_events_cache
WHERE repository_owner = 'owner'
  AND repository_name = 'repo'
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC;
```

## Configuration

### Environment Variables

Required for backfill to function:
```bash
GH_DATPIPE_API_URL=https://gh-datapipe.fly.dev  # or custom URL
GH_DATPIPE_KEY=your-api-key
```

### Backfill Parameters

**Days to Backfill:**
- Default: 90 days
- Configurable in API request
- Limited by GitHub API availability (max ~90 days)

**Rate Limiting:**
- 1-second delay between repositories
- Sequential processing (not parallel)
- Respects gh-datapipe rate limits

## Error Handling

### Common Errors

**1. "Service unavailable"**
- Cause: GH_DATPIPE_KEY not configured
- Solution: Set environment variable in Netlify dashboard

**2. "Failed to trigger backfill"**
- Cause: gh-datapipe API error or rate limit
- Solution: Check gh-datapipe logs, retry later

**3. "Repository not found"**
- Cause: Invalid repository format
- Solution: Verify owner/name format is correct

### Error Recovery

- Failed repositories shown with red error badge
- Error message displayed in table
- Other repositories continue processing
- Can retry failed repositories individually

## Best Practices

### When to Backfill

**Initial Setup:**
- Run backfill when first adding repositories to workspace
- Ensures full historical context from day 1

**After Data Gaps:**
- If event collection was interrupted
- After system maintenance or downtime
- When metrics show 0% trends

**Regular Maintenance:**
- Not required for ongoing data collection
- Auto-sync handles current events
- Backfill only needed for historical gaps

### Performance Tips

1. **Batch Processing**: Select multiple repositories at once
2. **Off-Peak Hours**: Run during low-traffic periods
3. **Monitor Progress**: Check table status for failed repos
4. **Verify Results**: Check workspace metrics after completion

## Related Features

### Workspace Event Metrics

Located in: `src/services/workspace-events.service.ts`

Metrics calculated from event data:
- Star velocity (events per day)
- Fork velocity (events per day)
- Trend percentages (current vs previous period)
- Activity scores
- Timeline data for charts

### Manual Repository Sync

See: [Manual Repository Tracking](./manual-repository-tracking.md)

Difference from backfill:
- **Manual Sync**: Updates current PR/issue/contributor data
- **Backfill**: Retrieves historical event data for metrics

## Implementation Details

### Component Props

**WorkspaceBackfillManager:**
```typescript
interface WorkspaceBackfillManagerProps {
  workspaceId: string;
  repositories: Repository[];
}

interface Repository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  stargazers_count: number;
  forks_count: number;
}
```

**WorkspaceBackfillButton:**
```typescript
interface WorkspaceBackfillButtonProps {
  workspaceId: string;
  repositories: Array<{
    owner: string;
    name: string;
    full_name: string;
  }>;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}
```

### State Management

**Repository Status:**
```typescript
interface RepositoryBackfillStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  lastBackfillDate?: string;
}
```

**Overall Progress:**
- Calculated as: `(completed / total) * 100`
- Updates after each repository completes
- Displayed in progress bar above table

## Future Enhancements

### Planned Features

1. **Scheduled Backfills**
   - Automatic weekly/monthly backfills
   - Configurable schedule per workspace
   - Background processing without UI interaction

2. **Event Coverage Dashboard**
   - Visualize data coverage gaps
   - Highlight repositories needing backfill
   - Coverage percentage indicators

3. **Selective Event Types**
   - Option to backfill specific event types
   - Custom date ranges (not just 90 days)
   - Filter by event importance

4. **Parallel Processing**
   - Process multiple repositories simultaneously
   - Configurable concurrency limits
   - Improved performance for large workspaces

5. **Progress Notifications**
   - Email notifications on completion
   - Slack/Discord webhook integration
   - Real-time progress via WebSocket

## Related Documentation

- [Workspace Priority System](./workspace-priority-system.md) - Workspace data sync priorities
- [Progressive Backfill Implementation](./progressive-backfill-implementation.md) - Automatic backfill system
- [Smart Data Fetching](./smart-data-fetching.md) - Overall data fetching architecture
- [Manual Repository Tracking](./manual-repository-tracking.md) - Manual sync feature
- [GitHub Actions Workflows](./github-actions-workflows.md) - Background processing

## Troubleshooting

### Issue: Backfill completes but metrics still show 0%

**Diagnosis:**
1. Check event data exists:
   ```sql
   SELECT COUNT(*) FROM github_events_cache
   WHERE repository_owner = 'owner' AND repository_name = 'name'
   AND created_at >= NOW() - INTERVAL '90 days';
   ```

2. Verify workspace-events.service.ts query includes repository
3. Check browser console for errors
4. Hard refresh page (Cmd/Ctrl + Shift + R)

**Solution:**
- Ensure repository is linked to workspace in `workspace_repositories` table
- Verify event data has correct repository_owner/repository_name format
- Check that workspace ID matches in both tables

### Issue: Backfill stuck in "Processing" state

**Diagnosis:**
1. Check browser network tab for failed requests
2. Look for API errors in Netlify function logs
3. Verify gh-datapipe API is responding

**Solution:**
- Refresh page and check if status updates
- Retry backfill for stuck repository
- Check localStorage for stale status (clear if needed)

### Issue: No repositories shown in backfill table

**Diagnosis:**
- Workspace has no repositories added
- Repository data not passed to settings component

**Solution:**
- Add repositories to workspace first
- Verify workspace-page.tsx passes `repositories` prop to WorkspaceSettings
- Check workspace_repositories table for entries
