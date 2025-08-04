# Data Analysis Scripts

This guide covers the scripts available for testing and improving review/comment data capture in your repositories.

## Overview

Prior to January 2025, the data capture system only processed reviews and comments for the first 10 pull requests during repository sync. This limitation caused the feed's "Reviewed" and "Commented" toggles to show no results for many repositories.

Recent improvements include:
- Increased capture limit from 10 to 50 PRs per sync  
- New diagnostic and backfill scripts for existing repositories
- Better visibility into data coverage

## Available Scripts

### 1. Test Review Sync Script

**Purpose**: Check if a repository has review and comment data

**Location**: `scripts/test-review-sync.mjs`

**Usage**:
```bash
# Basic usage - defaults to continuedev/continue
node scripts/test-review-sync.mjs

# Specify repository
node scripts/test-review-sync.mjs facebook react
node scripts/test-review-sync.mjs microsoft vscode
```

**What it shows**:
- Recent pull requests with review/comment counts
- Repository-wide statistics 
- Data coverage overview

**Example output**:
```
🔍 Testing review/comment sync for facebook/react

Repository found: 12345

Found 10 recent PRs

PR #25123: "Add new component for accessibility features..."
  Reviews: 3, Comments: 8
  Created: 1/15/2025

PR #25122: "Fix memory leak in development mode..."  
  Reviews: 0, Comments: 0
  Created: 1/14/2025

📊 Repository Statistics:
Total PRs: 1247
Total Reviews: 892
Total Comments: 2156
```

### 2. Backfill Reviews/Comments Script

**Purpose**: Capture missing review and comment data for existing PRs

**Location**: `scripts/backfill-reviews-comments.mjs`

**Usage**:
```bash
# Basic usage - processes 50 most recent PRs
node scripts/backfill-reviews-comments.mjs owner repo

# Specify number of PRs to check
node scripts/backfill-reviews-comments.mjs owner repo 100

# Example for popular repositories
node scripts/backfill-reviews-comments.mjs facebook react 75
node scripts/backfill-reviews-comments.mjs microsoft vscode 150
```

**What it does**:
1. Scans recent PRs to find those missing review/comment data
2. Queues Inngest jobs to capture the missing information
3. Shows progress and provides next steps

**Example output**:
```
🔄 Backfilling reviews/comments for facebook/react

Found 23 PRs without reviews/comments (checked 50 most recent PRs)

Sample PRs to be processed:
  PR #25120: "Improve error handling in concurrent mode..."
  PR #25118: "Add tests for new hook behavior..."
  PR #25115: "Update TypeScript definitions..."
  ... and 20 more

✅ Successfully queued 46 capture events

📊 Next steps:
1. Monitor Inngest dashboard for job progress
2. Run test-review-sync.mjs to verify data is being captured  
3. Check the feed page to see reviews/comments appearing
```

## When to Use These Scripts

### Use the Test Script When:
- Feed toggles show no results despite visible activity
- You want to verify data coverage before presenting the repository
- Investigating whether a repository needs backfilling
- Monitoring improvements after running backfill

### Use the Backfill Script When:
- Repository was first synced before January 2025
- Feed "Reviewed" and "Commented" toggles are empty
- You know the repository has review/comment activity but it's not showing up
- Users report missing data in the activity feed

## Required Environment Variables

Both scripts require these environment variables:

```bash
# Required for database access
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for backfill script only (to queue Inngest jobs)
INNGEST_EVENT_KEY=your-inngest-event-key
VITE_API_URL=https://your-app.com/api
```

**Note**: The backfill script will show a warning if `INNGEST_EVENT_KEY` is missing, but will still display what events would be queued.

## Understanding the Results

### Test Script Results

**Healthy repository** - Recent PRs show review/comment activity:
```
PR #123: Reviews: 4, Comments: 12
PR #122: Reviews: 2, Comments: 6  
PR #121: Reviews: 1, Comments: 3
```

**Needs backfilling** - Recent PRs show zero activity:
```
PR #123: Reviews: 0, Comments: 0
PR #122: Reviews: 0, Comments: 0
PR #121: Reviews: 0, Comments: 0
```

### Backfill Script Results

**Ready for backfill** - Found PRs without data:
```
Found 25 PRs without reviews/comments (checked 50 most recent PRs)
✅ Successfully queued 50 capture events
```

**Already complete** - All PRs have data:
```
Found 0 PRs without reviews/comments (checked 50 most recent PRs)
✨ All PRs have review/comment data!
```

## Monitoring Progress

After running the backfill script:

1. **Inngest Dashboard**: Watch jobs process in real-time
2. **Re-run Test Script**: Verify data is being captured
3. **Check Feed Page**: See reviews/comments appearing in toggles
4. **Monitor for Errors**: Check Sentry for any capture failures

## Troubleshooting

### Script Fails to Find Repository
```
Repository not found: owner repo
```
**Solution**: Verify the repository has been synced at least once. Visit the repository page in the app to trigger initial sync.

### No Inngest Events Queued  
```
WARNING: No INNGEST_EVENT_KEY found. Would have sent these events:
```
**Solution**: Set the `INNGEST_EVENT_KEY` environment variable. Check your `.env` file or deployment configuration.

### Backfill Script Times Out
**Solution**: Reduce the limit parameter to process fewer PRs at once:
```bash
# Instead of processing 200 PRs
node scripts/backfill-reviews-comments.mjs owner repo 200

# Process in smaller batches
node scripts/backfill-reviews-comments.mjs owner repo 50
```

### Jobs Queue But No Data Appears
1. Check Inngest dashboard for job failures
2. Verify GitHub API rate limits aren't exceeded
3. Check Sentry for capture errors
4. Ensure repository is public or token has access

## Best Practices

### For Large Repositories
- Start with smaller limits (50-100 PRs) to test 
- Monitor resource usage and job success rates
- Consider running during off-peak hours

### For Multiple Repositories
- Process one repository at a time to avoid overwhelming the queue
- Wait for previous jobs to complete before starting new ones
- Use the test script to prioritize which repositories need attention

### Regular Maintenance
- Run test scripts periodically to check data quality
- New repositories will automatically get better coverage (50 PRs)
- Consider backfilling when users report missing data

## Related Documentation

- [Progressive Data Capture Implementation](./progressive-data-capture-implementation.md) - Technical details
- [Troubleshooting Guide](../troubleshooting/README.md) - General debugging steps
- [Queue Management](./queue-management.md) - Understanding job processing
- [Monitoring Guide](./monitoring-capture-health.md) - System health monitoring