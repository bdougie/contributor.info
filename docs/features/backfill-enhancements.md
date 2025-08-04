# Backfill Enhancements

Three improvements that make progressive backfill more reliable.

## Atomic chunk numbering

Prevents duplicate chunks when multiple workers run simultaneously.

### How it works

```sql
-- Database sequence generates unique numbers
SELECT get_next_chunk_number('backfill-state-id');
```

### Apply migration

```bash
# Run via Supabase MCP
mcp__supabase__apply_migration \
  --name="add_chunk_sequence" \
  --query="@20250104_add_chunk_sequence.sql"
```

## GraphQL rate limiting

Tracks GitHub's GraphQL-specific limits, not just REST API.

### New metrics

```javascript
{
  remaining: 4821,        // Points left
  limit: 5000,           // Total points
  percentageUsed: 3.58,  // Usage percentage
  averageCostPerQuery: 2, // Points per query
  estimatedQueriesRemaining: 2410 // Queries before limit
}
```

### Pre-flight checks

```javascript
// Automatically checks before each query
await client.checkRateLimitBeforeQuery(
  estimatedCost,    // Expected points
  minRemaining      // Minimum buffer
);
```

### Better error handling

```javascript
catch (error) {
  if (error.type === 'RATE_LIMITED') {
    console.log(`Reset at: ${error.resetAt}`);
    console.log(`Wait ${error.waitTime}ms`);
  }
}
```

## Stuck chunk recovery

Automatically fixes chunks that fail to complete.

### Automatic recovery

Runs every 2 hours via GitHub Actions:
```yaml
# .github/workflows/chunk-recovery.yml
schedule:
  - cron: '0 */2 * * *'
```

### Manual recovery

```bash
# Recover chunks stuck 30+ minutes
npm run recover:chunks

# Custom settings
npm run recover:chunks -- \
  --stuck-threshold=60 \
  --cleanup-days=7 \
  --dry-run
```

### Recovery logic

1. Find chunks in "processing" > 30 minutes
2. Check if PRs were actually stored
3. Mark as completed (80%+ success) or failed
4. Clean up old completed chunks

### Monitor recovery

```sql
-- View recovery statistics
SELECT 
  COUNT(*) FILTER (WHERE status = 'processing') as stuck,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM backfill_chunks
WHERE started_at > NOW() - INTERVAL '24 hours';
```

## Configuration

### Environment setup

```bash
# Required for all features
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
GITHUB_TOKEN=your-github-token
```

### Adjust thresholds

```javascript
// In progressive-backfill.js
const MIN_GRAPHQL_POINTS = 500;  // Minimum before pausing
const CHUNK_RECOVERY_MINUTES = 30; // When to consider stuck
```

## Monitoring

### Check chunk status

```bash
# View chunk statistics
node -e "
const recovery = new ChunkRecovery(supabase);
const stats = await recovery.getChunkStatistics();
console.log(stats);
"
```

### Track progress

```sql
-- Real-time progress
SELECT 
  r.owner || '/' || r.name as repo,
  pbs.processed_prs || '/' || pbs.total_prs as progress,
  ROUND(pbs.processed_prs::numeric / pbs.total_prs * 100, 2) || '%' as percent,
  pbs.status
FROM progressive_backfill_state pbs
JOIN repositories r ON r.id = pbs.repository_id
WHERE pbs.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY pbs.updated_at DESC;
```