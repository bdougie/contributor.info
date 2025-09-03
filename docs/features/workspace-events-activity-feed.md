# Workspace Events Activity Feed

## Overview

The workspace events activity feed provides a unified view of all repository activities across a workspace, matching the behavior and features of the individual repository view. This feature was implemented in PR #659 to ensure consistency between workspace and repository-level activity displays.

## Design Decisions

### 1. Unified Activity Model

The workspace activity feed follows the same patterns as the repository view to ensure a consistent user experience:

- **Event Types**: Pull Requests, Issues, Reviews, Comments, Stars, and Forks
- **Data Sources**: Combines data from multiple tables (`pull_requests`, `issues`, `github_events_cache`)
- **Visual Consistency**: Same colors, icons, and layouts as repository view
- **Performance**: Optimized queries with database-level filtering

### 2. Event Types and Sources

| Event Type | Source Table | Color | Icon | Status Field |
|------------|--------------|-------|------|--------------|
| Pull Request | `pull_requests` | Blue | GitPullRequest | ✓ (open/merged/closed) |
| Issue | `issues` | Yellow | AlertCircle | ✓ (open/closed) |
| Review | `pull_request_reviews` | Purple | MessageSquare | ✓ (approved/changes_requested) |
| Comment | `pull_request_comments` | Cyan | MessageSquare | ✓ (open) |
| Star | `github_events_cache` | Amber | Star | ✗ (no status) |
| Fork | `github_events_cache` | White | GitFork | ✗ (no status) |

### 3. Star and Fork Events Implementation

Stars and forks are fetched from the `github_events_cache` table as individual events:

```typescript
// Query structure for star/fork events
const { data: starEvents } = await supabase
  .from('github_events_cache')
  .select('*')
  .eq('event_type', 'WatchEvent') // GitHub uses WatchEvent for stars
  .eq('repository_owner', owner)
  .eq('repository_name', name)
  .order('created_at', { ascending: false })
  .limit(50);
```

**Key Implementation Details:**
- GitHub's API uses `WatchEvent` for star events (historical naming)
- Fork events use `ForkEvent` type
- Events are queried per repository to ensure proper filtering
- Limit applied after filtering to prevent missing events

### 4. Type Safety Improvements

The `ActivityItem` interface was refined to better represent different event types:

```typescript
interface ActivityItem {
  id: string;
  type: 'pr' | 'issue' | 'commit' | 'review' | 'comment' | 'star' | 'fork';
  title: string;
  author: {
    username: string;
    avatar_url: string;
  };
  repository: string;
  created_at: string;
  // Status is optional - only for PRs, issues, and reviews
  status?: 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';
  url: string;
  metadata?: {
    additions?: number;
    deletions?: number;
    change_amount?: number;
  };
}
```

**Rationale**: Star and fork events don't have traditional "status" states like PRs or issues, so the status field is now optional.

### 5. Activity Trend Chart

The activity trend chart displays all event types with distinct colors:

```typescript
datasets: [
  { label: 'Pull Requests', color: '#10b981' }, // Green
  { label: 'Issues', color: '#f97316' },        // Orange
  { label: 'Reviews', color: '#8b5cf6' },       // Purple
  { label: 'Comments', color: '#06b6d4' },      // Cyan
  { label: 'Stars', color: '#fbbf24' },         // Yellow
  { label: 'Forks', color: '#ffffff' },         // White (for contrast)
]
```

**Design Choice**: Fork events use white color to distinguish them clearly from other event types, especially in dark mode.

### 6. Avatar URL Handling

Robust fallback handling for user avatars:

```typescript
actor_avatar:
  payload?.actor?.avatar_url || 
  (event.actor_login 
    ? `https://avatars.githubusercontent.com/${event.actor_login}` 
    : getFallbackAvatar())
```

**Fallback Chain:**
1. Use avatar URL from event payload if available
2. Construct GitHub avatar URL if actor_login exists
3. Use generic fallback avatar for missing data

## Performance Considerations

### Database Query Optimization

- **Per-Repository Queries**: Each repository is queried individually to ensure proper filtering
- **Database-Level Filtering**: Filtering happens at the database level, not client-side
- **Limit Application**: Limits apply after filtering to prevent missing relevant events
- **Index Usage**: Queries utilize existing indexes on `event_type`, `repository_owner`, and `repository_name`

### Caching Strategy

Currently, events are fetched fresh on each page load. Future improvements (Phase 2) will include:
- Client-side caching with React Query or SWR
- Incremental updates instead of full refetches
- Cache invalidation based on data freshness

## Data Flow

1. **Workspace Page Load**
   - Fetch workspace repositories
   - Query each repository for its events
   - Combine and sort all events

2. **Event Processing**
   - Transform raw database records into ActivityItem format
   - Apply type-specific formatting (titles, URLs, avatars)
   - Sort by creation date (newest first)

3. **Display**
   - ActivityTable component renders the unified feed
   - TrendChart shows aggregated daily metrics
   - Real-time updates via optimistic UI patterns

## Future Improvements

### Phase 2: Pagination and Caching (#660)
- Implement pagination for large datasets
- Add defensive payload validation
- Develop comprehensive caching strategies

### Phase 3: Advanced Features (#661)
- Rate limiting and retry logic
- Granular error boundaries
- Lazy loading and virtual scrolling
- WebSocket support for real-time updates

## API Compatibility

The workspace events system is designed to work seamlessly with the upcoming gh-datapipe enhancements (issue #71) which will provide:
- 90 days of historical star/fork data
- Bulk event fetching capabilities
- Improved rate limit handling

## Testing Considerations

### Unit Tests
- Type safety validation for ActivityItem
- Avatar URL fallback chain testing
- Event transformation logic

### Integration Tests
- Database query performance
- Multi-repository event aggregation
- Sort order and filtering

### E2E Tests
- Activity feed rendering
- Chart visualization
- User interactions (filtering, sorting)

## Migration Notes

For existing workspaces:
1. Star and fork events will appear as data becomes available
2. Historical events depend on `github_events_cache` population
3. No migration required for existing workspace data

## Related Documentation

- [Workspace Data Fetching](/docs/features/workspace-data-fetching.md)
- [PR #659: Add star and fork events](https://github.com/bdougie/contributor.info/pull/659)
- [Issue #657: Display star/fork events](https://github.com/bdougie/contributor.info/issues/657)
- [gh-datapipe Issue #71](https://github.com/open-source-ready/gh-datapipe/issues/71)