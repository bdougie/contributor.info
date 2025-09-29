# Postmortem: Workspace Data Display - RLS Policy Issue

**Date:** September 29, 2025
**Severity:** High (Complete data loss for anonymous users)
**Duration:** Unknown → Fixed
**Status:** Resolved

## Summary

Workspace tabs (Contributors, Overview, PRs) displayed zero data for anonymous users despite having data in the database. Root cause was missing RLS policy for public read access on the `pull_requests` table.

## Impact

**Affected Users:** All anonymous (non-authenticated) users
**Affected Features:**
- Contributors tab: Showed 0 contributors (should show 15)
- Overview tab: Showed 0 PRs, partial contributor count (should show 136 PRs, 174 contributors)
- PRs tab: Empty table, no metrics, no reviewer data (should show 1000 PRs with full details)

## Root Cause

The `pull_requests` table had Row Level Security (RLS) enabled but only contained a `service_role_only_all_operations` policy. This policy blocked all anonymous `SELECT` queries, preventing the frontend from fetching PR data for public users.

```sql
-- Only policy present (blocked public reads)
CREATE POLICY "service_role_only_all_operations"
ON public.pull_requests
TO service_role
USING (true)
WITH CHECK (true);
```

## Timeline

- **Initial State:** RLS enabled on `pull_requests` table without public read policy
- **Detection:** Manual testing revealed empty workspace tabs
- **Investigation:** Identified missing RLS policy via Supabase logs
- **Fix Applied:** Added public read policy
- **Verification:** Confirmed all workspace tabs display data correctly

## Resolution

Added RLS policy to allow anonymous users to read pull request data:

```sql
CREATE POLICY "allow_public_read_pull_requests"
ON public.pull_requests
FOR SELECT
TO public
USING (true);
```

**Results:**
- ✅ Contributors tab: Now shows 15 contributors with full stats
- ✅ Overview tab: Now shows 136 Open PRs, 174 Contributors
- ✅ PRs tab: Now shows full table with 1000 PRs, metrics, and reviewer distribution

## Lessons Learned

### What Went Wrong

1. **Incomplete RLS Policy Setup:** When enabling RLS on `pull_requests`, only service role access was configured
2. **Missing Test Coverage:** No automated tests verify anonymous user data access
3. **Progressive Onboarding Assumption:** Assumed all tables inherited public read like `contributors` table

### What Went Right

1. **Quick Detection:** Issue identified through manual testing before major user impact
2. **Clear Error Pattern:** Zero data across multiple tabs pointed to database-level issue
3. **Fast Resolution:** RLS policy fix was straightforward once root cause identified
4. **Supabase MCP:** Used Supabase MCP server to apply migration directly

## Action Items

- [ ] **Add RLS policy tests:** Verify public read access on all tables that should be publicly readable
- [ ] **Document RLS patterns:** Update `supabase/IMPLEMENTATION_GUIDE.md` with standard RLS policies
- [ ] **Create RLS checklist:** Add to migration process for new tables
- [ ] **Add E2E test:** Verify workspace data displays for anonymous users
- [ ] **Audit other tables:** Check if any other tables need public read policies

## Related Files

- `supabase/migrations/` - RLS policy migration
- `src/hooks/useWorkspaceContributors.ts` - Hook that queries pull_requests table
- `docs/user-experience/invisible-data-loading.md` - UX principles affected

## References

- PR: #853
- Branch: `debug/workspace-data-display`
- Supabase Docs: [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)