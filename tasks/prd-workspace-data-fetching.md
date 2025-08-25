# PRD: Workspace-Specific Data Fetching

## Project Overview

### Objective
Implement comprehensive data fetching for workspace-associated repositories, enabling full workspace features including issues tracking, activity metrics, and repository metadata enrichment.

### Background
The workspace UI is implemented but currently displays mock data for several features. We need to fetch and store real data for issues, commit activity, and repository metadata, but only for repositories that belong to workspaces to avoid unnecessary API calls and storage costs.

### Success Metrics
- 100% of workspace repositories have issues data within 24 hours of being added
- Activity charts display real commit data instead of mock data
- Repository avatars are visible in contributor statistics
- Data fetching respects GitHub API rate limits
- Storage costs remain manageable through workspace-scoped fetching

## Current State Analysis

### What Exists
✅ Complete workspace database schema (workspaces, workspace_repositories, workspace_members)
✅ Issues table with full schema already created
✅ Progressive capture system with queue management
✅ GitHub Actions for PR data fetching using GraphQL
✅ Inngest functions for background processing
✅ tracked_repositories table for monitoring repos

### What's Missing
❌ No connection between workspaces and tracked_repositories
❌ Issues data not being fetched
❌ Repository avatars/logos not populated
❌ Commit activity data not stored (using mock data)
❌ No workspace-scoped data fetching limits
❌ Missing metrics aggregation for workspaces

### Technical Debt
- Multiple Inngest function files with overlapping functionality
- No shared base class for GitHub data fetchers
- Inconsistent error handling across data capture functions

## Implementation Plan

### Phase 1: Database Infrastructure (HIGH PRIORITY)

#### 1.1 Create workspace_tracked_repositories join table
```sql
CREATE TABLE workspace_tracked_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tracked_repository_id UUID NOT NULL REFERENCES tracked_repositories(id) ON DELETE CASCADE,
    
    -- Workspace-specific settings
    sync_frequency_hours INTEGER DEFAULT 24,
    data_retention_days INTEGER DEFAULT 30,
    fetch_issues BOOLEAN DEFAULT TRUE,
    fetch_commits BOOLEAN DEFAULT TRUE,
    fetch_reviews BOOLEAN DEFAULT TRUE,
    
    -- Tracking
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by UUID NOT NULL, -- References auth.users(id)
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    
    -- Ensure unique pairing
    CONSTRAINT unique_workspace_tracked_repo UNIQUE (workspace_id, tracked_repository_id)
);
```

**Why a join table instead of adding workspace_id to tracked_repositories?**
1. **Many-to-many relationships**: One repository can be tracked by multiple workspaces
2. **Workspace-specific settings**: Different workspaces may want different sync frequencies
3. **Clean separation**: Tracked repos remain independent of workspace concept
4. **Performance**: Avoids nullable columns and complex WHERE clauses

#### 1.2 Create daily_activity_metrics table
```sql
CREATE TABLE daily_activity_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Metrics
    commits_count INTEGER DEFAULT 0,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    
    -- PR metrics
    prs_opened INTEGER DEFAULT 0,
    prs_merged INTEGER DEFAULT 0,
    prs_closed INTEGER DEFAULT 0,
    
    -- Issue metrics
    issues_opened INTEGER DEFAULT 0,
    issues_closed INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_repo_date UNIQUE (repository_id, date)
);
```

### Phase 2: Issues Data Capture (HIGH PRIORITY)

#### 2.1 Inngest Function for Issues
Create `capture-workspace-issues` function that:
- Fetches issues created/updated in last 24 hours
- Only processes repositories in workspace_tracked_repositories
- Uses GraphQL for efficient data fetching
- Stores in existing issues table

```typescript
// Key logic for workspace-scoped fetching
const workspaceRepos = await supabase
  .from('workspace_tracked_repositories')
  .select('tracked_repository_id, workspace_id')
  .gte('next_sync_at', new Date().toISOString())
  .where('fetch_issues', true);
```

#### 2.2 GitHub Action Workflow
Create `capture-issues-graphql.yml`:
- Triggered by Inngest or manually
- Accepts workspace_id parameter
- Batches API calls efficiently
- Updates last_sync_at in workspace_tracked_repositories

### Phase 3: Metrics Aggregation (MEDIUM PRIORITY)

#### 3.1 Supabase Edge Functions

**calculate-workspace-metrics**
- Runs hourly for active workspaces
- Aggregates data from pull_requests, issues, contributors
- Stores in workspace_metrics_cache
- Calculates trends and velocities

**calculate-repository-trends**
- Runs daily at 12:46 AM UTC
- Populates daily_activity_metrics
- Calculates moving averages
- Identifies anomalies

### Phase 4: Refactoring & Optimization (LOW PRIORITY)

#### 4.1 Consolidate Inngest Functions
- Merge 6 separate Inngest function files into 2-3 organized files
- Create shared utilities for common patterns
- Standardize error handling

#### 4.2 Create Base GitHub Fetcher Class
```typescript
abstract class GitHubDataFetcher {
  protected graphqlClient: GraphQLClient;
  protected rateLimiter: RateLimiter;
  
  abstract fetchData(): Promise<void>;
  abstract storeData(): Promise<void>;
  
  protected handleRateLimit() { /* shared logic */ }
  protected handleError() { /* shared logic */ }
}
```

## Technical Guidelines

### API Rate Limiting Strategy
1. Use GraphQL whenever possible (more efficient)
2. Implement exponential backoff
3. Reserve 1000 API calls as buffer
4. Priority queue based on workspace tier

### Data Retention Policy
- Free tier: 30 days
- Pro tier: 90 days
- Enterprise: 365 days
- Automatic cleanup via scheduled jobs

### Performance Considerations

#### Why Redis is NOT needed (yet):

**Current Caching Strategy is Sufficient:**
1. **Database caching**: workspace_metrics_cache table already provides persistence
2. **Query performance**: Proper indexes make direct queries fast enough
3. **Data freshness**: 1-hour cache TTL is acceptable for workspace metrics
4. **Complexity**: Adding Redis increases operational overhead

**When Redis WOULD be needed:**
- If we have >1000 concurrent workspace users
- If metrics queries take >500ms with indexes
- If we need sub-second response times
- If we implement real-time features

**Current approach instead:**
```typescript
// Use in-memory cache for hot paths (no Redis needed)
class WorkspaceMetricsCache {
  private cache = new Map<string, { data: any, expires: Date }>();
  
  async get(workspaceId: string) {
    // Check memory first
    const cached = this.cache.get(workspaceId);
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }
    
    // Fall back to database
    return this.fetchFromDatabase(workspaceId);
  }
}
```

### Progressive Capture Integration
1. Add 'issues' type to DataCaptureJob
2. Priority scoring based on:
   - Workspace tier (enterprise > pro > free)
   - Data staleness (older = higher priority)
   - Repository activity (more active = higher priority)

## Implementation Status

### Phase 1: Database Infrastructure ✅ COMPLETED

**Migration Created**: `20250125000000_workspace_data_fetching.sql`

**Tables Created:**
1. ✅ `workspace_tracked_repositories` - Join table with full sync tracking
2. ✅ `daily_activity_metrics` - Daily aggregated metrics storage
3. ✅ `workspace_issues_cache` - Performance cache for workspace issue queries

**Indexes Added:**
- ✅ 5 indexes on workspace_tracked_repositories for optimal query patterns
- ✅ 4 indexes on daily_activity_metrics including partial indexes
- ✅ 3 indexes on workspace_issues_cache for cache lookups
- ✅ 2 indexes on repositories for new metadata fields

**Functions Created:**
- ✅ `calculate_workspace_repo_priority()` - Dynamic priority scoring
- ✅ `get_workspace_repos_for_sync()` - Efficient sync queue retrieval
- ✅ `update_workspace_sync_status()` - Sync status management

**Key Implementation Decisions:**
1. **Priority Scoring Algorithm**: Based on workspace tier (30/20/0 points), data staleness (up to 20 points), and repository popularity (up to 10 points)
2. **Sync Frequency**: Configurable per workspace-repo pair (1-168 hours)
3. **Data Retention**: Configurable per workspace-repo pair (7-365 days)
4. **Cache TTL**: 1 hour for workspace_issues_cache (configurable)

## Acceptance Criteria

### Phase 1 ✅ Criteria
- [x] workspace_tracked_repositories table created and indexed
- [x] daily_activity_metrics table created
- [x] workspace_issues_cache table created
- [x] Repository metadata columns added
- [x] Priority scoring functions implemented
- [x] Proper indexes for all query patterns
- [ ] Migration runs successfully in production

### Phase 2 ✅ Criteria
- [ ] Issues fetched for all workspace repositories
- [ ] Issues appear in workspace UI Issues tab
- [ ] Last 24 hours of issues captured daily
- [ ] Rate limits respected (no 429 errors)

### Phase 3 ✅ Criteria
- [ ] Activity charts show real data
- [ ] Workspace metrics calculated hourly
- [ ] Cache hit rate >80%
- [ ] Query performance <200ms p95

### Phase 4 ✅ Criteria
- [ ] Inngest functions consolidated from 6 to 3 files
- [ ] Shared error handling implemented
- [ ] Code coverage >80% for new code

## Risk Mitigation

### Risk: GitHub API Rate Limits
- **Mitigation**: Implement aggressive caching, use GraphQL, workspace-scoped fetching

### Risk: Storage Costs
- **Mitigation**: Data retention policies, compression, workspace-scoped limits

### Risk: Performance Degradation
- **Mitigation**: Proper indexes, materialized views for complex queries, monitoring

## Timeline

- **Week 1**: Phase 1 (Database) + Phase 2.1 (Issues Inngest)
- **Week 2**: Phase 2.2 (GitHub Action) + Phase 3 (Metrics)
- **Week 3**: Phase 4 (Refactoring) + Testing + Deployment

## Open Questions

1. Should we implement historical backfill for issues or only forward-looking?
2. What's the maximum number of repositories per workspace we should support?
3. Should workspace owners be able to configure sync frequency?

## Appendix: Why Not Redis?

### Current Scale Analysis
- ~100 active workspaces expected in first 6 months
- ~10-50 repositories per workspace average
- ~1000 queries per hour peak expected
- PostgreSQL can handle this with proper indexes

### When to Reconsider Redis
Monitor these metrics monthly:
- Average query time for workspace_metrics >200ms
- Memory cache hit rate <50%
- Concurrent workspace users >500
- Database CPU consistently >70%

If 2+ metrics exceed thresholds for 2 consecutive months, implement Redis.

### Cost Comparison
- **Current (PostgreSQL only)**: ~$50/month
- **With Redis**: +$25-100/month for managed Redis
- **Break-even point**: ~5000 active workspace users

The pragmatic approach is to defer Redis until actually needed, keeping the architecture simple and costs low initially.