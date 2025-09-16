# Webhook Issue: PR #310 Missing Reviewer Recommendation

## Problem
PR #310 opened on August 7, 2025, did not receive a reviewer recommendation comment from the GitHub App webhook, even though:
1. The webhook was successfully triggered (confirmed by webhook payload)
2. PR #308 had just merged the feature to add similarity comments on PR opened events
3. The `.contributor` configuration file was properly set up

## Root Cause Analysis

### Issue 1: GitHub ID Mismatch
The primary issue was a GitHub ID mismatch in the database:
- **Webhook payload GitHub ID:** `967062465` (correct)
- **Database GitHub ID:** `1483108308` (incorrect)

This mismatch caused the webhook handler to fail when looking up the repository in the database.

### Issue 2: No Similar Issues Logic
The webhook handler (`handlePROpened`) only posts comments when similar issues are found:
```typescript
// Only comment if we found similar issues
if (similarIssues.length === 0) {
  console.log('No similar issues found for PR');
  return;  // Early return - no comment posted
}
```

Since there were no issues in the database for the repository, `findSimilarIssues` returned an empty array, causing the handler to exit without posting any comment.

## Solutions

### Fix 1: Correct GitHub ID
Run the fix script to update the GitHub ID in the database:
```bash
# Script removed - use Supabase direct update instead
```

### Fix 2: Improve Webhook Handler
The improved handler (`pull-request-improved.ts`) addresses the logic issue by:
1. Checking for both similar issues AND reviewer suggestions
2. Posting a comment if either is found
3. Formatting appropriate sections based on what's available

Key improvements:
- Posts reviewer suggestions even without similar issues
- Combines both insights when available
- More robust error handling

## Verification Steps

1. **Check repository GitHub ID:**
   ```bash
   gh api repos/bdougie/contributor.info --jq '.id'
   # Should return: 967062465
   ```

2. **Run debug script:**
   ```bash
   node scripts/debug-webhook-issue.js
   ```

3. **Test webhook locally:**
   ```bash
   # Use ngrok or similar to test webhook endpoint
   netlify dev
   ```

## Recommendations

1. **Update webhook handler** to use the improved logic that posts reviewer suggestions independently
2. **Add monitoring** for webhook failures (log when repository lookups fail)
3. **Sync issues** for the repository to enable similarity matching
4. **Add fallback** to lookup repository by owner/name if GitHub ID lookup fails

## Related Files
- `/app/webhooks/pull-request.ts` - Original webhook handler
- `/app/webhooks/pull-request-improved.ts` - Improved handler with fixes
- `/scripts/debug-webhook-issue.js` - Debug script to diagnose issues
- Previous fix script has been removed after issue resolution
- `/.contributor` - Configuration file for webhook features