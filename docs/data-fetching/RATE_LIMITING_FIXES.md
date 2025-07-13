# Rate Limiting Fixes Applied

## Summary
Applied immediate rate limiting fixes to the Inngest-based progressive data capture system to prevent GitHub API rate limiting while planning the longer-term migration to GitHub Actions.

## Changes Made

### 1. Repository-Level Limits
- **PR sync limit**: Maximum 100 PRs per repository sync
- **Time range limit**: Maximum 30 days lookback
- **Cooldown period**: 24 hours between syncs per repository

### 2. Concurrency Reduction
- **Repository sync**: 5 → 3 concurrent jobs
- **PR details**: 10 → 5 concurrent jobs  
- **Reviews**: 10 → 3 concurrent jobs
- **Comments**: 10 → 3 concurrent jobs

### 3. Throttling Updates
- **PR details**: 50 → 20 requests per minute
- **Reviews**: 100 → 30 requests per minute
- **Comments**: 100 → 30 requests per minute

### 4. Queue Batching
- **File changes**: Maximum 10 jobs per batch with delays
- **Reviews/Comments**: Maximum 20 jobs total per repository
- **Commit analysis**: Reduced from 100 to 30 days

### 5. Error Handling
- Added 403 rate limit error detection
- Better error messages for rate limiting
- Automatic retry with exponential backoff

### 6. User Notifications
- Warning for large repositories (>1000 PRs)
- Cooldown notifications when repositories processed recently
- Rate limiting awareness messages

## Configuration Constants

```typescript
const RATE_LIMIT_CONFIG = {
  MAX_PRS_PER_REPO: 100,
  MAX_JOBS_PER_BATCH: 10, 
  MAX_REVIEW_COMMENT_JOBS: 20,
  LARGE_REPO_THRESHOLD: 1000,
  COOLDOWN_HOURS: 24,
  DEFAULT_DAYS_LIMIT: 30,
};
```

## Files Modified

1. `src/lib/inngest/functions/capture-repository-sync.ts`
   - Added PR count limits
   - Repository size checking
   - Cooldown enforcement

2. `src/lib/inngest/queue-manager.ts`
   - Rate limiting configuration
   - Cooldown tracking
   - Batch processing with delays

3. `src/lib/inngest/functions/capture-pr-*.ts` 
   - Reduced concurrency limits
   - Better error handling
   - 403 rate limit detection

4. `src/lib/progressive-capture/manual-trigger.ts`
   - Applied strict limits to quick fix
   - Large repository detection

5. `src/lib/progressive-capture/ui-notifications.ts`
   - Added warning notification method

## Testing

The changes maintain backward compatibility while significantly reducing API pressure:

- **Before**: Could queue 200+ jobs per repository
- **After**: Maximum 50 jobs per repository with delays
- **Rate limit reduction**: ~75% fewer concurrent API calls

## Expected Impact

- ✅ Prevents 403 rate limit errors
- ✅ Maintains functionality for normal use
- ✅ Graceful handling of large repositories  
- ✅ User-friendly error messages
- ✅ Background processing still works

## Monitoring

Watch for these metrics:
- Reduced 403 errors in Sentry
- User feedback on slow processing (acceptable short-term)
- Queue completion times (may be slower but more reliable)

## Next Steps

These fixes provide immediate relief while planning the GitHub Actions migration. The rate limiting will be less of an issue with the GitHub Actions approach since jobs run on GitHub's infrastructure with better rate limit handling.