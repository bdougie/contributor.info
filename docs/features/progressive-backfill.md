# Progressive Backfill

Automatically sync large GitHub repositories without hitting rate limits.

## Quick start

```bash
# Backfill a specific repository
node scripts/github-actions/progressive-backfill.js --repository-id=123

# Process all active backfills
node scripts/github-actions/progressive-backfill.js
```

## How it works

Progressive backfill processes large repositories in chunks:
1. Detects repositories with incomplete data
2. Creates small batches of PRs to process
3. Tracks progress in the database
4. Automatically pauses when rate limits are low
5. Recovers from failures automatically

## Configuration

### Command line options

```bash
--repository-id <id>    # Process specific repository
--chunk-size <size>     # PRs per chunk (default: 25)
--max-chunks <count>    # Chunks per run (default: 10)
--dry-run              # Test without making changes
```

### Environment variables

```bash
VITE_SUPABASE_URL       # Your Supabase URL
SUPABASE_SERVICE_KEY    # Service role key for admin access
GITHUB_TOKEN           # GitHub token with repo scope
```

## Monitor progress

### Check backfill status

```sql
-- View all active backfills
SELECT 
  r.owner || '/' || r.name as repository,
  pbs.processed_prs || '/' || pbs.total_prs as progress,
  pbs.status,
  pbs.last_processed_at
FROM progressive_backfill_state pbs
JOIN repositories r ON r.id = pbs.repository_id
WHERE pbs.status = 'active';
```

### View chunk processing

```sql
-- Recent chunk activity
SELECT 
  chunk_number,
  status,
  array_length(pr_numbers, 1) as pr_count,
  started_at,
  completed_at
FROM backfill_chunks
WHERE backfill_state_id = 'your-backfill-id'
ORDER BY chunk_number DESC
LIMIT 10;
```

## Recover stuck chunks

Chunks stuck in "processing" state are automatically recovered every 2 hours.

### Manual recovery

```bash
# Recover chunks stuck for 30+ minutes
npm run recover:chunks

# Custom threshold and cleanup
node scripts/github-actions/recover-stuck-chunks.js \
  --stuck-threshold=60 \
  --cleanup-days=7
```

## Common issues

### Rate limit errors

**Symptom:** "GraphQL rate limit too low"

**Fix:** Wait for rate limit reset or reduce chunk size:
```bash
--chunk-size=10  # Smaller chunks use fewer API calls
```

### Stuck chunks

**Symptom:** Chunks stay in "processing" state

**Fix:** Run recovery:
```bash
npm run recover:chunks
```

### Missing PRs

**Symptom:** Some PRs not captured

**Check:** Repository permissions and PR visibility:
```sql
-- Find gaps in PR numbers
SELECT 
  repository_id,
  generate_series(1, max(number)) as expected_number
FROM pull_requests
WHERE repository_id = 'your-repo-id'
  AND generate_series NOT IN (
    SELECT number FROM pull_requests 
    WHERE repository_id = 'your-repo-id'
  );
```

## Advanced usage

### Priority processing

Process high-value repositories first:
```sql
-- Set priority (affects chunk size and frequency)
UPDATE progressive_backfill_state
SET metadata = jsonb_set(metadata, '{priority}', '"high"')
WHERE repository_id = 'important-repo-id';
```

### Pause backfill

Temporarily stop processing:
```sql
UPDATE progressive_backfill_state
SET status = 'paused'
WHERE repository_id = 'repo-id';
```

### Resume backfill

Continue processing:
```sql
UPDATE progressive_backfill_state
SET status = 'active', consecutive_errors = 0
WHERE repository_id = 'repo-id';
```

## GitHub Actions

### Scheduled backfill

Runs every 30 minutes:
```yaml
# .github/workflows/progressive-backfill.yml
on:
  schedule:
    - cron: '*/30 * * * *'
```

### Manual trigger

Run from GitHub UI:
1. Go to Actions → Progressive Repository Backfill
2. Click "Run workflow"
3. Set options (optional)
4. Click "Run workflow"

## Database schema

### Tables

- `progressive_backfill_state` - Tracks overall progress
- `backfill_chunks` - Individual processing batches
- `pull_requests` - Stored PR data

### Key fields

```typescript
progressive_backfill_state {
  id: uuid
  repository_id: uuid
  total_prs: integer
  processed_prs: integer
  status: 'active' | 'paused' | 'completed'
  last_processed_cursor: string
  chunk_size: integer
}
```