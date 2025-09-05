# GitHub Events Cache Integration

This document describes the integration of GitHub events cache data into workspace analytics, providing rich temporal insights beyond static repository metrics.

## Overview

The GitHub events cache integration transforms workspaces from showing only current repository stats (stars, forks) to providing real-time activity analytics with historical trends and velocity metrics.

## Architecture

### Data Flow
```
GitHub Events API → github_events_cache table → Workspace Events Service → React Components
```

### Key Components

1. **Database Layer**
   - `github_events_cache` table (existing, partitioned by date)
   - New SQL functions for workspace event aggregation
   - Optimized indexes for workspace queries

2. **Service Layer**
   - `WorkspaceEventsService` - Main service for event-based metrics
   - `useWorkspaceEvents` hook - React integration
   - `useWorkspaceActivityFeed` hook - Activity feed integration

3. **UI Layer**
   - `WorkspaceEventsMetrics` component - Rich analytics dashboard
   - Event-based metric cards with trends
   - Activity timeline visualization

## Features

### Enhanced Workspace Metrics

**Before (Static):**
- Current star count from `repositories.stargazers_count`
- Current fork count from `repositories.forks_count`
- No temporal data or trends

**After (Event-Driven):**
- Star velocity (stars/day) with weekly/monthly breakdowns
- Fork trends with percentage changes vs previous periods  
- Activity scores and momentum indicators
- Timeline data for charting growth patterns
- Most active repository identification
- Unique contributor tracking

### New Metric Types

1. **Event Trend Metrics**
   ```typescript
   {
     total: 332,           // Total stars in period
     thisWeek: 12,         // Stars this week
     lastWeek: 8,          // Stars last week  
     velocity: 1.2,        // Stars per day average
     trend: 'up',          // Growth direction
     percentChange: 15     // % change vs previous period
   }
   ```

2. **Activity Metrics**
   ```typescript
   {
     totalEvents: 450,     // All events in period
     uniqueActors: 87,     // Unique contributors
     mostActiveRepo: {...}, // Repository with most activity
     activityScore: 85     // Activity momentum score (0-100)
   }
   ```

3. **Timeline Data**
   ```typescript
   [
     {
       date: '2025-09-01',
       stars: 5,
       forks: 2, 
       totalActivity: 12
     },
     // ... daily data points
   ]
   ```

## Database Functions

### `get_workspace_repository_event_summaries`
Returns event summaries for all repositories in a workspace:
- Star and fork events per repository
- Last activity timestamps
- Unique contributor counts

### `get_workspace_event_metrics_aggregated`
Provides aggregated workspace-wide metrics:
- Total events by type (stars, forks, PRs, issues)
- Most active repository identification
- Daily timeline data as JSONB

### `get_workspace_activity_velocity`
Calculates activity velocity and trends:
- Events per day averages
- Growth trend analysis
- Peak activity identification

## Usage Examples

### Basic Integration
```typescript
// Hook usage
const { metrics, loading, error } = useWorkspaceEvents({
  workspaceId: 'uuid',
  timeRange: '30d'
});

// Component usage
<WorkspaceEventsMetrics 
  workspaceId={workspaceId} 
  timeRange="30d" 
/>
```

### Service Usage
```typescript
// Direct service calls
const metrics = await workspaceEventsService.getWorkspaceEventMetrics(
  workspaceId, 
  '30d'
);

const activityFeed = await workspaceEventsService.getWorkspaceActivityFeed(
  workspaceId,
  50
);
```

## Performance Optimizations

### Database Indexes
- `idx_github_events_workspace_lookup` - Composite index for repository + event type + date queries
- `idx_github_events_timeline` - Optimized for timeline aggregations
- Table partitioning by date for efficient historical queries

### Caching Strategy
- Service-level caching with configurable TTL
- React Query integration for client-side caching
- Automatic cache invalidation on workspace changes

## Data Requirements

### Populated Event Types
The integration leverages these event types from `github_events_cache`:

- **WatchEvent** (332 events) - Repository stars
- **ForkEvent** (60 events) - Repository forks  
- **PullRequestEvent** (350 events) - PR activity
- **IssuesEvent** (199 events) - Issue activity
- **PushEvent** (449 events) - Commit activity
- **PullRequestReviewEvent** (321 events) - Code reviews

### Repository Coverage
Current data includes events for high-value repositories:
- facebook/docusaurus: 138 events
- BlueMatthew/WechatExporter: 70 events
- continuedev/continue: 51 events
- excalidraw/excalidraw: 50 events
- anthropics/claude-code: 14 events

## Integration Benefits

### For Users
- **Rich Insights**: See activity momentum, not just current stats
- **Trend Analysis**: Understand growth patterns and contributor engagement
- **Real-time Updates**: Activity feeds show recent workspace events
- **Comparative Metrics**: Period-over-period trend analysis

### For System
- **Efficient Queries**: Optimized for workspace-scale aggregations
- **Scalable Architecture**: Partitioned tables support large datasets
- **Flexible Time Ranges**: Support for 7d, 30d, 90d, 1y periods
- **Extensible Design**: Easy to add new event types and metrics

## Migration Path

### Phase 1: Foundation (Complete)
- ✅ Database functions and indexes
- ✅ Core service implementation
- ✅ React hooks and components

### Phase 2: Enhancement (Future)
- [ ] Activity timeline charts
- [ ] Contributor leaderboards from events
- [ ] Custom time range selection
- [ ] Export capabilities

### Phase 3: Advanced (Future)
- [ ] Predictive analytics
- [ ] Anomaly detection
- [ ] Cross-workspace comparisons
- [ ] Event-driven notifications

## Backward Compatibility

The integration is designed to be non-breaking:
- Existing workspace metrics continue to function
- Event-based metrics are additive enhancements
- Graceful fallback when no event data exists
- Progressive enhancement approach

## Testing

### Sample Queries
```sql
-- Test workspace event aggregation
SELECT * FROM get_workspace_event_metrics_aggregated(
  'workspace-uuid',
  NOW() - INTERVAL '30 days',
  NOW()
);

-- Test repository event summaries  
SELECT * FROM get_workspace_repository_event_summaries(
  'workspace-uuid',
  NOW() - INTERVAL '7 days', 
  NOW()
);
```

### Component Testing
- Unit tests for service methods
- React Testing Library for component behavior
- Integration tests for database functions
- Performance tests for large datasets

## Monitoring

### Key Metrics
- Query performance for workspace aggregations
- Cache hit rates for event data
- User engagement with new metrics
- Data freshness and completeness

### Alerts
- Slow query detection (>5s for workspace aggregations)
- Missing event data for active repositories  
- Service error rates above threshold
- Cache invalidation failures

This integration represents a significant enhancement to workspace analytics, providing users with rich, actionable insights into their repository ecosystems' activity and growth patterns.