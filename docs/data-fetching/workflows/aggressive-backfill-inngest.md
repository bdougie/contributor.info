# Aggressive Backfill Workflows with Inngest

## Overview

This document covers how to trigger aggressive backfill operations for repository data using Inngest event triggers. These workflows are useful for populating missing data, regenerating embeddings, or syncing large batches of historical information.

## Available Backfill Operations

### 1. Repository Sync Backfill
Syncs pull requests, issues, and contributor data for specific repositories.

### 2. Embeddings Backfill
Generates or regenerates embeddings for PRs and issues to enable similarity search and AI-powered features.

### 3. Workspace Aggregation
Recomputes workspace-level metrics after syncing repositories.

## Triggering Manual Backfills

### Quick Trigger Prompt

Use this prompt with Claude Code to trigger a comprehensive backfill:

```
Trigger aggressive backfill for the following repositories:
- continuedev/continue
- vercel/ai
- bdougie/contributor.info

Include:
1. Repository sync (PRs, issues, contributors)
2. Embeddings generation for all synced items
3. Workspace aggregation after sync completes

Show me the Inngest job IDs and provide a way to monitor progress.
```

### Customizing the Backfill

You can customize the prompt with these options:

**For specific repositories:**
```
Trigger repository sync for only: continuedev/continue
```

**For embeddings only:**
```
Trigger embeddings generation for all PRs and issues without embeddings in workspace [workspace-id]
Priority: high-velocity repos first
Batch size: 100 items
Delay between batches: 5 seconds
```

**For workspace aggregation only:**
```
Trigger workspace aggregation for workspace [workspace-id]
```

## Environment Setup

Before triggering backfills, ensure you have:

1. **Inngest Event Key** (production):
   ```bash
   export INNGEST_PRODUCTION_EVENT_KEY='your-key-here'
   ```

2. **Supabase Service Role Key** (for direct database access):
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY='your-key-here'
   ```

## Manual Trigger Scripts

### Repository Sync
```bash
#!/bin/bash
INNGEST_EVENT_KEY='your-production-event-key'

curl -s -X POST "https://inn.gs/e/$INNGEST_EVENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "capture/repository.sync",
    "data": {
      "owner": "continuedev",
      "repo": "continue"
    }
  }' | jq -r '.ids[0] // "triggered"'
```

### Embeddings Generation
```bash
#!/bin/bash
INNGEST_EVENT_KEY='your-production-event-key'

curl -s -X POST "https://inn.gs/e/$INNGEST_EVENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "embeddings/process.workspace",
    "data": {
      "workspace_id": "your-workspace-id",
      "batch_size": 100,
      "delay_ms": 5000
    }
  }' | jq -r '.ids[0] // "triggered"'
```

### Workspace Aggregation
```bash
#!/bin/bash
INNGEST_EVENT_KEY='your-production-event-key'

curl -s -X POST "https://inn.gs/e/$INNGEST_EVENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "workspace/aggregate",
    "data": {
      "workspace_id": "your-workspace-id"
    }
  }' | jq -r '.ids[0] // "triggered"'
```

## Monitoring Backfill Progress

### Using Inngest Dashboard
1. Go to https://app.inngest.com
2. Navigate to your environment (Production)
3. View "Recent Runs" to see job status
4. Click on individual job IDs for detailed logs

### Using Database Queries
```sql
-- Check recent PR sync status
SELECT
  owner || '/' || name as repo,
  COUNT(*) as pr_count,
  MAX(created_at) as latest_pr
FROM pull_requests pr
JOIN repositories r ON pr.repository_id = r.id
WHERE r.id IN ('repo-id-1', 'repo-id-2')
GROUP BY r.id, owner, name;

-- Check embeddings coverage
SELECT
  COUNT(*) FILTER (WHERE embeddings IS NOT NULL) as with_embeddings,
  COUNT(*) FILTER (WHERE embeddings IS NULL) as without_embeddings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE embeddings IS NOT NULL) / COUNT(*), 2) as coverage_pct
FROM pull_requests
WHERE repository_id IN ('repo-id-1', 'repo-id-2');
```

## Best Practices

### Batch Size Considerations
- **Small batches (10-50)**: Better for rate-limited APIs, slower but more reliable
- **Medium batches (50-100)**: Balanced approach for most use cases
- **Large batches (100+)**: Faster but may hit rate limits or timeouts

### Delay Between Batches
- **Short delays (1-5s)**: Use for internal operations (embeddings generation)
- **Medium delays (5-15s)**: Use for external APIs with rate limits (GitHub)
- **Long delays (15-30s)**: Use for heavy operations or strict rate limits

### Priority Ordering
1. **High-velocity repositories** (most active, most contributors)
2. **Recently updated repositories** (fresh data matters more)
3. **User-facing workspaces** (impacts visible features)
4. **Background/archive repositories** (less time-sensitive)

## Common Scenarios

### Scenario 1: New Workspace Onboarding
```
Trigger backfill for new workspace with repositories:
- user/repo-1
- user/repo-2

Include full sync: PRs, issues, contributors, embeddings, aggregation
Priority: high
```

### Scenario 2: Missing Embeddings
```
Generate embeddings for all items missing embeddings in workspace [id]
Focus on: PRs and issues from last 90 days
Batch size: 100
Delay: 5 seconds
```

### Scenario 3: Data Refresh After Schema Change
```
Re-sync all data for workspace [id] repositories
Include: repository sync + workspace aggregation
Skip: embeddings (already generated)
```

## Troubleshooting

### Job Fails Immediately
- Check Inngest event key is correct
- Verify repository/workspace IDs exist in database
- Check Edge Function logs for errors

### Job Runs But No Data Updates
- Verify Supabase service role key has correct permissions
- Check for database constraint violations in logs
- Ensure GitHub tokens are valid and have sufficient rate limit

### Embeddings Generation Slow
- Reduce batch size to avoid timeouts
- Increase delay between batches
- Check OpenAI API rate limits and quotas

## Related Documentation

- `/docs/data-fetching/manual-repository-tracking.md` - User-initiated tracking system
- `/docs/postmortems/2025-10-09-bot-contributor-sync-failures.md` - Recent sync issue lessons
- `/scripts/backfill-embeddings-priority.sh` - Automated embeddings backfill script
- `/scripts/auto-process-embeddings.sh` - Auto-processing script for continuous operation

## Script Cleanup

After using manual trigger scripts, remember to:
1. Delete one-time-use scripts from `/tmp`
2. Store reusable scripts in `/scripts` with proper documentation
3. Never commit scripts containing API keys or tokens
