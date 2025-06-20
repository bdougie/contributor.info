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

- [ ] **Create a debug component to test GitHub sync functionality**
  - Build a standalone component that can trigger sync manually
  - Display detailed response/error information
  - Show current authentication state

- [ ] **Add logging to track the full sync flow from UI to Edge Function**
  - Log when sync is triggered in `useOnDemandSync`
  - Log Edge Function request/response
  - Log any database operations
  - Track authentication token flow

- [ ] **Create a test page with manual sync trigger button**
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

## Related Files

- `/src/hooks/use-on-demand-sync.ts` - Main sync hook
- `/src/hooks/use-auto-track-repository.ts` - Auto-tracking logic (recently fixed)
- `/supabase/functions/github-sync/index.ts` - Edge Function implementation
- `/src/components/features/health/repository-health-card.tsx` - Where error appears