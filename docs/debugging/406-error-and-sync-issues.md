# Debugging 406 Errors and Repository Sync Issues

## Overview

This document explains the 406 "Not Acceptable" error that can occur when querying repositories with no pull requests, and provides solutions for syncing repository data.

## The 406 Error

### Root Cause

The 406 error occurs when using Supabase's `.single()` method on queries that return no results. This commonly happens when:

1. A repository has no pull requests
2. A repository has never been synced
3. A table is empty for a specific filter

### The Fix

The fix involves removing `.single()` from queries that might return empty results and instead handling arrays:

```typescript
// ❌ Bad - causes 406 error when no results
const { data, error } = await supabase
  .from('pull_requests')
  .select('created_at')
  .eq('repository_id', repoId)
  .limit(1)
  .single(); // This throws 406 when no PRs exist

// ✅ Good - handles empty results gracefully  
const { data, error } = await supabase
  .from('pull_requests')
  .select('created_at')
  .eq('repository_id', repoId)
  .limit(1); // Returns empty array when no PRs exist

// Check if we have data
if (data && data.length > 0) {
  const firstItem = data[0];
}
```

### Files Fixed

- `/src/hooks/use-repository-metadata.ts` - Fixed query for latest PR created_at

## Repository Sync Issues

### Why Repositories Aren't Syncing

1. **No automatic sync on repository creation** - When a repository is added to the tracked list, it's not automatically synced
2. **Sync workflows need manual triggering** - The scheduled workflows run periodically but may not have been triggered
3. **Missing initial data** - Repositories need an initial sync to populate PR data

### Manual Sync Solutions

**Note: The original manual sync scripts have been removed after system improvements. For manual syncing, use the Supabase dashboard or create new sync scripts as needed.**

#### Previous Scripts (Now Removed)

The following scripts were previously available but have been removed:
- `scripts/manual-sync-repository.js` - For syncing a single repository
- `scripts/sync-all-tracked-repos.js` - For syncing all tracked repositories
- `scripts/sync-bdougie-repos.js` - For direct GitHub data sync

These scripts are no longer needed as the automatic sync system has been significantly improved.

### Automated Sync Methods

#### 1. Progressive Capture System

The app uses a progressive capture system that automatically detects and fixes missing data:

- **Smart Notifications** - Detects missing data on page load
- **Background Processing** - Queues sync jobs automatically
- **Hybrid Queue Manager** - Routes jobs to Inngest or GitHub Actions

#### 2. GitHub Actions Workflows

Trigger the scheduled sync workflow manually:
```bash
gh workflow run scheduled-data-sync.yml \
  -f sync_type=full-sync \
  -f repository_filter=owner/repo
```

#### 3. Browser-Based Sync

From the browser console at https://contributor.info:
```javascript
// Analyze data gaps
await window.ProgressiveCaptureTrigger.analyze()

// Queue missing data for sync
await window.ProgressiveCaptureTrigger.bootstrap()

// Check sync status
await window.ProgressiveCaptureTrigger.status()
```

## Monitoring Sync Progress

### 1. Check Sync Logs

```sql
SELECT * FROM sync_logs 
WHERE repository_id = 'your-repo-id'
ORDER BY started_at DESC;
```

### 2. Check Queue Status

```sql
SELECT status, COUNT(*) 
FROM progressive_capture_queue 
GROUP BY status;
```

### 3. Monitor Inngest Dashboard

Visit the Inngest dashboard to see real-time job processing status.

## Best Practices

1. **Always handle empty results** - Never assume a query will return data
2. **Use array queries for lists** - Only use `.single()` when you're certain one row exists
3. **Monitor sync health** - Check sync logs regularly
4. **Enable tracking properly** - Ensure repositories have `tracking_enabled = true`

## Troubleshooting

### Repository Not Syncing

1. Check if repository exists in database
2. Verify `tracking_enabled = true` in `tracked_repositories`
3. Check for sync errors in `sync_logs`
4. Manually trigger sync using scripts above

### 406 Errors Still Occurring

1. Search for other `.single()` usage: `grep -r "\.single()" src/`
2. Check browser console for specific query causing error
3. Update query to handle empty results

### Rate Limiting

If you encounter GitHub API rate limits:
1. Reduce batch size in sync scripts
2. Increase delay between batches
3. Use authenticated requests with GitHub token