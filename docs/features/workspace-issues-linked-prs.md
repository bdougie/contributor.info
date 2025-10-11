# Workspace Issues - Linked PRs Feature

**Completed:** January 11, 2025
**Issue:** #1074
**Related PR:** #1072 (Infrastructure)

## Overview

The Workspace Issues tab now automatically syncs and displays linked pull requests for each issue using GitHub's GraphQL API. This provides better visibility into issue resolution progress and PR-issue relationships.

## Implementation

### Architecture

The feature uses a custom React hook (`useWorkspaceIssues`) that:

1. **Fetches issues from the database** with cached data
2. **Detects stale data** (older than 60 minutes)
3. **Syncs linked PRs** from GitHub GraphQL API when needed
4. **Auto-refreshes hourly** in the background
5. **Provides manual refresh** via UI button

### Key Components

#### Hook: `src/hooks/useWorkspaceIssues.ts`

- Manages issue data fetching and syncing
- Uses GitHub GraphQL Timeline API to discover linked PRs
- Caches results in `issues.linked_prs` column
- Tracks sync status in `issues.last_synced_at` column
- Pattern mirrors `useWorkspacePRs` for consistency

#### Component: `src/components/features/workspace/WorkspaceIssuesTab.tsx`

- Replaced manual Supabase queries with hook
- Added `WorkspaceAutoSync` component for sync status
- Shows last sync time and manual refresh button
- Toast notifications for errors with retry action

#### Database Schema

```sql
-- Migration: 20250110_add_linked_prs_to_issues.sql
ALTER TABLE issues
  ADD COLUMN linked_prs JSONB,
  ADD COLUMN last_synced_at TIMESTAMPTZ;
```

### Linked PR Detection

The feature detects PRs linked to issues through:

1. **CrossReferencedEvent** - PRs that mention the issue
2. **ConnectedEvent** - PRs explicitly linked (e.g., "fixes #123", "closes #456")

Both types are captured via GitHub's GraphQL Timeline API and stored as:

```typescript
interface LinkedPR {
  number: number;
  url: string;
  state: 'open' | 'closed' | 'merged';
}
```

## User Experience

### Auto-Sync Behavior

- **On mount:** Checks if data is stale, syncs if needed
- **Hourly refresh:** Background sync every 60 minutes
- **Manual refresh:** User can click sync button anytime
- **Sync indicator:** Shows last sync time (e.g., "Synced 5m ago")

### UI Components

```
┌─────────────────────────────────────────────────┐
│ ⟳ Synced 5m ago              [Similarity]      │
├─────────────────────────────────────────────────┤
│ Metrics and Charts                              │
├─────────────────────────────────────────────────┤
│ Issues Table                                    │
│   Issue Title          Linked PRs               │
│   Fix login bug        #123 (merged), #124      │
└─────────────────────────────────────────────────┘
```

## Testing

### Manual Testing Checklist

- [ ] Issues load with linked PRs populated
- [ ] Auto-sync indicator shows last sync time
- [ ] Manual refresh button works
- [ ] Error toast appears if sync fails
- [ ] Retry button in error toast works
- [ ] Hourly auto-refresh happens in background
- [ ] Stale data (>60min) triggers auto-sync

### Test Scenarios

1. **Issues with linked PRs:**
   - Verify PRs appear in table
   - Check PR states (open/closed/merged)

2. **Issues without linked PRs:**
   - Ensure no errors
   - Table cell shows empty state

3. **Multiple PRs per issue:**
   - All linked PRs should be displayed
   - No duplicates

4. **Rate limiting:**
   - Hook handles API rate limits gracefully
   - Falls back to cached data

## Performance Considerations

### Sync Efficiency

- **Incremental sync:** Only syncs open issues to reduce API calls
- **Batch updates:** Updates database in batches
- **Smart caching:** Respects 60-minute cache window
- **Background processing:** Doesn't block UI rendering

### Storage Impact

- Minimal storage overhead (~1KB per issue with linked PRs)
- JSONB column indexed for fast queries
- Old data can be archived if needed

## Configuration

### Hook Options

```typescript
useWorkspaceIssues({
  repositories,
  selectedRepositories,
  workspaceId,
  refreshInterval: 60,      // Minutes between auto-refresh
  maxStaleMinutes: 60,      // Consider data stale after
  autoSyncOnMount: true,    // Sync on component mount
})
```

## Known Limitations

1. **Open issues only:** Only syncs linked PRs for open issues to reduce API calls
2. **Manual linking:** Doesn't detect manual PR links in issue body (only GitHub timeline events)
3. **Rate limits:** Subject to GitHub API rate limits (5000/hour authenticated)

## Future Enhancements

Potential improvements:

- Sync closed issues on-demand
- Parse issue body for manual PR references
- Real-time webhook updates for new linked PRs
- Filter/sort by linked PR status
- Show PR review status in linked PRs

## References

- **Infrastructure PR:** #1072 (Database migration + hook implementation)
- **Integration Issue:** #1074 (Component integration)
- **Pattern Reference:** `WorkspacePRsTab` component
- **Database Schema:** `supabase/migrations/20250110_add_linked_prs_to_issues.sql`
