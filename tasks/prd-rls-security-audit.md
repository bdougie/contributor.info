# PRD: Row Level Security (RLS) Audit and Remediation

## Progress Update (2025-01-27)

### Completed Actions:
1. ✅ **Secured 2 backup tables** with RLS (contributors_backup, contributors_replica)
2. ✅ **Dropped 7 empty tables** that had security issues:
   - _dlt_loads, _dlt_pipeline_state (RLS disabled, 0 rows)
   - commits, contributor_organizations, citation_alerts, citation_metrics, comment_commands (overly permissive, 0 rows)
3. ✅ **Identified critical exposure**: pull_requests_backup has 117,569 rows with RLS disabled

### Remaining Risk Summary:
- **5 tables** with disabled RLS containing **120,236 total rows**
- **4 tables** with overly permissive policies containing **23,121 total rows**
- **Highest priority**: pull_requests_backup (117,569 rows exposed)

## Project Overview

### Objective
Perform a comprehensive security audit of Row Level Security (RLS) policies in the Supabase database to identify and fix tables with unrestricted access or overly permissive policies.

### Background
During routine security review, potential RLS policy gaps were identified that could allow unauthorized data access. This is a **CRITICAL** security issue requiring immediate attention.

### Success Metrics
- 100% of tables containing sensitive data have RLS enabled
- All overly permissive policies replaced with properly restrictive ones
- Zero unauthorized cross-workspace data access
- All backup/replica tables properly secured
- Audit trail documented for compliance

## Current State Analysis

### Tables with RLS DISABLED (10 tables - HIGH RISK)

#### With Data (Need RLS Fix):
1. **pull_requests_backup** - 117,569 rows - CRITICAL: Large dataset exposed
2. **contributors_backup** - 9,404 rows - ✅ FIXED (Phase 1)
3. **contributors_replica** - 9,602 rows - ✅ FIXED (Phase 1)
4. **pull_requests_replica** - 1,000 rows - Needs RLS
5. **github_events_cache_2025_09** - 923 rows - Future cache partition
6. **issues_backup** - 695 rows - Needs RLS
7. **issues_replica** - 48 rows - Needs RLS
8. **_dlt_version** - 1 row - Version tracking

#### Empty Tables (Dropped):
1. ~~**_dlt_loads**~~ - 0 rows - ✅ DROPPED
2. ~~**_dlt_pipeline_state**~~ - 0 rows - ✅ DROPPED

### Tables with Overly Permissive Policies (20+ tables - MEDIUM RISK)

#### With Data (Need Policy Fix):
- **backfill_chunks** - 19,269 rows - Service role ALL = true
- **comments** - 3,841 rows - Public read, unrestricted insert/update/delete
- **app_users** - 6 rows - Public read (SELECT = true)
- **auth_errors** - 5 rows - System can insert (INSERT with_check = true)

#### Empty Tables (Dropped):
- ~~**commits**~~ - 0 rows - ✅ DROPPED
- ~~**contributor_organizations**~~ - 0 rows - ✅ DROPPED
- ~~**citation_alerts**~~ - 0 rows - ✅ DROPPED
- ~~**citation_metrics**~~ - 0 rows - ✅ DROPPED
- ~~**comment_commands**~~ - 0 rows - ✅ DROPPED

## Implementation Plan

### Phase 1: Critical Tables (Priority: HIGH)
**Target: Fix backup/replica tables that contain sensitive data**

#### Tables to Fix:
1. ✅ **contributors_backup** - Enable RLS with restrictive policies (COMPLETED)
2. ✅ **contributors_replica** - Enable RLS with restrictive policies (COMPLETED)
3. **issues_backup** - Enable RLS with restrictive policies
4. **issues_replica** - Enable RLS with restrictive policies
5. **pull_requests_backup** - Enable RLS with restrictive policies
6. **pull_requests_replica** - Enable RLS with restrictive policies

#### Policies to Apply:
- Service role only access for backup tables
- No public access
- Optional: Read-only for authenticated users with workspace membership

### Phase 2: Overly Permissive Policies (Priority: HIGH)
**Target: Replace `true` conditions with proper access controls**

#### Tables to Fix:
1. **comments** - Replace public write with authenticated-only
2. **commits** - Replace unrestricted operations with user/workspace based
3. **contributor_organizations** - Replace ALL=true with proper restrictions
4. **app_users** - Evaluate if public read is necessary

#### New Policy Patterns:
```sql
-- User-based access
auth.uid() = user_id

-- Workspace-based access
workspace_id IN (
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid()
)

-- Service role only
auth.role() = 'service_role'
```

### Phase 3: Pipeline Tables (Priority: MEDIUM)
**Target: Secure internal pipeline tables**

#### Tables to Fix:
1. **_dlt_loads** - Service role only
2. **_dlt_pipeline_state** - Service role only
3. **_dlt_version** - Service role only
4. **github_events_cache_2025_09** - Match other cache partitions

### Phase 4: Verification & Documentation (Priority: HIGH)

#### Testing Checklist:
- [ ] Verify authenticated users can only access their workspace data
- [ ] Test service role operations still function
- [ ] Confirm backup tables are protected
- [ ] Validate no public write access exists
- [ ] Check application functionality not broken

## Technical Guidelines

### RLS Policy Standards
1. **Default Deny** - Start with no access, add specific permissions
2. **Workspace Isolation** - Use workspace_id for multi-tenancy
3. **User Authentication** - Require auth.uid() for user-specific data
4. **Service Role** - Explicit check for service_role when needed
5. **No True Conditions** - Never use `true` without additional checks

### Migration Template
```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "policy_name" ON table_name;

-- Add restrictive policies
CREATE POLICY "service_only_all" ON table_name
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "workspace_members_read" ON table_name
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

## Acceptance Criteria

### Phase 1 Complete When:
- ✅ All 6 backup/replica tables have RLS enabled
- ✅ Service-role-only policies applied
- ✅ No public access to backup data
- ✅ Migration tested and applied

### Phase 2 Complete When:
- [ ] All `true` conditions replaced with proper checks
- [ ] Comments/commits have authenticated-only write
- [ ] Workspace isolation enforced
- [ ] Application still functions normally

### Phase 3 Complete When:
- [ ] Pipeline tables secured
- [ ] Cache partition policies match others
- [ ] Internal operations still function

### Phase 4 Complete When:
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Audit trail documented

## Risk Assessment

### High Risk Items:
- Backup tables with disabled RLS expose all data
- Public write access to comments/commits
- Unrestricted contributor_organizations access

### Mitigation Strategy:
1. Fix backup tables first (Phase 1)
2. Test in development before production
3. Have rollback plan ready
4. Monitor for access errors post-deployment

## Timeline
- Phase 1: Immediate (Today)
- Phase 2: Within 24 hours
- Phase 3: Within 48 hours
- Phase 4: Ongoing with each phase

## Notes
- Use Supabase MCP server for migrations
- Coordinate with team before production changes
- Document any exceptions with justification
- Consider performance impact of new policies