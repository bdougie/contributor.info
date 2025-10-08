# Embeddings System

## Overview

The embeddings system automatically generates semantic vectors for issues, pull requests, and discussions, enabling AI-powered similarity search and recommendations in workspaces.

## Architecture

### Automatic Processing

The system uses an Inngest cron job that runs **every 15 minutes** to process items needing embeddings:

```typescript
// src/lib/inngest/functions/compute-embeddings.ts
{ cron: '*/15 * * * *' }
```

### Priority System

Items are processed with the following priorities:

1. **Discussions** (Priority 1) - Newest content, highest value
2. **Issues** (Priority 2) - Medium priority
3. **Pull Requests** (Priority 3) - Largest volume, lowest priority

### Batch Processing

- **Batch size**: 200 items per cron run (from `items_needing_embeddings` view)
- **Processing rate**: ~400 items/hour
- **Concurrency**: 2 simultaneous jobs per repository
- **Throttle**: 5 requests/minute to OpenAI
- **Items per API batch**: 20 items

## Database Schema

### Embedding Columns

Each table has the following columns:

```sql
embedding VECTOR(1536)              -- OpenAI embedding vector
embedding_generated_at TIMESTAMPTZ  -- When embedding was created
content_hash TEXT                   -- Hash to detect content changes
```

### Items Needing Embeddings View

The `items_needing_embeddings` view identifies items that need processing:

```sql
CREATE VIEW items_needing_embeddings AS
SELECT
  item_type,
  id,
  repository_id,
  title,
  body,
  created_at,
  embedding_generated_at,
  content_hash,
  priority
FROM (
  -- discussions with priority 1
  -- issues with priority 2
  -- pull_requests with priority 3
) AS combined
ORDER BY priority ASC, created_at DESC
LIMIT 200;
```

**Criteria for inclusion:**
- `embedding IS NULL` (no embedding generated yet)
- OR `embedding_generated_at < updated_at` (content changed)
- AND `created_at > NOW() - INTERVAL '90 days'` (recent items only)

## Monitoring

### Check Current Backlog

```bash
export SUPABASE_SERVICE_ROLE_KEY='your-key'
./scripts/check-embeddings-status.sh
```

Shows:
- Items pending by type
- Recently generated embeddings (last hour)

### Live Progress Monitor

```bash
export SUPABASE_SERVICE_ROLE_KEY='your-key'
./scripts/watch-embeddings-progress.sh
```

Real-time dashboard showing:
- Current backlog by type
- Processing rate (last 5 minutes)
- Overall completion percentage

### SQL Queries

**Check backlog count:**
```sql
SELECT COUNT(*) FROM items_needing_embeddings;
```

**Check by type:**
```sql
SELECT item_type, COUNT(*) as count
FROM items_needing_embeddings
GROUP BY item_type
ORDER BY count DESC;
```

**Check recent processing:**
```sql
SELECT
  'discussion' as type,
  COUNT(*) as processed_last_hour
FROM discussions
WHERE embedding_generated_at > NOW() - INTERVAL '1 hour';
```

## Configuration

### Environment Variables

Required for embeddings generation:

```bash
# OpenAI API key for embeddings
VITE_OPENAI_API_KEY=sk-proj-...
# OR
OPENAI_API_KEY=sk-proj-...

# Inngest credentials (for cron execution)
INNGEST_SIGNING_KEY=signkey-prod-...
INNGEST_EVENT_KEY=...
```

### Tuning Parameters

Edit `src/lib/inngest/functions/compute-embeddings.ts`:

```typescript
concurrency: {
  limit: 2,              // Jobs per repository
  key: 'event.data.repositoryId',
},
throttle: {
  limit: 5,              // API calls per period
  period: '1m',
},
```

Edit view limit in `items_needing_embeddings`:
```sql
LIMIT 200;  -- Items per cron run
```

## Performance

### Current Capacity

- **Processing rate**: 400 items/hour (with 15-minute cron)
- **Cost**: ~$0.02 per 1,000 items (OpenAI text-embedding-3-small)
- **Time to clear 17,570 items**: ~44 hours

### Scaling Options

1. **Increase cron frequency**: Change from `*/15` to `*/10` or `*/5`
2. **Increase view limit**: Change from 200 to 500+
3. **Increase concurrency**: Raise from 2 to 5+
4. **Increase throttle**: Raise from 5/min to 10/min

Example for faster processing:
```typescript
{ cron: '*/5 * * * *' }  // Every 5 minutes = ~1,200 items/hour
```

## Cache Management

### Similarity Cache

Embeddings are cached in `similarity_cache` table:

```sql
INSERT INTO similarity_cache (
  repository_id,
  item_type,
  item_id,
  embedding,
  content_hash,
  ttl_hours
) VALUES (...);
```

**TTL settings:**
- Background-generated: 168 hours (7 days)
- On-demand: 24 hours

### Cache Cleanup

Automatic cleanup runs after each job:
```sql
SELECT cleanup_expired_cache();
```

## Troubleshooting

### No Items Being Processed

1. **Check Inngest dashboard**: https://app.inngest.com
2. **Verify cron is enabled**: Look for function status
3. **Check API key**: Ensure OpenAI key is valid
4. **Review logs**: Check Supabase function logs

### Slow Processing

1. **Check OpenAI rate limits**: May be throttled
2. **Review concurrency settings**: May need adjustment
3. **Monitor database**: Check for slow queries
4. **Verify network**: Check Supabase → OpenAI connectivity

### Items Not Showing in View

1. **Check date filter**: Only last 90 days included
2. **Verify embedding status**: Check if already generated
3. **Check content_hash**: May be duplicate content

## Manual Operations

### Force Regeneration

To regenerate embeddings for a specific repository:

```typescript
await inngest.send({
  name: 'embeddings/compute.requested',
  data: {
    repositoryId: 'uuid-here',
    forceRegenerate: true,
    itemTypes: ['discussions', 'issues', 'pull_requests']
  }
});
```

### Priority Changes

To change processing priority, update the view:

```sql
-- Make PRs higher priority than issues
CASE
  WHEN item_type = 'discussion' THEN 1
  WHEN item_type = 'pull_request' THEN 2  -- Changed
  WHEN item_type = 'issue' THEN 3          -- Changed
END as priority
```

## Related Documentation

- [Similarity Search](./similarity-search.md)
- [My Work Dashboard](./my-work-dashboard.md)
- [Inngest Architecture](../infrastructure/dual-inngest-architecture.md)
- [Supabase Edge Functions](../infrastructure/supabase-edge-functions-deployment.md)
