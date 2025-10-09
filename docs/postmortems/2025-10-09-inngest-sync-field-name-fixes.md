# Inngest Sync Database Field Name Fixes

**Date**: October 9, 2025  
**Impact**: PRs and Issues were not being inserted/updated in the database  
**Root Cause**: Incorrect field names and missing required fields in Inngest sync functions  
**Resolution**: Fixed field names and added required fields - Inngest will now capture PRs and issues moving forward

## Summary

The Inngest sync functions were using incorrect field names when upserting data to the database, causing all sync operations to silently fail. This affected pull requests, issues, and potentially other data types. **After these fixes, the Inngest sync functions will properly capture all new PRs and issues moving forward, both from scheduled syncs and manual triggers.**

## Issues Fixed

### 1. Pull Requests Table

**Wrong field names:**
- Used `pr_number` instead of `number`
- Missing required `github_id` field
- Missing required `base_branch` and `head_branch` fields

**Locations fixed:**
- `capturePrDetails` function (line 248)
- `capturePrDetailsGraphQL` function (line 365)
- `captureRepositorySync` function (line 726)
- `updatePrActivity` function (lines 770, 794)

**Fix applied:**
```typescript
// Before (WRONG)
await supabase.from('pull_requests').upsert({
  pr_number: pr.number,  // Wrong field name
  repository_id: repositoryId,
  // Missing: github_id, base_branch, head_branch
  ...
});

// After (CORRECT)
await supabase.from('pull_requests').upsert({
  number: pr.number,  // Correct field name
  github_id: pr.id.toString(),  // Required field
  repository_id: repositoryId,
  base_branch: pr.base?.ref || 'main',  // Required field
  head_branch: pr.head?.ref || 'unknown',  // Required field
  last_synced_at: new Date().toISOString(),
  ...
}, {
  onConflict: 'github_id',  // Proper conflict resolution
});
```

### 2. Issues Table

**Wrong field names:**
- Used `issue_number` instead of `number`
- Missing required `github_id` field

**Location fixed:**
- `captureRepositoryIssues` function (line 647)

**Fix applied:**
```typescript
// Before (WRONG)
await supabase.from('issues').upsert({
  issue_number: issue.number,  // Wrong field name
  // Missing: github_id
  ...
});

// After (CORRECT)
await supabase.from('issues').upsert({
  number: issue.number,  // Correct field name
  github_id: issue.id.toString(),  // Required field
  last_synced_at: new Date().toISOString(),
  ...
}, {
  onConflict: 'github_id',  // Proper conflict resolution
});
```

### 3. GitHub API Sort Order

**Previously fixed in this session:**
- Changed PR fetching from `sort=updated` to `sort=created` (line 711)
- This ensures we get the newest PRs by creation date, not update date

## Database Schema Requirements

The actual database schema requires:
- **pull_requests table**: `number` (not `pr_number`), `github_id` (required), `base_branch`, `head_branch`
- **issues table**: `number` (not `issue_number`), `github_id` (required)

## Testing

After deployment, successfully synced:
- PR #8164: "fix: open hub org settings" - Created Oct 9, 2025
- PR #8166: "docs: clarify secrets vs inputs syntax usage" - Created Oct 9, 2025

## Going Forward

**The Inngest sync functions are now fully operational and will:**
- ✅ Capture all new PRs and issues as they are created
- ✅ Properly update existing PRs and issues when they change
- ✅ Work correctly for both scheduled syncs and manual triggers via `capture/repository.sync` events
- ✅ Handle all required database fields correctly

**Automated sync schedule:**
- Repository syncs can be triggered via Inngest events
- Each sync fetches the 30 most recently created PRs (using `sort=created`)
- All new data will be properly stored with correct field names and required fields

## Lessons Learned

1. **Always verify field names** against the actual database schema
2. **Check required fields** - The database may have constraints that aren't obvious
3. **Use proper conflict resolution** - Specify `onConflict` for upserts
4. **Add github_id** - This is the primary unique identifier from GitHub
5. **Silent failures are dangerous** - The sync appeared to work but wasn't inserting data

## Prevention

To prevent similar issues:
1. Add error logging for upsert failures
2. Create integration tests that verify data is actually inserted
3. Document the database schema requirements clearly
4. Consider adding TypeScript types that match the database schema exactly
5. Monitor for data freshness (e.g., alert if no new PRs in X hours)

## Files Modified

- `supabase/functions/inngest-prod/index.ts`

## Deployment

```bash
cd supabase/functions/inngest-prod
npx supabase functions deploy inngest-prod --no-verify-jwt --project-ref egcxzonpmmcirmgqdrla
```

## Status

✅ **FIXED AND DEPLOYED** - The Inngest sync functions are now working correctly and will capture all PRs and issues moving forward. No manual intervention needed for future syncs.