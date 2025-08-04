# Troubleshooting Backfill Issues

Fix common problems with progressive backfill.

## Backfill not starting

### Check repository size

```sql
-- Repositories must have 100+ PRs
SELECT owner, name, pull_request_count
FROM repositories
WHERE id = 'your-repo-id';
```

### Verify permissions

```bash
# Test GitHub access
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/pulls
```

### Check existing backfills

```sql
-- One backfill per repository
SELECT * FROM progressive_backfill_state
WHERE repository_id = 'your-repo-id';
```

## Slow processing

### Reduce chunk size

```bash
# Smaller chunks = faster processing
--chunk-size=10
```

### Check rate limits

```bash
# View current limits
node scripts/github-actions/check-rate-limit.js
```

### Process during off-peak hours

Best times: 10 PM - 6 AM UTC

## Data inconsistencies

### Missing reviews

**Fix:** Ensure PR query includes review data:
```javascript
reviews {
  id
  state
  author { login }
}
```

### Duplicate PRs

**Fix:** Database constraints prevent duplicates. Check logs for errors:
```sql
SELECT * FROM sync_logs
WHERE operation = 'progressive_backfill'
  AND status = 'error'
ORDER BY created_at DESC;
```

## Recovery failures

### Chunk won't complete

```sql
-- Force mark as failed
UPDATE backfill_chunks
SET status = 'failed',
    error = 'Manual intervention',
    completed_at = NOW()
WHERE id = 'stuck-chunk-id';
```

### Reset backfill state

```sql
-- Last resort - reset progress
UPDATE progressive_backfill_state
SET processed_prs = 0,
    last_processed_cursor = NULL,
    consecutive_errors = 0,
    status = 'active'
WHERE id = 'backfill-id';
```

## Error messages

### "value out of range for type integer"

**Cause:** Chunk number too large

**Fix:** Applied automatically. Update to latest code.

### "invalid input syntax for type bigint"

**Cause:** Using GraphQL ID instead of numeric ID

**Fix:** Applied automatically. PRs now use `databaseId`.

### "GraphQL rate limit exceeded"

**Cause:** Too many API calls

**Fix:** Wait for reset (shown in error) or reduce activity:
```bash
--chunk-size=5 --max-chunks=2
```

## Monitoring

### Check logs

```bash
# View recent backfill logs
gh run list --workflow=progressive-backfill.yml --limit=10
```

### Database metrics

```sql
-- Processing speed
SELECT 
  DATE_TRUNC('hour', last_processed_at) as hour,
  SUM(processed_prs) as prs_processed
FROM progressive_backfill_state
WHERE last_processed_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Chunk statistics

```sql
-- Success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM backfill_chunks
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

## Performance tuning

### Optimal chunk sizes

- Small repos (<1,000 PRs): 25-50
- Medium repos (1,000-10,000 PRs): 15-25  
- Large repos (10,000-50,000 PRs): 10-15
- Huge repos (50,000+ PRs): 5-10

### Parallel processing

Run multiple repositories simultaneously:
```bash
# Terminal 1
node scripts/github-actions/progressive-backfill.js --repository-id=repo1

# Terminal 2
node scripts/github-actions/progressive-backfill.js --repository-id=repo2
```

### Database optimization

```sql
-- Add index for faster queries
CREATE INDEX idx_backfill_chunks_status 
ON backfill_chunks(backfill_state_id, status);

-- Vacuum table after heavy processing
VACUUM ANALYZE pull_requests;
```