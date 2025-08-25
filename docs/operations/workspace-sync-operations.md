# Workspace Sync Operations Guide

## Quick Start Deployment

### Prerequisites
- Supabase CLI installed
- GitHub personal access token with `repo` scope
- Access to production Supabase project

### Step 1: Deploy Database Changes

```bash
# If migrations not yet applied
supabase db push

# Or apply specific migrations
supabase migration up 20250125000000_workspace_data_fetching.sql
supabase migration up 20250125000001_add_workspace_tiers.sql
```

### Step 2: Link Existing Workspaces

```bash
# Connect to Supabase SQL editor and run:
supabase db execute --file scripts/link-workspace-repos.sql
```

### Step 3: Deploy Edge Function

```bash
# Deploy the workspace issues sync function
supabase functions deploy workspace-issues-sync

# Verify deployment
supabase functions list
```

### Step 4: Set Environment Variables

```bash
# Set GitHub token if not already configured
supabase secrets set GITHUB_TOKEN=ghp_your_token_here

# Verify secrets
supabase secrets list
```

### Step 5: Test the Deployment

```bash
# Local test
node scripts/test-workspace-issues-sync.js --dry-run

# Trigger manual sync
gh workflow run capture-workspace-issues.yml -f dry_run=true
```

## Daily Operations

### Morning Health Check

```bash
# Check sync status
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as total_workspaces,
  COUNT(*) FILTER (WHERE last_sync_status = 'success') as successful,
  COUNT(*) FILTER (WHERE last_sync_status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_sync_at))/3600)::INT as avg_hours_since_sync
FROM workspace_tracked_repositories
WHERE is_active = TRUE;"

# Check for stuck syncs
psql $DATABASE_URL -c "
SELECT r.full_name, wtr.last_sync_at, wtr.sync_attempts
FROM workspace_tracked_repositories wtr
JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id  
JOIN repositories r ON r.id = tr.repository_id
WHERE wtr.next_sync_at < NOW() - INTERVAL '2 hours'
AND wtr.is_active = TRUE
LIMIT 10;"
```

### Manual Sync Operations

```bash
# Sync specific workspace
curl -X POST \
  "${SUPABASE_URL}/functions/v1/workspace-issues-sync" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "811b5a77-ba90-4057-bc5c-18bc323d0482",
    "hoursBack": 24,
    "dryRun": false
  }'

# Force sync all workspaces
gh workflow run capture-workspace-issues.yml \
  -f hours_back=48 \
  -f limit=50
```

### Troubleshooting Failed Syncs

```bash
# 1. Identify failed syncs
psql $DATABASE_URL -c "
SELECT 
  w.name as workspace,
  r.full_name as repository,
  wtr.last_sync_error,
  wtr.sync_attempts
FROM workspace_tracked_repositories wtr
JOIN workspaces w ON w.id = wtr.workspace_id
JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id
JOIN repositories r ON r.id = tr.repository_id
WHERE wtr.last_sync_status = 'failed'
ORDER BY wtr.sync_attempts DESC;"

# 2. Reset failed sync
psql $DATABASE_URL -c "
UPDATE workspace_tracked_repositories
SET 
  sync_attempts = 0,
  next_sync_at = NOW(),
  last_sync_error = NULL
WHERE workspace_id = 'workspace_uuid'
AND tracked_repository_id = 'tracked_repo_uuid';"

# 3. Trigger immediate retry
gh workflow run capture-workspace-issues.yml \
  -f workspace_id=workspace_uuid \
  -f limit=1
```

## Weekly Maintenance

### 1. Review Sync Performance

```sql
-- Weekly sync statistics
WITH sync_stats AS (
  SELECT 
    DATE_TRUNC('day', last_sync_at) as sync_date,
    COUNT(*) as total_syncs,
    COUNT(*) FILTER (WHERE last_sync_status = 'success') as successful_syncs,
    AVG(total_issues_fetched) as avg_issues_per_sync
  FROM workspace_tracked_repositories
  WHERE last_sync_at > NOW() - INTERVAL '7 days'
  GROUP BY sync_date
)
SELECT * FROM sync_stats ORDER BY sync_date DESC;
```

### 2. Clean Up Stale Data

```sql
-- Remove old cache entries
DELETE FROM workspace_issues_cache
WHERE expires_at < NOW() - INTERVAL '7 days';

-- Archive old daily metrics (optional)
INSERT INTO daily_activity_metrics_archive
SELECT * FROM daily_activity_metrics
WHERE date < NOW() - INTERVAL '90 days';

DELETE FROM daily_activity_metrics
WHERE date < NOW() - INTERVAL '90 days';
```

### 3. Optimize Sync Frequencies

```sql
-- Identify repos that might need frequency adjustment
SELECT 
  r.full_name,
  w.tier,
  wtr.sync_frequency_hours,
  COUNT(i.id) as issues_last_week
FROM workspace_tracked_repositories wtr
JOIN workspaces w ON w.id = wtr.workspace_id
JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id
JOIN repositories r ON r.id = tr.repository_id
LEFT JOIN issues i ON i.repository_id = r.id 
  AND i.created_at > NOW() - INTERVAL '7 days'
GROUP BY r.id, r.full_name, w.tier, wtr.sync_frequency_hours
HAVING COUNT(i.id) > 50 -- High activity
ORDER BY issues_last_week DESC;
```

## Monthly Tasks

### 1. Tier Review

```sql
-- Check workspace usage vs tier limits
SELECT 
  w.name,
  w.tier,
  w.max_repositories,
  w.current_repository_count,
  w.data_retention_days,
  COUNT(wtr.id) as tracked_repos,
  SUM(wtr.total_issues_fetched) as total_issues_synced
FROM workspaces w
LEFT JOIN workspace_tracked_repositories wtr ON w.id = wtr.workspace_id
GROUP BY w.id, w.name, w.tier, w.max_repositories, w.current_repository_count
ORDER BY w.tier DESC, total_issues_synced DESC;
```

### 2. Performance Audit

```bash
# Check Edge Function performance
supabase functions logs workspace-issues-sync --limit 100 | \
  grep "execution_time" | \
  awk '{print $NF}' | \
  sort -n | \
  awk '{
    count[NR] = $1;
    sum += $1
  }
  END {
    print "Min:", count[1];
    print "Max:", count[NR];
    print "Avg:", sum/NR;
    print "P50:", count[int(NR*0.5)];
    print "P95:", count[int(NR*0.95)];
  }'
```

### 3. Cost Analysis

```sql
-- Estimate API calls per workspace
SELECT 
  w.name,
  w.tier,
  COUNT(wtr.id) as repos,
  SUM(24 / wtr.sync_frequency_hours * 30) as estimated_monthly_syncs,
  SUM(24 / wtr.sync_frequency_hours * 30 * 5) as estimated_api_calls
FROM workspaces w
JOIN workspace_tracked_repositories wtr ON w.id = wtr.workspace_id
WHERE wtr.is_active = TRUE
GROUP BY w.id, w.name, w.tier
ORDER BY estimated_api_calls DESC;
```

## Emergency Procedures

### Stop All Syncs

```sql
-- Disable all workspace syncs
UPDATE workspace_tracked_repositories
SET is_active = FALSE
WHERE is_active = TRUE;

-- Disable GitHub Action
gh workflow disable capture-workspace-issues.yml
```

### Rate Limit Emergency

```bash
# 1. Check current rate limit
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# 2. Increase sync intervals temporarily
psql $DATABASE_URL -c "
UPDATE workspace_tracked_repositories
SET sync_frequency_hours = GREATEST(sync_frequency_hours * 2, 48)
WHERE is_active = TRUE;"

# 3. Limit concurrent syncs
psql $DATABASE_URL -c "
UPDATE workspace_tracked_repositories
SET is_active = FALSE
WHERE workspace_id IN (
  SELECT workspace_id 
  FROM workspaces 
  WHERE tier = 'free'
  LIMIT 50
);"
```

### Rollback Procedure

```bash
# 1. Disable syncs
gh workflow disable capture-workspace-issues.yml

# 2. Remove Edge Function
supabase functions delete workspace-issues-sync

# 3. Rollback database (if needed)
psql $DATABASE_URL -c "
-- Disable workspace tracking
UPDATE workspace_tracked_repositories
SET is_active = FALSE;

-- Optional: Drop tables (CAUTION: Data loss)
-- DROP TABLE workspace_tracked_repositories CASCADE;
-- DROP TABLE daily_activity_metrics CASCADE;
-- DROP TABLE workspace_issues_cache CASCADE;"
```

## Monitoring Alerts

### Set Up Alerts (example using cron)

```bash
# Add to crontab
*/30 * * * * /path/to/check-sync-health.sh

# check-sync-health.sh
#!/bin/bash
FAILED_COUNT=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM workspace_tracked_repositories 
  WHERE last_sync_status = 'failed' 
  AND sync_attempts > 3")

if [ $FAILED_COUNT -gt 5 ]; then
  echo "ALERT: $FAILED_COUNT workspace syncs failing" | \
    mail -s "Workspace Sync Alert" ops@example.com
fi
```

## Performance Tuning

### Database Optimization

```sql
-- Analyze tables for query optimization
ANALYZE workspace_tracked_repositories;
ANALYZE daily_activity_metrics;
ANALYZE workspace_issues_cache;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'workspace_tracked_repositories',
  'daily_activity_metrics',
  'workspace_issues_cache'
)
ORDER BY idx_scan DESC;
```

### Edge Function Optimization

```typescript
// Adjust in workspace-issues-sync/index.ts

// Reduce API calls for large syncs
const BATCH_SIZE = 50; // Instead of 100

// Add caching headers
headers: {
  'Cache-Control': 'private, max-age=300',
  'If-None-Match': etag // Use ETags when available
}
```

## Useful Scripts

### Export Sync Metrics

```bash
# Daily metrics export
psql $DATABASE_URL -c "\COPY (
  SELECT 
    w.name as workspace,
    r.full_name as repository,
    wtr.last_sync_at,
    wtr.total_issues_fetched,
    wtr.priority_score
  FROM workspace_tracked_repositories wtr
  JOIN workspaces w ON w.id = wtr.workspace_id
  JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id
  JOIN repositories r ON r.id = tr.repository_id
  WHERE wtr.last_sync_at > NOW() - INTERVAL '24 hours'
) TO '/tmp/sync-metrics-$(date +%Y%m%d).csv' CSV HEADER;"
```

### Bulk Update Sync Settings

```sql
-- Update all Pro workspaces to 8-hour sync
UPDATE workspace_tracked_repositories wtr
SET sync_frequency_hours = 8
FROM workspaces w
WHERE wtr.workspace_id = w.id
AND w.tier = 'pro';

-- Increase retention for active workspaces
UPDATE workspace_tracked_repositories wtr
SET data_retention_days = 60
FROM (
  SELECT workspace_id, SUM(total_issues_fetched) as total
  FROM workspace_tracked_repositories
  GROUP BY workspace_id
  HAVING SUM(total_issues_fetched) > 1000
) active
WHERE wtr.workspace_id = active.workspace_id;
```

## Support Contacts

- **Database Issues**: Check Supabase status page
- **API Rate Limits**: Review GitHub API documentation
- **Edge Function Errors**: Check Supabase function logs
- **Urgent Issues**: Create issue with 'urgent' label in repository