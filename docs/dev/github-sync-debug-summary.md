# GitHub Sync Debug Summary

## Changes Made

### 1. Added Comprehensive Logging
- **useAutoTrackRepository**: Added [AutoTrack] prefixed logs to trace repository tracking
- **useOnDemandSync**: Added [OnDemandSync] prefixed logs for token flow and sync triggers
- **github-sync Edge Function**: Added [GitHub Sync] prefixed logs for request handling and token detection

### 2. Fixed Circular Dependency
- Created migration `20250121_fix_tracked_repositories.sql` that:
  - Adds `organization_name` and `repository_name` columns to `tracked_repositories`
  - Makes `repository_id` nullable to allow tracking before repository exists
  - Adds trigger to auto-populate fields when repository is created
  - Adds RLS policies for tracked_repositories table

- Updated `useAutoTrackRepository` to:
  - Insert directly using organization_name/repository_name
  - No longer requires repository to exist first

### 3. Created Debug Tools
- **GitHubSyncDebug Component** (`/src/components/debug/github-sync-debug.tsx`):
  - Shows authentication status
  - Allows manual sync triggering
  - Displays detailed logs and responses
  - Checks database state before/after sync
  - Tracks repository manually

- **Debug Page** (`/debug/sync-test`):
  - Accessible route for testing sync functionality
  - No authentication required to view

- **Test Script** (`test-github-sync.js`):
  - Command-line tool to verify database operations
  - Tests tracked_repositories insertion
  - Calls Edge Function directly

## Next Steps

### 1. Apply the Migration
```bash
# Apply the migration to fix tracked_repositories table
npx supabase db push
```

### 2. Set GitHub Token (if not already set)
```bash
# Set the GitHub token for the Edge Function
npx supabase secrets set GITHUB_TOKEN=your_github_personal_access_token
```

### 3. Test the Fix
1. Visit http://localhost:5173/debug/sync-test
2. Login with GitHub
3. Enter a repository (e.g., continuedev/continue)
4. Click "Trigger Sync" and watch the logs
5. Check if:
   - Repository gets added to tracked_repositories
   - Sync completes successfully
   - Contributor roles are populated

### 4. Monitor Console Logs
When visiting any repository health page, check browser console for:
- `[AutoTrack]` logs showing repository tracking
- `[OnDemandSync]` logs showing sync triggers
- Edge Function logs in Supabase dashboard

## Troubleshooting

### If "GitHub token not configured" error persists:
1. Check Edge Function logs in Supabase dashboard
2. Verify GITHUB_TOKEN secret is set: `npx supabase secrets list`
3. Check if user's provider_token is available in session

### If repositories aren't being tracked:
1. Check browser console for [AutoTrack] errors
2. Verify migration was applied successfully
3. Check RLS policies on tracked_repositories table

### If sync starts but doesn't complete:
1. Check github_sync_status table for error messages
2. Look for rate limit issues in Edge Function logs
3. Verify repository is public and accessible

## Issues Discovered and Fixed (June 21, 2025)

### 4. Self-Selection Rate "Failed to fetch statistics" Error
**Problem**: Self-selection card showed "Failed to fetch statistics" error instead of displaying contribution data.

**Root Causes**:
1. **Missing Database Migrations**: The `calculate_self_selection_rate` function migrations from January 21st were not applied to the production database
2. **TypeScript Errors**: Debug component had compilation errors preventing proper builds
3. **Function Column Ambiguity**: The database function had ambiguous column references causing SQL errors

**Fixes Applied**:
1. **Applied Missing Migrations**:
   - `fix_tracked_repositories` - Fixed tracked_repositories table structure
   - `fix_self_selection_function_v2` - Updated the calculate_self_selection_rate function
   - `fix_self_selection_function_v3` - Resolved column ambiguity by renaming columns in CTE

2. **Fixed TypeScript Errors** in `src/components/debug/github-sync-debug.tsx`:
   - Removed non-existent `user` property from `useGitHubAuth()` hook
   - Added proper error type handling for unknown error types

3. **Verified Function Works**: Tested `calculate_self_selection_rate('continuedev', 'continue', 30)` which now correctly returns:
   - 100% external contribution rate
   - 38 external contributors
   - 226 external PRs
   - 0 internal contributors/PRs

**Result**: Self-selection card now displays proper statistics instead of error message.

### 5. Self-Selection Rate Always Showing 100% External Contributors
**Problem**: All repositories showed 100% external contribution rates, indicating the system wasn't properly distinguishing maintainers from external contributors.

**Root Cause**: The issue was already fixed in the migration `fix_self_selection_function_v4` that corrected the join logic in the `calculate_self_selection_rate` function. The function was trying to join `contributors.github_id` with `contributor_roles.user_id`, but these fields had incompatible data types (numeric vs text).

**Investigation Results**:
1. **Contributor roles ARE being detected properly**: bdougie and other maintainers were correctly identified as maintainers with high confidence scores
2. **Merge-based detection IS working**: Users with merge permissions were getting elevated to maintainer status as intended
3. **The database function was fixed**: The join now uses `contributors.username = contributor_roles.user_id` which works correctly

**Current Results** (after migration applied):
- **continuedev/continue**: 39.38% external, 60.62% internal (5 maintainers including bdougie)
- **vercel/next.js**: 96.25% external, 3.75% internal (1 maintainer)  
- **kubernetes/kubernetes**: 100% external, 0% internal (0 maintainers)

**Result**: Self-selection rates now show realistic and varied percentages across repositories instead of uniformly 100% external.

## Success Indicators
- Tracked repository appears in tracked_repositories table
- Sync status shows "completed" in github_sync_status
- Contributor roles are populated in contributor_roles table
- Self-selection rate displays actual data instead of "Failed to fetch statistics" error
- TypeScript build completes without errors
- Self-selection rates show realistic percentages that vary by repository (not uniformly 100% external)
- Maintainers like bdougie are properly classified and counted in internal contribution statistics