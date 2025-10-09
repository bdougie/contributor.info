# Embeddings Scripts

Scripts for managing vector embeddings generation and backfill for workspace items (PRs, issues, discussions).

## Overview

The embeddings system generates 384-dimension vectors for semantic similarity search within workspaces. Only workspace items get embeddings to control costs and focus on relevant features.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Workspace Items (PRs, Issues, Discussions)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ items_needing_embeddings_priority VIEW                      │
│ - INNER JOIN with workspace_repositories                    │
│ - Priority: Issues (3) > PRs (2) > Discussions (2)         │
│ - Batch size: 200 items                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Inngest compute-embeddings Function                         │
│ - Triggered: Manual events or 15min cron                    │
│ - Concurrency: 2 jobs per repository                        │
│ - Throttle: 5 jobs per minute                               │
│ - Batch processing: 20 items per API call                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenAI text-embedding-3-small API                           │
│ - Model: text-embedding-3-small                             │
│ - Dimensions: 384                                            │
│ - Max tokens: 8191 per input                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase Database                                           │
│ - Stores embeddings in vector(384) columns                  │
│ - Updates: embedding, embedding_generated_at, content_hash  │
│ - Cache: similarity_cache table for performance             │
└─────────────────────────────────────────────────────────────┘
```

## ⚠️ Critical Constraints

### Workspace-Only Processing
**Non-workspace items will NEVER receive embeddings.** This is enforced by:
- INNER JOIN in the priority view (not LEFT JOIN)
- Database-level filtering via workspace_repositories table
- Only items in active workspaces are processed

### Rate Limits
- **Inngest Throttle**: 5 events per minute maximum
- **OpenAI Rate Limits**: Standard tier limits apply
- **Concurrency**: 2 jobs per repository maximum
- **Safe Delay**: Minimum 5 seconds between trigger events

## Scripts

### 1. backfill-embeddings-priority.sh
Main backfill script for processing workspace embeddings in batches.

**Usage**:
```bash
# Fast backfill (5s delay, 100 iterations)
export INNGEST_PRODUCTION_EVENT_KEY='your-key'
./scripts/backfill-embeddings-priority.sh 100 5

# Slow backfill (15s delay, 50 iterations)
./scripts/backfill-embeddings-priority.sh 50 15

# Default (100 iterations, 15s delay)
./scripts/backfill-embeddings-priority.sh
```

**Parameters**:
- `iterations` (default: 100) - Number of batches to process
- `delay_seconds` (default: 15) - Delay between batches

**Output**:
- Progress tracking every 10 iterations
- Success/failure count
- Estimated items processed (~200 per iteration)
- Links to monitoring dashboard

**Estimates**:
- 100 iterations × 200 items = ~20,000 workspace items
- 100 iterations × 5s delay = ~8 minutes runtime
- 100 iterations × 15s delay = ~25 minutes runtime

### 2. trigger-embeddings.mjs
Low-level script to trigger a single embeddings job via Inngest API.

**Usage**:
```bash
export INNGEST_PRODUCTION_EVENT_KEY='your-key'
node scripts/trigger-embeddings.mjs
```

**Environment Variables**:
- `INNGEST_PRODUCTION_EVENT_KEY` (required) - Inngest API key
- `INNGEST_EVENT_KEY` (alternative) - Fallback key name

### 3. check-embeddings-status.sh
Check current embedding coverage for workspace items.

**Usage**:
```bash
./scripts/check-embeddings-status.sh
```

**Output**:
```
Item Type       Total   With Embeddings   Coverage %
issues          1,383   537              38.83%
pull_requests   126,863 92               0.07%
discussions     202     173              85.64%
```

## Database Components

### Priority View: items_needing_embeddings_priority
Located in: `supabase/migrations/20251009000000_add_priority_embeddings_view.sql`

**Key Features**:
- Returns 200 items per query
- Workspace items only (INNER JOIN)
- Priority-ordered: Issues > PRs > Discussions
- Filters: No embedding OR embedding outdated

**Query Structure**:
```sql
WITH workspace_repos AS (
  SELECT DISTINCT repository_id
  FROM workspace_repositories wr
  JOIN workspaces w ON wr.workspace_id = w.id
  WHERE w.is_active = true
)
SELECT * FROM (
  -- Issues (priority 3)
  SELECT ... FROM issues i
  INNER JOIN workspace_repos wr ON i.repository_id = wr.repository_id

  UNION ALL

  -- PRs (priority 2)
  SELECT ... FROM pull_requests pr
  INNER JOIN workspace_repos wr ON pr.repository_id = wr.repository_id

  UNION ALL

  -- Discussions (priority 2)
  SELECT ... FROM discussions d
  INNER JOIN workspace_repos wr ON d.repository_id = wr.repository_id
)
ORDER BY priority_score DESC, updated_at DESC
LIMIT 200;
```

### Inngest Function: compute-embeddings
Located in: `src/lib/inngest/functions/compute-embeddings.ts`

**Triggers**:
- Event: `embeddings/compute.requested`
- Cron: `*/15 * * * *` (every 15 minutes)

**Processing**:
1. Query `items_needing_embeddings_priority` view
2. Batch items into groups of 20
3. Generate embeddings via OpenAI API
4. Update database with embeddings + metadata
5. Store in similarity_cache for performance

**Configuration**:
- Concurrency: 2 jobs per repository
- Retries: 2 attempts
- Throttle: 5 jobs per minute
- Batch size: 20 items per OpenAI call

## Monitoring

### Inngest Dashboard
Monitor job execution at: https://app.inngest.com

**Key Metrics**:
- Jobs triggered vs completed
- Success/failure rate
- Processing time per batch
- Queue depth
- Error messages

### Database Queries

**Check coverage by type**:
```sql
SELECT
  item_type,
  COUNT(*) as total,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
  ROUND(100.0 * COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_pct
FROM (
  SELECT id, embedding, 'issue' as item_type FROM issues
  UNION ALL
  SELECT id, embedding, 'pull_request' FROM pull_requests
  UNION ALL
  SELECT id::text, embedding, 'discussion' FROM discussions
) items
GROUP BY item_type;
```

**Check items in queue**:
```sql
SELECT item_type, COUNT(*) as pending_count
FROM items_needing_embeddings_priority
GROUP BY item_type;
```

**Check recent jobs**:
```sql
SELECT
  id,
  status,
  items_total,
  items_processed,
  started_at,
  completed_at
FROM embedding_jobs
ORDER BY created_at DESC
LIMIT 10;
```

## Environment Variables

### Required
```bash
# Inngest (for backfill scripts)
INNGEST_PRODUCTION_EVENT_KEY=your-production-key

# OpenAI (for embedding generation)
VITE_OPENAI_API_KEY=your-openai-key
OPENAI_API_KEY=your-openai-key  # Alternative name
```

### Optional
```bash
# Supabase (if running direct queries)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

## Troubleshooting

### Issue: "INNGEST_EVENT_KEY not found"
**Solution**: Export the production key
```bash
export INNGEST_PRODUCTION_EVENT_KEY='your-key'
./scripts/backfill-embeddings-priority.sh
```

### Issue: Backfill stops early
**Cause**: View returns fewer than 200 items (queue emptying)
**Solution**: This is normal - all items have been processed

### Issue: Jobs failing in Inngest
**Check**:
1. OpenAI API key is valid and funded
2. Rate limits not exceeded
3. Database connections available
4. Check Inngest dashboard for error details

### Issue: Non-workspace items getting embeddings
**This should never happen!** If you see this:
1. Check the view uses INNER JOIN (not LEFT JOIN)
2. Verify workspace_repositories table is correct
3. Check migration `20251009000000_add_priority_embeddings_view.sql`

### Issue: Slow processing
**Optimization Options**:
1. Reduce delay between batches (min 5s recommended)
2. Run multiple backfill scripts in parallel (watch throttle limits)
3. Increase OpenAI rate limits (upgrade tier)
4. Check for database performance issues

## Cost Estimation

### OpenAI API Costs
- **Model**: text-embedding-3-small
- **Price**: $0.02 per 1M tokens (as of 2025)
- **Average Item**: ~500 tokens (title + body)
- **Cost per 1000 items**: ~$0.01

**Example Backfill Costs**:
- 20,000 workspace items: ~$0.20
- 100,000 workspace items: ~$1.00

### Inngest Costs
- Free tier: 50k step runs/month
- Each embedding job: ~10-20 step runs
- 1000 jobs: ~15,000 step runs

## Best Practices

### 1. Backfill Strategy
- Start with fast backfill (5s delay) for initial catch-up
- Switch to slow backfill (15s+ delay) for ongoing maintenance
- Run during off-peak hours if processing large batches
- Monitor OpenAI and Inngest usage to avoid overages

### 2. Workspace Management
- Only add repositories to workspaces if embeddings are needed
- Remove inactive repositories from workspaces to reduce costs
- Archive old workspaces to stop processing their items

### 3. Monitoring
- Check coverage weekly with database queries
- Monitor Inngest dashboard for failures
- Set up alerts for embedding job failures
- Track OpenAI API usage and costs

### 4. Security
- Never commit API keys to repository
- Use environment variables for all secrets
- Rotate API keys periodically
- Monitor API key usage for anomalies

## Related Files

- Migration: `supabase/migrations/20251009000000_add_priority_embeddings_view.sql`
- Function: `src/lib/inngest/functions/compute-embeddings.ts`
- Postmortem: `docs/postmortems/2025-10-09-missing-pr-issue-embeddings.md`
- Similarity Search: `src/services/similarity-search.ts`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Inngest dashboard for job errors
3. Check database logs for query issues
4. Review OpenAI API dashboard for rate limit issues
