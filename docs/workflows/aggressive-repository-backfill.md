# Aggressive Repository Backfill Guide

## Overview

The aggressive repository backfill process performs a comprehensive data sync and embeddings generation for a specific repository. This is useful when:

- Onboarding a new high-priority repository
- Recovering from data gaps or sync failures
- Ensuring complete coverage before a product launch or demo
- Backfilling historical data for analysis

## Process Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Aggressive Backfill                    │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌───────────┐  ┌──────────────┐
    │ Step 1:  │   │  Step 2:  │  │   Step 3:    │
    │ Data     │──▶│ Embeddings│─▶│  Workspace   │
    │ Sync     │   │ Generation│  │  Aggregation │
    └──────────┘   └───────────┘  └──────────────┘
         │              │                │
         ▼              ▼                ▼
    Via Inngest    Priority-based   Metrics Update
    (5-15 min)     (20-40 min)      (1-2 min)
```

## Prerequisites

### 1. Environment Variables

```bash
# Required for all operations
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Required for data sync (Step 1)
export INNGEST_PRODUCTION_EVENT_KEY="your-inngest-key"
```

### 2. Repository Must Be Tracked

The repository must already exist in the database. If not, track it first:

1. Log in to the app
2. Navigate to `https://contributor.info/owner/repo`
3. Click "Track This Repository"

## Usage

### Basic Usage

```bash
# Full backfill for bdougie/contributor.info
./scripts/aggressive-backfill-repo.sh bdougie contributor.info
```

### With Options

```bash
# Dry run to see what would happen
./scripts/aggressive-backfill-repo.sh bdougie contributor.info --dry-run

# Sync last 30 days only
./scripts/aggressive-backfill-repo.sh bdougie contributor.info --time-range 30

# Skip embeddings generation
./scripts/aggressive-backfill-repo.sh bdougie contributor.info --skip-embeddings

# Only generate embeddings (skip data sync)
./scripts/aggressive-backfill-repo.sh bdougie contributor.info --embeddings-only
```

## Detailed Steps

### Step 1: Repository Data Sync (5-15 minutes)

**What it does:**
- Triggers Inngest job to sync repository data
- Fetches PRs, issues, contributors, reviews, and comments
- Uses GitHub API with proper rate limiting
- Waits for sync completion before proceeding

**Monitoring:**
- Check Inngest dashboard: https://app.inngest.com
- Look for `github/repository.sync` events
- Script will wait up to 15 minutes for completion

**Rate Limits:**
- GitHub API: 5,000 requests/hour (authenticated)
- Respects GitHub's secondary rate limits
- Automatic backoff and retry on rate limit errors

### Step 2: Embeddings Generation (20-40 minutes)

**What it does:**
- Generates embeddings for all synced items using the priority system
- Priority order: Workspace items > Issues > PRs > Discussions
- Batch size: 200 items per iteration
- Runs 100 iterations with 15-second delays

**Monitoring:**
```sql
-- Check items needing embeddings
SELECT item_type, COUNT(*)
FROM items_needing_embeddings_priority
WHERE repository_id = 'your-repo-id'
GROUP BY item_type;

-- Check embedding coverage
SELECT
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_percent
FROM pull_requests
WHERE repository_id = 'your-repo-id';
```

**Cost Estimates:**
- OpenAI Embeddings API: ~$0.10 per 1M tokens
- Typical PR: ~500 tokens = $0.00005
- 1,000 PRs: ~$0.05
- 5,000 items (mixed): ~$0.15-0.25

### Step 3: Workspace Aggregation (1-2 minutes)

**What it does:**
- Aggregates metrics for workspaces containing the repository
- Updates contributor counts, PR stats, issue stats
- Refreshes workspace dashboards

**SQL Verification:**
```sql
-- Check workspace metrics
SELECT
  w.name,
  w.total_repositories,
  w.total_contributors,
  w.total_pull_requests,
  w.total_issues
FROM workspaces w
JOIN workspace_repositories wr ON w.id = wr.workspace_id
WHERE wr.repository_id = 'your-repo-id';
```

## Execution Time Estimates

| Repository Size | Data Sync | Embeddings | Total Time |
|----------------|-----------|------------|------------|
| Small (<100 PRs) | 2-5 min | 5-10 min | 7-15 min |
| Medium (100-1K PRs) | 5-10 min | 15-25 min | 20-35 min |
| Large (1K-5K PRs) | 10-15 min | 30-50 min | 40-65 min |
| Very Large (>5K PRs) | 15-30 min | 60-120 min | 75-150 min |

## Troubleshooting

### Script Fails Immediately

**Check environment variables:**
```bash
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
echo $INNGEST_PRODUCTION_EVENT_KEY
```

**Verify repository exists:**
```sql
SELECT id, owner, name, full_name
FROM repositories
WHERE owner = 'bdougie' AND name = 'contributor.info';
```

### Sync Timeout

If sync exceeds 15 minutes:
1. Check Inngest dashboard for job status
2. Job may still be running in background
3. Re-run with `--embeddings-only` once sync completes

### Embeddings Fail

**Check Supabase Edge Function:**
```bash
supabase functions logs compute-embeddings --project-ref egcxzonpmmcirmgqdrla
```

**Check OpenAI API key:**
- Verify key is set in Supabase secrets
- Check remaining quota

**Retry embeddings only:**
```bash
./scripts/aggressive-backfill-repo.sh bdougie contributor.info --embeddings-only
```

### Rate Limit Errors

GitHub API rate limits:
```bash
# Check rate limit status
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

If rate limited:
- Wait for limit to reset (shown in response)
- Use different GitHub token if available
- Reduce `--time-range` to fetch less data

## Best Practices

### 1. Start with Dry Run

Always test with `--dry-run` first to verify configuration:
```bash
./scripts/aggressive-backfill-repo.sh bdougie contributor.info --dry-run
```

### 2. Monitor Progress

Keep multiple terminals open:
- Terminal 1: Running the script
- Terminal 2: Watching Inngest dashboard
- Terminal 3: Monitoring Supabase logs
- Terminal 4: Running SQL verification queries

### 3. Off-Peak Hours

Run large backfills during off-peak hours:
- Less competition for API rate limits
- Lower cost for serverless functions
- Reduced impact on production users

### 4. Incremental Approach

For very large repositories:
```bash
# Phase 1: Recent data (30 days)
./scripts/aggressive-backfill-repo.sh owner/repo --time-range 30

# Phase 2: Historical data (90 days)
./scripts/aggressive-backfill-repo.sh owner/repo --time-range 90 --skip-embeddings

# Phase 3: Embeddings only
./scripts/aggressive-backfill-repo.sh owner/repo --embeddings-only
```

## Verification Checklist

After backfill completes:

- [ ] Repository data appears in app
- [ ] PR count matches GitHub
- [ ] Issue count matches GitHub
- [ ] Contributors list is complete
- [ ] Embeddings are generated (check SQL query)
- [ ] Workspace metrics are updated
- [ ] No errors in Inngest logs
- [ ] No errors in Supabase logs

## SQL Verification Queries

```sql
-- 1. Overall data coverage
SELECT
  (SELECT COUNT(*) FROM pull_requests WHERE repository_id = 'repo-id') as prs,
  (SELECT COUNT(*) FROM issues WHERE repository_id = 'repo-id') as issues,
  (SELECT COUNT(*) FROM contributors
   WHERE id IN (
     SELECT DISTINCT author_id FROM pull_requests WHERE repository_id = 'repo-id'
   )) as contributors;

-- 2. Embedding coverage
SELECT
  'PRs' as item_type,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage
FROM pull_requests
WHERE repository_id = 'repo-id'
UNION ALL
SELECT
  'Issues' as item_type,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END),
  COUNT(*),
  ROUND(100.0 * COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) / COUNT(*), 2)
FROM issues
WHERE repository_id = 'repo-id';

-- 3. Recent activity
SELECT
  'PRs' as type,
  MAX(created_at) as most_recent
FROM pull_requests
WHERE repository_id = 'repo-id'
UNION ALL
SELECT
  'Issues',
  MAX(created_at)
FROM issues
WHERE repository_id = 'repo-id';

-- 4. Data quality checks
SELECT
  'PRs with null author' as issue,
  COUNT(*) as count
FROM pull_requests
WHERE repository_id = 'repo-id' AND author_id IS NULL
UNION ALL
SELECT
  'Issues with null author',
  COUNT(*)
FROM issues
WHERE repository_id = 'repo-id' AND author_id IS NULL;
```

## Cost Breakdown

### For bdougie/contributor.info (estimated)

**Assumptions:**
- ~2,000 PRs (90 days)
- ~500 issues (90 days)
- ~200 contributors
- ~5,000 comments/reviews

**Costs:**
- GitHub API: Free (within rate limits)
- Inngest: ~$0.05 (execution time)
- Supabase: ~$0.10 (function invocations)
- OpenAI Embeddings: ~$0.20 (2,500 items × $0.00008)

**Total: ~$0.35**

## Support

If you encounter issues:
1. Check this documentation first
2. Review error messages in terminal
3. Check Inngest dashboard logs
4. Check Supabase function logs
5. Run verification SQL queries
6. Contact team with error details

## Related Documentation

- [Progressive Capture System](/docs/progressive-capture/README.md)
- [Embeddings Architecture](/docs/embeddings/ARCHITECTURE.md)
- [Workspace Data Fetching](/supabase/migrations/README_workspace_data_fetching.md)
- [Inngest Integration](/docs/inngest/README.md)
