# PR Data Corruption Fix - August 2025

## Problem Description

On August 18, 2025, PR data for the `continuedev/continue` repository started showing corrupted values with all contribution metrics (additions, deletions, changed_files, commits) showing as zeros. This affected approximately 200 PRs over a week-long period.

### Root Cause

The corruption occurred due to a misconfigured rate limiting system in the Inngest sync functions:

1. **Missing auto-fix handler**: The `inngest-prod-functions.mts` file didn't handle the `auto-fix` sync reason, defaulting to a 12-hour rate limit
2. **Overly aggressive rate limiting**: The system was preventing auto-fix syncs from running when they detected incomplete data
3. **Cascading failure**: Once data was incomplete, the rate limiter prevented fixes from running, creating a cycle

## Solution Implementation

### 1. Rate Limit Configuration Updates

#### Updated `netlify/functions/inngest-prod-functions.mts`
```typescript
// Added auto-fix case to rate limiting logic
else if (reason === 'auto-fix') {
  minHoursBetweenSyncs = 1; // Allow hourly auto-fix syncs for corrupted data
}
```

#### Updated `src/lib/progressive-capture/throttle-config.ts`
```typescript
// Changed auto-fix from 15 minutes to 1 hour for consistency
'auto-fix': getEnvNumber('VITE_THROTTLE_AUTO_FIX_HOURS', 1),
```

### 2. Data Recovery Scripts

#### `scripts/fix-corrupted-pr-data.js`
Bulk recovery script that:
- Identifies PRs with all zero values
- Fetches fresh data from GitHub API
- Updates database with correct metrics
- Processes up to 100 PRs at once with rate limiting protection

#### `scripts/fix-pr-7273.js`
Targeted fix for specific PR that:
- Fetches PR data directly from GitHub
- Updates all PR metrics in database
- Provides detailed logging of changes

## Verification

### Database Query to Check Corruption Status
```sql
WITH pr_status AS (
  SELECT 
    CASE 
      WHEN additions = 0 AND deletions = 0 AND changed_files = 0 AND commits = 0 THEN 'corrupted'
      ELSE 'fixed'
    END as status,
    COUNT(*) as count
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE r.owner = 'continuedev' AND r.name = 'continue'
    AND pr.created_at >= NOW() - INTERVAL '14 days'
  GROUP BY status
)
SELECT * FROM pr_status;
```

### Results
- **Before Fix**: 198 corrupted PRs
- **After Fix**: 0 corrupted PRs
- **Data Recovered**: 125,191 additions, 18,644 deletions, 1,819 changed files, 1,889 commits

## Prevention Measures

### 1. Smart Throttling System
The updated throttle configuration now properly handles different sync reasons:
- `manual`: 5 minutes (user-initiated)
- `auto-fix`: 1 hour (automatic recovery)
- `scheduled`: 24 hours (regular updates)
- `automatic`: 4 hours (auto-tracking)

### 2. Data Completeness Checking
The sync functions now check for data completeness and adjust throttling accordingly:
```typescript
const hasCompleteData = prData && prData.length > 0 && 
                       ((reviewCount || 0) > 0 || commentCount > 0);
const effectiveThrottleHours = hasCompleteData ? throttleHours : Math.min(throttleHours, 0.083);
```

### 3. Monitoring
Regular monitoring can detect corruption early:
```sql
-- Monitor for corrupted PRs
SELECT DATE(created_at) as date, 
       COUNT(*) FILTER (WHERE additions = 0 AND deletions = 0 AND changed_files = 0 AND commits = 0) as corrupted,
       COUNT(*) as total
FROM pull_requests
WHERE repository_id = '98b0e461-ea5c-4916-99c0-402fbff5950a'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Recovery Procedure

If corruption occurs again:

1. **Check the extent**:
   ```bash
   node scripts/check-pr-corruption.js
   ```

2. **Clear sync tracking** (via Supabase):
   ```sql
   UPDATE repositories 
   SET last_updated_at = NOW() - INTERVAL '2 hours'
   WHERE owner = 'affected_owner' AND name = 'affected_repo';
   ```

3. **Run recovery script**:
   ```bash
   node scripts/fix-corrupted-pr-data.js
   ```

4. **Verify fix**:
   ```bash
   node scripts/verify-pr-data.js
   ```

## Lessons Learned

1. **Complete sync reason handling**: Always handle all possible sync reasons explicitly
2. **Data validation**: Include data completeness checks in sync logic
3. **Recovery mechanisms**: Build automated recovery into the system
4. **Monitoring**: Implement proactive monitoring for data quality issues
5. **Rate limit balance**: Balance API usage prevention with data quality maintenance

## Related Files

- `/netlify/functions/inngest-prod-functions.mts` - Production Inngest function with rate limiting
- `/src/lib/progressive-capture/throttle-config.ts` - Centralized throttle configuration
- `/src/lib/inngest/functions/capture-repository-sync-graphql.ts` - GraphQL sync function
- `/scripts/fix-corrupted-pr-data.js` - Bulk data recovery script
- `/scripts/fix-pr-7273.js` - Targeted PR fix script

## Testing

See `/src/lib/progressive-capture/__tests__/throttle-config.test.ts` for comprehensive unit tests covering:
- Rate limit calculations
- Sync reason handling
- Data corruption detection
- Recovery mechanisms