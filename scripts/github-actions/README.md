# GitHub Actions Scripts

This directory contains scripts used by GitHub Actions workflows for automating various data capture and synchronization tasks.

## Table of Contents

- [Progressive Backfill](#progressive-backfill)
- [Capture PR Details](#capture-pr-details)
- [Error Reporting](#error-reporting)
- [Rate Limit Management](#rate-limit-management)
- [Chunk Recovery](#chunk-recovery)

## Progressive Backfill

### Overview

The progressive backfill system is designed to efficiently capture historical pull request data for large repositories without hitting rate limits or causing system overload.

### Scripts

#### `progressive-backfill.js`

Main script that orchestrates the progressive backfill process.

**Features:**
- Automatic detection of repositories needing backfill (>100 PRs, <80% complete)
- Chunk-based processing to avoid timeouts and rate limits
- Comprehensive error tracking and reporting
- Automatic recovery from failures
- Progress tracking in database

**Usage:**
```bash
node scripts/github-actions/progressive-backfill.js \
  --chunk-size=25 \
  --repository-id=123 \
  --max-chunks=10 \
  --dry-run
```

**Options:**
- `--repository-id <id>`: Process specific repository (optional)
- `--chunk-size <size>`: Override chunk size (default: 25)
- `--max-chunks <count>`: Maximum chunks per run (default: 10)
- `--dry-run`: Run without making changes

**Environment Variables Required:**
- `VITE_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key for database access
- `GITHUB_TOKEN`: GitHub API token
- `GITHUB_OUTPUT`: GitHub Actions output file (automatically set)

**Error Handling:**
- Tracks all errors during execution
- Reports error summary at the end of each run
- Outputs error count and details to GitHub Actions
- Creates GitHub issues for critical errors
- Handles rate limit errors gracefully

### Supporting Libraries

#### `lib/chunk-calculator.js`
Calculates optimal chunk sizes based on:
- Repository size
- Current rate limits
- Processing priority

#### `lib/progress-tracker.js`
Manages backfill progress in the database:
- Updates processed PR count
- Records last processed cursor
- Tracks consecutive errors
- Manages backfill status

#### `lib/chunk-recovery.js`
Recovers stuck chunks from failed runs:
- Identifies chunks stuck in "processing" state
- Resets chunks older than threshold
- Prevents duplicate processing

#### `lib/graphql-client.js`
Handles GitHub GraphQL API interactions:
- Rate limit aware
- Cost estimation for queries
- Automatic retry logic
- Error handling

## Capture PR Details

### `capture-pr-details-graphql.js`

Captures detailed PR information including reviews, comments, and commits.

**Usage:**
```bash
node scripts/github-actions/capture-pr-details-graphql.js \
  --owner=microsoft \
  --repo=vscode \
  --pr-numbers=123,456,789
```

## Error Reporting

### `report-failure.js`

Creates GitHub issues when jobs fail or encounter errors.

**Features:**
- Creates new issues for failures
- Updates existing issues with new occurrences
- Mentions maintainers for attention
- Includes detailed error context

**Usage:**
```bash
node scripts/github-actions/report-failure.js \
  --job-type="progressive_backfill" \
  --repository-id="123" \
  --workflow-name="Progressive Backfill" \
  --workflow-url="https://..." \
  --error-message="Detailed error message"
```

### `lib/github-issue-reporter.js`

Library for creating and managing GitHub issues:
- Searches for existing issues
- Creates formatted issue reports
- Updates issues with new failures
- Closes issues when fixed

## Rate Limit Management

### `check-rate-limit.js`

Checks GitHub API rate limits before processing.

**Output Format:**
```
remaining=4500
limit=5000
reset=1234567890
```

## Chunk Recovery

### `recover-stuck-chunks.js`

Standalone script to recover stuck chunks.

**Usage:**
```bash
node scripts/github-actions/recover-stuck-chunks.js \
  --threshold=30 \
  --dry-run
```

## Database Schema

The progressive backfill system uses these tables:

### `progressive_backfill_state`
- `id`: UUID primary key
- `repository_id`: Foreign key to repositories
- `total_prs`: Total PRs in repository
- `processed_prs`: PRs processed so far
- `last_processed_cursor`: GraphQL cursor for pagination
- `status`: active, paused, completed, failed
- `consecutive_errors`: Error count for circuit breaking
- `chunk_size`: Current chunk size
- `metadata`: Additional data (JSON)

### `backfill_chunks`
- `id`: UUID primary key
- `repository_id`: Foreign key
- `backfill_state_id`: Foreign key
- `chunk_number`: Sequential chunk number
- `pr_numbers`: Array of PR numbers in chunk
- `status`: processing, completed, failed
- `started_at`: Processing start time
- `completed_at`: Processing end time
- `api_calls_made`: Number of API calls
- `error`: Error message if failed

## Workflow Integration

The scripts are integrated with GitHub Actions workflows:

### Progressive Backfill Workflow
Location: `.github/workflows/progressive-backfill.yml`

Runs every 30 minutes or on manual trigger. Steps:
1. Check rate limits
2. Run progressive backfill
3. Check for processing errors
4. Report errors to GitHub issues
5. Update job status in database

## Best Practices

1. **Error Handling**: Always track errors even if they're non-fatal
2. **Rate Limits**: Check before making API calls
3. **Idempotency**: Scripts should be safe to re-run
4. **Logging**: Use structured logging with clear prefixes
5. **Database Transactions**: Use proper error handling for DB operations
6. **Chunk Size**: Start small and increase based on performance

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**
   - Solution: Reduce chunk size or increase time between runs
   - Check: Current rate limit usage in logs

2. **Stuck Chunks**
   - Solution: Run chunk recovery script
   - Check: `backfill_chunks` table for "processing" status

3. **Missing PRs**
   - Solution: Check for gaps in PR numbers
   - Check: Error logs for specific PR failures

4. **Network Errors**
   - Solution: Script will retry automatically
   - Check: Error summary for patterns

### Debug Commands

```bash
# Check current backfill status
SELECT * FROM progressive_backfill_state WHERE status = 'active';

# Find stuck chunks
SELECT * FROM backfill_chunks 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '30 minutes';

# Check error patterns
SELECT repository_id, COUNT(*) as error_count 
FROM backfill_chunks 
WHERE status = 'failed' 
GROUP BY repository_id;
```

## Contributing

When adding new scripts:
1. Follow existing error handling patterns
2. Add comprehensive logging
3. Update this README
4. Add tests if applicable
5. Consider rate limits and performance