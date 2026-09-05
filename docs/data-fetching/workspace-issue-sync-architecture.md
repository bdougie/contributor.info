# Workspace Issue Sync Architecture

## System Design Overview

The Workspace Issue Sync system implements a **database-first, visibility-aware polling strategy** for maintaining fresh issue data in the workspace dashboard.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     WorkspaceIssuesTab                          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ useWorkspaceIssues Hook                                │   │
│  │ - checkStaleness()                                     │   │
│  │ - fetchFromDatabase()                                  │   │
│  │ - fetchIssues()                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────┐       │
│  │                                                     │       │
│  ▼                                                     ▼       │
│ Visibility Event                            Manual Refresh    │
│ (page shows)                                 (user clicks)    │
│                                                                │
│ ┌─────────────────────────────────────┐                      │
│ │ if data > 5 min old                 │                      │
│ │   trigger refresh()                 │                      │
│ └─────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │ github-issue-refresh.ts         │
        │ (browser client, no DB writes)  │
        │                                 │
        │ requestWorkspaceIssuesRefresh() │
        │ ├─ supabase.functions.invoke    │
        │ │  (user JWT + GitHub token)    │
        │ mergeRefreshedIssues()          │
        │ summarizeIssueRefresh()         │
        └─────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────┐
        │ workspace-issues-refresh         │
        │ (Supabase edge function)         │
        │ ├─ Verify user JWT               │
        │ ├─ Verify workspace membership   │
        │ ├─ Fetch GitHub (server-side)    │
        │ ├─ Upsert issues (service role)  │
        │ └─ Return rows + per-repo status │
        └──────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────┐
        │   GitHub API                     │
        │   /repos/{owner}/{repo}/issues   │
        │   (since=30d, up to 5 pages)     │
        └──────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────┐
        │   Supabase Database              │
        │   - Issues table                 │
        │   - Updated assignees JSONB      │
        │   - last_synced_at timestamp     │
        └──────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────┐
        │   transformIssue()               │
        │   - Map DB format to UI format   │
        │   - Merge related data           │
        └──────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────┐
        │   Component State                │
        │   setIssues(transformedIssues)   │
        │   Re-render with new data        │
        └──────────────────────────────────┘
```

## Component Interaction

### 1. Hook Layer (`useWorkspaceIssues`)

**Responsibilities**:
- Manage issue data state
- Check staleness of cached data
- Orchestrate sync operations
- Provide refresh function

**Key Methods**:

```typescript
checkStaleness(repoIds): { needsSync, oldestSync }
  - Query database for last_synced_at
  - Compare with maxStaleMinutes threshold
  - Return staleness status

fetchFromDatabase(repoIds): DBIssue[]
  - Fetch all issues from cache
  - Join with repositories, contributors
  - Return immediately (no network delay)

fetchIssues(forceRefresh, skipSync)
  - Load from cache first
  - Conditionally sync with GitHub
  - Update component state
  - Handle errors

refresh(): Promise<void>
  - Trigger forced sync
  - Bypass staleness check
  - Called by UI refresh button
```

### 2. Refresh Layer (`src/lib/workspace/github-issue-refresh.ts` + `supabase/functions/workspace-issues-refresh`)

**Why a backend step**: RLS on `public.issues` only lets the service role insert or
update issue metadata; signed-in users may only change `responded_by` /
`responded_at`. A browser-side upsert therefore fails for every repository. The
browser never writes issue metadata.

**Browser client responsibilities**:
- Call the edge function with the user's Supabase JWT (sent by the SDK) and the
  GitHub `provider_token` so private repositories the user can see are readable.
- Overlay the returned rows on the saved rows (`mergeRefreshedIssues`), keeping
  `responded_*`, linked PRs, and database ids from the saved copy. Repositories
  that failed keep their saved rows. Saved rows older than the refresh window stay.
- Turn per-repository outcomes into two messages (`summarizeIssueRefresh`):
  `syncError` for repositories that failed (saved rows shown) and `syncWarning`
  for rows shown live that could not be saved.

**Edge function responsibilities**:
- Reject callers who are not accepted members of the workspace, and repository
  ids that are not in `workspace_repositories` for that workspace.
- Fetch GitHub itself; it never accepts client-supplied issue rows.
- Upsert authors into `contributors` and issues into `issues` with the service
  role, then record the outcome on `workspace_tracked_repositories`.
- Return HTTP 200 with a per-repository `status`:
  - `refreshed`: fetched and stored (an empty 30-day window still counts).
  - `fetched_not_stored`: GitHub read succeeded, the database write failed; rows
    are still returned for display.
  - `failed`: nothing usable; `stage` is `authorization`, `github`, or `database`
    and `error` is a readable cause (401, rate limit with `retryAt`, 403, 404, 410,
    5xx, timeout).

### 3. UI Layer (`WorkspaceIssuesTab`)

**Responsibilities**:
- Render issue data
- Handle user interactions
- Monitor page visibility
- Display loading/error states

**Key Features**:

```typescript
useWorkspaceIssues Hook
  - Loads initial data
  - Sets up refresh interval
  - Provides manual refresh

Visibility Listener
  - Detects page becoming visible
  - Triggers auto-sync if stale
  - Logs refresh events

Error Handling
  - Shows toast for sync errors
  - Provides retry button
  - Falls back to cached data
```

## Data Flow Sequences

### Sequence 1: Normal Load → Auto-Refresh

```
1. Mount Component
   └─> useWorkspaceIssues()
       ├─> checkStaleness() → needs sync (never synced)
       ├─> requestWorkspaceIssuesRefresh()
       │   └─> GitHub API → Database ✓
       └─> fetchFromDatabase() → Hook State

2. User Switches Tabs (visibility change)
   └─> visibilitychange listener fires
       ├─> Check if data > 5 min old
       ├─> refresh() → fetchIssues(forceRefresh=true)
       │   └─> GitHub API → Database ✓
       └─> Component re-renders with new data
```

### Sequence 2: Manual Refresh

```
1. User Clicks Refresh Button
   └─> refresh() called
       └─> fetchIssues(forceRefresh=true)
           ├─> Bypass staleness check
           ├─> requestWorkspaceIssuesRefresh()
           │   └─> GitHub API → Database ✓
           └─> Update component state

2. Component Updates
   └─> lastSynced timestamp updates
   └─> UI shows refreshed data
```

### Sequence 3: Periodic Refresh

```
1. Component Mounts
   └─> setupInterval(refreshInterval=60 min)

2. Every 60 Minutes (if page visible)
   └─> performSync()
       └─> Same as Manual Refresh flow
```

## Error Handling Strategy

Every outcome is reported per repository, and the tab shows the cause. A failed
repository never blanks the others.

| Situation | Where it is detected | What the user sees |
|-----------|----------------------|--------------------|
| Not signed in / expired Supabase session | Edge function returns 401 | `syncError` asks to sign in again; saved rows stay |
| Not a workspace member | Edge function returns 403 | `syncError` with the membership message |
| GitHub 401 for the provider token | Function, `stage: github` | Repository listed with "sign in with GitHub again" |
| GitHub rate limit (403/429, remaining 0) | Function, `retryAt` set | Repository listed with the reset time |
| Repository private/renamed/deleted (404) | Function, `stage: github` | Repository listed as not found; **not** treated as empty |
| Issues disabled (410) | Function, `stage: github` | Repository listed as issues disabled |
| Database write rejected | Function, `status: fetched_not_stored` | Live rows shown, `syncWarning` says they were not saved |
| Refresh service unreachable | Browser client | `syncError` "Could not reach the refresh service" |
| Saved rows cannot be loaded | Hook `error` | Tab replaced by an error card with retry |

`lastSynced` only advances to the refresh time when every requested repository
was fresh. Otherwise it reflects the oldest saved data via `summarizeFreshness`.
`lastRefreshAttempt` records that a refresh was tried regardless of outcome.

## Performance Optimizations

### 1. Database-First Approach

**Benefit**: Instant UI update with cached data
**Trade-off**: May show stale data temporarily
**Mitigated by**: Background sync updates UI when fresh data arrives

```
Timeline:
0ms   - Database query returns cached data
50ms  - UI renders with cached data
100ms - GitHub API call starts in background
500ms - GitHub response received
600ms - Database updated
650ms - Component re-renders with fresh data
```

### 2. Parallel Repo Syncing

**Benefit**: Multiple repos synced simultaneously
**Implementation**: `Promise.allSettled()` on array of sync calls
**Scalability**: Can handle 10+ repos without blocking

```
Sequential (old):  Repo A (500ms) + Repo B (500ms) = 1000ms
Parallel (new):    Max(Repo A, Repo B) = 500ms
Improvement:       50% faster
```

### 3. Time-Window Pagination

**Benefit**: Reduces API calls for active repos
**Implementation**:
- Fetch issues in pages of 100
- Continue pagination until issues older than 30 days are found
- Stop fetching once oldest issue is >30 days old

**Trade-off**: Misses issues older than 30 days (acceptable for workspace focus on current activity)

**Typical Results**:
- Repos with <500 recent issues: ~1-5 API calls (first full sync)
- Repos with 500-2000 recent issues: ~5-20 API calls (first full sync)
- Repos with 2000+ recent issues: ~20+ API calls (first full sync)
- **Subsequent syncs**: ~1-2 API calls (only fetches new issues)

```
Example: Active repo with 2000 issues in last 30 days
- Page 1: 100 issues (all within 30 days)
- Page 2: 100 issues (all within 30 days)
- ...continue until...
- Page 20: 100 issues, oldest is from 31 days ago → STOP
- Total: ~20 API calls for first full sync
- Subsequent syncs only fetch new issues: ~1-2 API calls
```

### 4. Selective Syncing

**Benefit**: Only sync if data is stale
**Implementation**: `checkStaleness()` before `fetchIssues()`
**Efficiency**: Skips unnecessary syncs when recently updated

## Rate Limiting Strategy

### GitHub API Limits (OAuth)

- **Rate**: 5,000 requests/hour per token
- **Per Repo**: ~3 requests for issue fetch (pagination, last 30 days only)
- **Allocation**: 50 repos × 2 syncs/hour = 300 requests/hour (6% of limit)
- **Safety**: Well under limit with room for other API calls

### Current Implementation

The current implementation does **NOT** actively manage rate limits:

- ❌ No automatic retry for 429 responses
- ✅ Rate limit headers read server-side (`x-ratelimit-remaining`, `Retry-After`)
- ❌ No backoff strategy

**Behavior on 429 / exhausted 403**:
- The edge function marks that repository `failed` with `stage: github` and `retryAt`
- Other repositories in the same request still refresh
- The banner names the repository and the reset time
- Next sync attempts after configured interval (default: 60 min)

### Future Enhancement

Implement proactive rate limit handling:

```typescript
// Track rate limit headers from response
const remaining = response.headers['x-ratelimit-remaining'];
const resetTime = new Date(response.headers['x-ratelimit-reset'] * 1000);

// Strategy 1: Back off if approaching limit
if (remaining < 100) {
  console.warn('Approaching rate limit, backing off');
  // Increase next sync interval by 50%
  // Skip this sync cycle
}

// Strategy 2: Exponential backoff on 429
const delay = calculateExponentialBackoff(attempt);
await sleep(delay);
retry(syncFunction);
```

## Scalability Considerations

### Current Capacity

| Metric | Value | Impact |
|--------|-------|--------|
| Repos per workspace | ~50 | 2-3 API calls/hour |
| Issues per repo | 1000+ | Paginated, ~3 pages/sync |
| Sync frequency | 60 min | 1 sync/hour + visibility |
| Concurrent workspaces | 100+ | 300 API calls/hour total |

### Bottlenecks

1. **GitHub API Calls**: Currently ~2% of limit, can scale to 500+ workspaces
2. **Database Write Throughput**: Supabase handles easily
3. **Browser Memory**: Limited by browser, not backend

### Future Scaling Options

1. **Reduce sync frequency**: Increase from 60→120 min for less active repos
2. **WebSocket real-time**: Replace polling with live updates
3. **Batch syncing**: Combine multiple repos into single endpoint
4. **Cache strategy**: Store more data client-side to reduce queries

## Testing Strategy

### Unit Tests

```typescript
// Test sync function
- fetchIssuesFromGitHub parses correctly
- Per-repository outcomes come back from the edge function
- Rate limiting logic works

// Test hook
- checkStaleness calculates correctly
- fetchFromDatabase returns correct format
- refresh triggers sync appropriately
```

### Integration Tests

```
// Test visibility detection
- Mounting tab triggers sync
- Visibility change triggers sync
- Correct delay before sync

// Test data persistence
- Updated assignees saved to DB
- UI reflects updated data
- Stale data marked correctly
```

### E2E Tests

```
// Full workflow
1. Create issue on GitHub with assignee
2. Open workspace tab
3. Verify assignee appears within 5s
4. Verify no excessive API calls
5. Verify no performance degradation
```

## Monitoring & Observability

### Key Metrics

```typescript
// Track in analytics
- Sync frequency (how often syncs trigger)
- Sync duration (how long each sync takes)
- Sync success rate (% that complete without error)
- Data freshness (how old is cached data)
- User refresh clicks (manual vs auto)
```

### Debug Logging

```typescript
console.log('[workspace-sync] Syncing issues for owner/repo');
console.log('[workspace-sync] Successfully synced N issues');
console.log('[WorkspaceIssuesTab] Refreshing stale issue data');
console.log('[WorkspaceIssuesTab] Data freshness: N minutes old');
```

### Error Tracking

```typescript
// Sentry/error tracking
- API rate limit errors
- Database write failures
- Network timeouts
- Token expiration
```

## Security Considerations

### GitHub Token Safety

- ✓ Token stored in Supabase auth session
- ✓ Only used in authenticated context
- ✓ Not exposed in logs or analytics
- ✓ Expires with user session

### Data Privacy

- ✓ Only fetches public issue data
- ✓ Respects GitHub repository visibility
- ✓ Database RLS prevents cross-workspace access
- ✓ No sensitive data stored

### Rate Limit Abuse

- ✗ No per-user rate limiting (same for all users)
- ✓ Mitigated by GitHub API rate limits
- ⚠ Monitor for abuse patterns

## Related Systems

- **PR Reviewer Sync**: Similar pattern, different data
- **Progressive Data Capture**: Background sync infrastructure
- **Workspace Auto-Sync**: Generic sync endpoint
- **Database-First Smart Fetching**: Caching strategy

## References

- [GitHub REST API - Issues](https://docs.github.com/en/rest/issues/issues)
- [Database-First Smart Fetching](./database-first-smart-fetching.md)
- [Workspace Priority System](./workspace-priority-system.md)
- [Progressive Data Capture](./progressive-data-capture-implementation.md)
