# Progressive Backfill System Guide

## Overview

The Progressive Backfill System is designed to capture historical GitHub data for large repositories efficiently without overwhelming the GitHub API or our database. It processes data in small chunks over time, automatically resuming from failures and tracking progress.

## Architecture

```
┌─────────────────────────┐
│   GitHub Actions        │
│   (Scheduled/Manual)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ progressive-backfill.js │
│   - Error tracking      │
│   - Chunk processing    │
│   - Progress reporting  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Supporting Libraries  │
├─────────────────────────┤
│ • chunk-calculator.js   │
│ • progress-tracker.js   │
│ • chunk-recovery.js     │
│ • graphql-client.js     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│      Database           │
├─────────────────────────┤
│ • backfill_state        │
│ • backfill_chunks       │
│ • pull_requests         │
└─────────────────────────┘
```

## How It Works

### 1. Repository Selection

The system automatically identifies repositories that need backfilling based on:
- Repository has >100 PRs (worth backfilling)
- Data completeness is <80%
- No active backfill already running

### 2. Chunk Processing

Each repository is processed in chunks to avoid timeouts:
- Default chunk size: 25 PRs
- Adaptive sizing based on rate limits
- Cursor-based pagination for reliability

### 3. Error Handling

The system tracks all errors during execution:

```javascript
errorSummary = {
  totalErrors: 0,
  criticalErrors: [],    // Failures that stop processing
  warningErrors: [],      // Non-fatal issues
  repositories: {}        // Per-repo error details
}
```

Errors are:
- Logged to console with context
- Saved to GitHub Actions output
- Reported via GitHub Issues if critical
- Tracked in the database

### 4. Progress Tracking

Progress is tracked in real-time:
- Number of PRs processed
- Last cursor position (for resuming)
- Consecutive error count (for circuit breaking)
- Chunk completion status

## Configuration

### Environment Variables

```bash
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
GITHUB_TOKEN=ghp_your_token

# Optional (set by GitHub Actions)
GITHUB_OUTPUT=/path/to/output/file
GITHUB_REPOSITORY=owner/repo
GITHUB_RUN_ID=123456789
```

### Command Line Options

```bash
# Process specific repository
--repository-id=123

# Override chunk size (default: 25)
--chunk-size=50

# Limit chunks per run (default: 10)
--max-chunks=5

# Test without making changes
--dry-run
```

## Error Scenarios and Recovery

### 1. Rate Limit Errors

**Symptom**: `GraphQL rate limit too low`

**Automatic handling**:
- Pauses backfill with status `graphql_rate_limit_low`
- Resumes in next scheduled run
- No manual intervention needed

### 2. Network Failures

**Symptom**: `fetch failed`, `ECONNREFUSED`

**Automatic handling**:
- Retries with exponential backoff
- Tracks error in summary
- Continues with next chunk if persistent

### 3. Invalid Data

**Symptom**: `PRs missing databaseId`

**Automatic handling**:
- Logs detailed PR information
- Skips invalid PRs
- Reports in error summary

### 4. Stuck Chunks

**Symptom**: Chunks in "processing" state for >30 minutes

**Automatic handling**:
- Chunk recovery runs before each backfill
- Resets stuck chunks to allow retry
- Logs recovery results

## Monitoring

### GitHub Actions UI

Check the workflow runs at:
```
https://github.com/[owner]/[repo]/actions/workflows/progressive-backfill.yml
```

Look for:
- ✅ Green checkmarks: Successful runs
- ⚠️ Error summaries in logs
- 📊 Processing statistics

### Database Queries

```sql
-- Check active backfills
SELECT 
  r.owner || '/' || r.name as repository,
  pbs.processed_prs || '/' || pbs.total_prs as progress,
  ROUND((pbs.processed_prs::float / pbs.total_prs) * 100, 2) || '%' as percentage,
  pbs.status,
  pbs.updated_at
FROM progressive_backfill_state pbs
JOIN repositories r ON r.id = pbs.repository_id
WHERE pbs.status = 'active'
ORDER BY pbs.updated_at DESC;

-- Find failed chunks
SELECT 
  r.owner || '/' || r.name as repository,
  bc.chunk_number,
  bc.error,
  bc.started_at
FROM backfill_chunks bc
JOIN repositories r ON r.id = bc.repository_id
WHERE bc.status = 'failed'
ORDER BY bc.started_at DESC
LIMIT 10;

-- Check completion rates
SELECT 
  r.owner || '/' || r.name as repository,
  COUNT(DISTINCT pr.id) as captured_prs,
  r.pull_request_count as total_prs,
  ROUND((COUNT(DISTINCT pr.id)::float / NULLIF(r.pull_request_count, 0)) * 100, 2) as completion_rate
FROM repositories r
LEFT JOIN pull_requests pr ON pr.repository_id = r.id
WHERE r.pull_request_count > 100
GROUP BY r.id, r.owner, r.name, r.pull_request_count
HAVING COUNT(DISTINCT pr.id)::float / NULLIF(r.pull_request_count, 0) < 0.8
ORDER BY completion_rate;
```

### GitHub Issues

The system automatically creates issues for:
- Fatal errors that stop processing
- Repeated failures for the same repository
- Critical system errors

Issues include:
- Error details and timestamps
- Links to workflow runs
- Repository information
- Failure history

## Performance Tuning

### Chunk Size Optimization

The chunk calculator considers:
- Current rate limit remaining
- Repository size
- Historical performance
- Error rates

To override:
```bash
# Smaller chunks for problematic repos
--chunk-size=10

# Larger chunks for good network
--chunk-size=50
```

### Scheduling

Default: Every 30 minutes via cron

Adjust in `.github/workflows/progressive-backfill.yml`:
```yaml
schedule:
  - cron: '*/30 * * * *'  # Every 30 minutes
  # - cron: '0 */2 * * *'  # Every 2 hours
  # - cron: '0 0 * * *'    # Daily at midnight
```

### Parallel Processing

The system processes one repository at a time to:
- Maintain predictable rate limit usage
- Simplify error recovery
- Prevent database conflicts

## Troubleshooting Guide

### Issue: "No repositories need backfilling"

**Check**:
1. Repository PR counts: `SELECT owner, name, pull_request_count FROM repositories WHERE pull_request_count > 100;`
2. Existing backfills: `SELECT * FROM progressive_backfill_state;`
3. Data completeness calculation

### Issue: "Too many consecutive errors"

**Check**:
1. Error details in logs
2. Network connectivity
3. GitHub API status
4. Database connectivity

**Fix**:
```sql
-- Reset error counter
UPDATE progressive_backfill_state 
SET consecutive_errors = 0, status = 'active'
WHERE repository_id = 'xxx' AND status = 'paused';
```

### Issue: Duplicate processing

**Check**:
1. Chunk numbers: `SELECT chunk_number, COUNT(*) FROM backfill_chunks GROUP BY chunk_number HAVING COUNT(*) > 1;`
2. PR duplicates: `SELECT repository_id, number, COUNT(*) FROM pull_requests GROUP BY repository_id, number HAVING COUNT(*) > 1;`

**Prevention**:
- Uses atomic chunk numbering
- Database constraints prevent duplicates
- Idempotent upsert operations

## Best Practices

1. **Don't manually modify backfill state** - Let the system manage it
2. **Monitor rate limits** - Adjust chunk size if consistently hitting limits
3. **Check error patterns** - Repeated errors may indicate systematic issues
4. **Use dry-run for testing** - Verify behavior before processing
5. **Let it run automatically** - The system is designed for hands-off operation

## Future Improvements

Potential enhancements:
- [ ] Parallel repository processing
- [ ] Dynamic chunk sizing based on PR complexity
- [ ] Webhook-based incremental updates
- [ ] Data validation and quality scores
- [ ] Automatic retry strategies
- [ ] Performance metrics dashboard