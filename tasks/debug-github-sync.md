# Debug GitHub Sync Task List

## Overview
The GitHub sync functionality is not working properly when visiting repository health pages. Users see "GitHub token not configured" error even when authenticated via GitHub.

## Current Issues
1. The `github-sync` Edge Function reports "GitHub token not configured"
2. API calls to `tracked_repositories` were failing due to incorrect column names (fixed)
3. Unclear if the GitHub token secret is properly accessible to Edge Functions
4. Need to verify the complete sync flow from UI to database

## Debug Tasks

### High Priority

- [x] **Create a debug component to test GitHub sync functionality**
  - Build a standalone component that can trigger sync manually
  - Display detailed response/error information
  - Show current authentication state

- [x] **Add logging to track the full sync flow from UI to Edge Function**
  - Log when sync is triggered in `useOnDemandSync`
  - Log Edge Function request/response
  - Log any database operations
  - Track authentication token flow

- [x] **Create a test page with manual sync trigger button**
  - Add route like `/debug/sync-test`
  - Include forms to test different sync scenarios
  - Display real-time sync status and results

### Medium Priority

- [ ] **Verify Edge Function has access to GitHub token secret**
  - Check if `GITHUB_TOKEN` environment variable is accessible
  - Test with direct Edge Function invocation
  - Verify secret was properly set with `supabase secrets set`

- [ ] **Check RLS policies for repositories and tracked_repositories tables**
  - Ensure anonymous users can read repositories
  - Verify insert policies for new repository data
  - Check if service role is required for certain operations

- [ ] **Test sync with both system token and user authentication**
  - Test sync when not logged in (should use system token)
  - Test sync when logged in with GitHub (should use user token)
  - Compare results and identify differences

## Testing Scenarios

1. **Anonymous User**: Visit repository page without being logged in
2. **Authenticated User**: Visit repository page while logged in with GitHub
3. **Direct API Call**: Use curl to call Edge Function directly
4. **Manual Trigger**: Use debug UI to trigger sync with various parameters

## Expected Outcomes

- Identify exactly where the GitHub token configuration is failing
- Determine if the issue is with Edge Function secrets or authentication flow
- Create a reliable manual sync trigger for testing
- Document the complete sync flow for future reference

## Post-Mortem: Issue Resolution (June 21, 2025)

### Root Cause Analysis
The self-selection feature was showing 0% rates due to multiple interconnected issues:

1. **Circular Dependency**: `useAutoTrackRepository` required repositories to exist in the `repositories` table before tracking, but that table was only populated by github-sync, which only synced tracked repositories.

2. **Missing Pull Request Data**: The github-sync Edge Function was processing events and detecting contributor roles, but wasn't creating pull request records needed for self-selection rate calculations.

3. **Schema Mismatch**: The RPC function `calculate_self_selection_rate` was using incorrect column names that didn't match the actual database schema.

4. **Column Name Error**: Edge Function was trying to insert `github_profile_url` into contributors table, but the column was actually named `profile_url`.

### Issues Identified and Fixed

#### 1. Database Schema Issues
- **Problem**: `tracked_repositories` table required `repository_id` (UUID) but repositories didn't exist yet
- **Solution**: Added `organization_name` and `repository_name` columns, made `repository_id` nullable, added auto-population trigger

#### 2. Missing Pull Request Processing
- **Problem**: Edge Function processed events but didn't create pull request records
- **Solution**: Added `fetchAndProcessPullRequests()` function to directly fetch PRs from GitHub API and populate `pull_requests` table

#### 3. RPC Function Schema Mismatch  
- **Problem**: `calculate_self_selection_rate` used wrong column names (`user_id`, `repository_owner`, etc.)
- **Solution**: Updated function to use correct schema (`author_id`, `repository_id`, proper JOINs)

#### 4. Column Name Correction
- **Problem**: Edge Function used `github_profile_url` but table had `profile_url`
- **Solution**: Fixed column name in contributor upsert operations

### Files Changed

1. **Database Migrations**:
   - `20250121_fix_tracked_repositories.sql` - Fixed tracked_repositories schema
   - `20250121_fix_self_selection_function_v2.sql` - Fixed RPC function

2. **React Hooks**:
   - `src/hooks/use-auto-track-repository.ts` - Removed circular dependency
   - `src/hooks/use-on-demand-sync.ts` - Added comprehensive logging

3. **Edge Function**:
   - `supabase/functions/github-sync/index.ts` - Added PR fetching, fixed schema issues

4. **Debug Tools**:
   - `src/components/debug/github-sync-debug.tsx` - New debug component
   - `/debug/sync-test` route - Debug page for testing

### Final Outcome
- ✅ 280 pull requests successfully processed for continuedev/continue
- ✅ Self-selection rate calculation returns actual percentages  
- ✅ Repository auto-tracking works without circular dependency
- ✅ Debug tools available for future troubleshooting

### Lessons Learned
1. **Test data flow end-to-end** - The sync was working but missing the final step of creating PR records
2. **Verify schema matches code** - Column name mismatches caused silent failures
3. **Add comprehensive logging** - Debug logs were crucial for identifying the issues
4. **Create debug tools early** - The debug component was invaluable for testing

### Prevention
- Added extensive logging throughout the sync pipeline
- Created debug page for manual testing and verification
- Documented the complete data flow in `github-sync-debug-summary.md`

## Related Files

- `/src/hooks/use-on-demand-sync.ts` - Main sync hook
- `/src/hooks/use-auto-track-repository.ts` - Auto-tracking logic (recently fixed)
- `/supabase/functions/github-sync/index.ts` - Edge Function implementation
- `/src/components/features/health/repository-health-card.tsx` - Where error appears