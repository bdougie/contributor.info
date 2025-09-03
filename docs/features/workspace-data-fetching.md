# Workspace Data Fetching

## Overview

The workspace data fetching feature enables automatic, tier-based data collection for repositories that belong to workspaces. This system provides workspace-scoped GitHub data synchronization with configurable retention policies and sync frequencies based on subscription tiers.

## Architecture

### Core Components

1. **Database Layer**
   - `workspace_tracked_repositories` - Join table linking workspaces to tracked repositories
   - `daily_activity_metrics` - Stores daily aggregated metrics for activity charts
   - `workspace_issues_cache` - Performance cache for workspace-level issue queries
   - `github_events_cache` - Stores star and fork events for activity feeds
   - Tier management system with automatic limit enforcement

2. **Data Fetching Layer**
   - Supabase Edge Functions for long-running operations (50s-150s timeout)
   - GitHub Actions for scheduled and manual triggers
   - Progressive capture queue system for job management

3. **Priority System**
   - Tier-based scoring (Free: +0, Pro: +20, Private: +30)
   - Staleness weighting (>7 days: +20, >3 days: +10)
   - Repository popularity boost (>1000 stars: +10, >100 stars: +5)

## Subscription Tiers

| Tier | Max Repos | Data Retention | Sync Frequency | Priority Boost |
|------|-----------|----------------|----------------|----------------|
| Free | 10 | 30 days | 24 hours | +0 |
| Pro | 50 | 90 days | 12 hours | +20 |
| Private/Enterprise | Unlimited | 365 days | 6 hours | +30 |

## Database Schema

### workspace_tracked_repositories

Links workspaces to tracked repositories with workspace-specific settings:

```sql
CREATE TABLE workspace_tracked_repositories (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    tracked_repository_id UUID REFERENCES tracked_repositories(id),
    
    -- Sync settings
    sync_frequency_hours INTEGER,
    data_retention_days INTEGER,
    
    -- Feature flags
    fetch_issues BOOLEAN,
    fetch_commits BOOLEAN,
    fetch_reviews BOOLEAN,
    fetch_comments BOOLEAN,
    fetch_stars BOOLEAN,
    fetch_forks BOOLEAN,
    
    -- Tracking
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    
    -- Metrics
    priority_score INTEGER,
    total_issues_fetched INTEGER,
    
    UNIQUE(workspace_id, tracked_repository_id)
);
```

### daily_activity_metrics

Stores repository activity metrics for charts and trends:

```sql
CREATE TABLE daily_activity_metrics (
    id UUID PRIMARY KEY,
    repository_id UUID REFERENCES repositories(id),
    date DATE NOT NULL,
    
    -- Commit metrics
    commits_count INTEGER,
    additions INTEGER,
    deletions INTEGER,
    
    -- PR metrics
    prs_opened INTEGER,
    prs_merged INTEGER,
    prs_closed INTEGER,
    
    -- Issue metrics
    issues_opened INTEGER,
    issues_closed INTEGER,
    
    -- Event metrics
    stars_count INTEGER,
    forks_count INTEGER,
    
    UNIQUE(repository_id, date)
);
```

## Edge Functions

### workspace-issues-sync

Fetches issues for workspace repositories with configurable parameters:

**Endpoint:** `POST /functions/v1/workspace-issues-sync`

**Request Body:**
```json
{
  "workspaceId": "uuid",      // Optional - specific workspace
  "hoursBack": 24,             // Time window for issues
  "limit": 10,                 // Max repos to process
  "dryRun": false              // Test mode
}
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 45 issues from 3 repositories",
  "totalApiCalls": 3,
  "results": [
    {
      "repository": "owner/repo",
      "workspace": "My Workspace",
      "tier": "pro",
      "issuesFound": 20,
      "issuesSynced": 20
    }
  ]
}
```

## GitHub Actions

### capture-workspace-issues.yml

Scheduled workflow for automatic issues synchronization:

**Schedule:** Every 6 hours
**Manual Trigger:** Available with custom parameters

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      workspace_id:
        description: 'Workspace ID (optional)'
      hours_back:
        description: 'Hours to look back'
        default: 24
      dry_run:
        description: 'Dry run mode'
        default: false
```

## API Usage

### Queue Manager Integration

The progressive capture queue manager supports workspace-specific jobs:

```typescript
import { queueManager } from '@/lib/progressive-capture/queue-manager';

// Queue issues for all workspaces
const jobsQueued = await queueManager.queueWorkspaceIssues();

// Queue for specific workspace
const jobsQueued = await queueManager.queueWorkspaceIssues(
  workspaceId,
  24 // hours back
);
```

### Direct Edge Function Call

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/workspace-issues-sync`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workspaceId: 'uuid',
      hoursBack: 24,
      limit: 10,
      dryRun: false
    })
  }
);
```

## Testing

### Local Testing

Use the provided test script to validate workspace configuration:

```bash
# Test all workspaces (dry run)
node scripts/test-workspace-issues-sync.js --dry-run

# Test specific workspace
node scripts/test-workspace-issues-sync.js \
  --workspace-id=811b5a77-ba90-4057-bc5c-18bc323d0482 \
  --hours-back=48 \
  --limit=5
```

### Manual Sync Trigger

```bash
# Trigger GitHub Action manually
gh workflow run capture-workspace-issues.yml \
  -f workspace_id=811b5a77-ba90-4057-bc5c-18bc323d0482 \
  -f hours_back=24 \
  -f limit=10 \
  -f dry_run=false
```

## Deployment

### 1. Database Migrations

Apply the required migrations:

```bash
# Phase 1: Infrastructure
supabase migration up 20250125000000_workspace_data_fetching.sql

# Phase 1.5: Tier management
supabase migration up 20250125000001_add_workspace_tiers.sql
```

### 2. Link Existing Repositories

Connect existing workspace repositories to tracking system:

```sql
-- Run scripts/link-workspace-repos.sql
INSERT INTO workspace_tracked_repositories (...)
SELECT ... FROM workspace_repositories ...
```

### 3. Deploy Edge Functions

```bash
# Deploy the issues sync function
supabase functions deploy workspace-issues-sync

# Set required secrets if not already set
supabase secrets set GITHUB_TOKEN=your_token
```

### 4. Enable GitHub Actions

The workflow is automatically active once merged to main. It will run:
- Every 6 hours automatically
- On manual trigger via GitHub UI or CLI

## Monitoring

### Key Metrics

Monitor these metrics for system health:

1. **Sync Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE last_sync_status = 'success') * 100.0 / COUNT(*) as success_rate
   FROM workspace_tracked_repositories
   WHERE last_sync_at > NOW() - INTERVAL '24 hours';
   ```

2. **Average Sync Latency**
   ```sql
   SELECT 
     workspace_id,
     AVG(EXTRACT(EPOCH FROM (NOW() - next_sync_at))) as avg_latency_seconds
   FROM workspace_tracked_repositories
   WHERE fetch_issues = TRUE
   GROUP BY workspace_id;
   ```

3. **API Usage by Workspace**
   ```sql
   SELECT 
     w.name,
     w.tier,
     SUM(wtr.total_issues_fetched) as total_issues,
     COUNT(wtr.id) as repo_count
   FROM workspaces w
   JOIN workspace_tracked_repositories wtr ON w.id = wtr.workspace_id
   GROUP BY w.id, w.name, w.tier
   ORDER BY total_issues DESC;
   ```

### Error Handling

The system includes automatic error recovery:

1. **Failed Syncs**: Tracked in `last_sync_error` with retry counter
2. **Rate Limiting**: Automatic backoff when GitHub limits approached
3. **Timeout Protection**: Edge functions have 50s (free) or 150s (paid) timeout
4. **Failure Notifications**: GitHub issues created for repeated failures

## Troubleshooting

### Common Issues

1. **Sync Not Running**
   - Check `next_sync_at` is in the past
   - Verify `fetch_issues = true`
   - Ensure workspace has active tier

2. **Rate Limit Errors**
   - Reduce sync frequency in `workspace_tracked_repositories`
   - Lower the `limit` parameter in workflows
   - Check GitHub token has sufficient rate limit

3. **Missing Issues**
   - Verify repository has `has_issues = true`
   - Check time window (`hours_back`) is sufficient
   - Ensure GitHub token has repo scope

### Debug Queries

```sql
-- Check sync status
SELECT 
  r.full_name,
  wtr.last_sync_at,
  wtr.last_sync_status,
  wtr.sync_attempts
FROM workspace_tracked_repositories wtr
JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id
JOIN repositories r ON r.id = tr.repository_id
WHERE wtr.last_sync_status = 'failed'
ORDER BY wtr.last_sync_at DESC;

-- View upcoming syncs
SELECT 
  r.full_name,
  w.name as workspace,
  wtr.next_sync_at,
  wtr.priority_score
FROM workspace_tracked_repositories wtr
JOIN workspaces w ON w.id = wtr.workspace_id
JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id
JOIN repositories r ON r.id = tr.repository_id
WHERE wtr.fetch_issues = TRUE
ORDER BY wtr.next_sync_at ASC
LIMIT 10;
```

## Security Considerations

1. **Authentication**: All Edge Functions require valid Supabase auth tokens
2. **Rate Limiting**: Implemented at multiple levels to prevent abuse
3. **Data Isolation**: Workspace data is isolated via foreign key constraints
4. **Audit Trail**: All syncs logged with timestamp and status

## Performance Optimization

1. **Indexes**: 14 strategic indexes for sub-200ms query performance
2. **Caching**: `workspace_issues_cache` reduces repeated calculations
3. **Batch Processing**: Issues fetched in batches of 100 per API call
4. **Priority Queue**: High-priority workspaces sync first

## Future Enhancements (Phase 3+)

- [ ] Commit activity tracking and visualization
- [ ] Real-time webhooks for instant updates
- [ ] Cross-workspace analytics and comparisons
- [ ] Advanced metrics aggregation
- [ ] Historical data backfill on demand
- [ ] Custom sync schedules per workspace

## Related Documentation

- [Workspace Events Activity Feed](/docs/features/workspace-events-activity-feed.md)
- [PRD: Workspace Data Fetching](/tasks/prd-workspace-data-fetching.md)
- [Migration README](/supabase/migrations/README_workspace_data_fetching.md)
- [Issue #508: Workspace Data Requirements](https://github.com/bdougie/contributor.info/issues/508)
- [Issue #457: Supabase Edge Functions Migration](https://github.com/bdougie/contributor.info/issues/457)
- [Issue #657: Display star/fork events](https://github.com/bdougie/contributor.info/issues/657)