# Row Level Security (RLS) Policies

This document outlines the recommended Row Level Security policies for the Contributor.info database schema.

## Changelog

### September 2025 - Security Advisory Fixes

#### SECURITY DEFINER Removal (September 27, 2025)
- **CRITICAL**: Removed SECURITY DEFINER from 11 remaining database views
- Fixed views: `share_analytics_summary`, `admin_check`, `backfill_progress_summary`, `contributor_stats`, `issue_comments`, `pr_comments`, `progressive_capture_stats`, `recent_activity`, `daily_citation_summary`, `repository_performance_summary`, `web_vitals_summary`
- Views now use SECURITY INVOKER (default) to properly enforce permissions based on the querying user
- Eliminates privilege escalation vulnerabilities where views could bypass RLS policies
- Resolves all remaining ERROR-level SECURITY DEFINER findings from Supabase security advisor

#### Database Cleanup (September 27, 2025)
- **CLEANUP**: Removed 11 empty and vulnerable database objects that were no longer in use
- Dropped 10 views: `trending_repositories_30d`, `trending_repositories_24h`, `trending_repositories`, `top_cited_repositories`, `repository_top_contributors`, `repository_stats`, `job_statistics`, `job_retry_status`, `webhook_metrics`, `ai_platform_performance`
- Dropped 1 table: `repository_spam_patterns`
- These objects were confirmed empty (0 rows) and represented potential security vulnerabilities
- Simplifies database schema and reduces attack surface

#### Database View Security (January 2025)
- **CRITICAL**: Removed SECURITY DEFINER from 21 database views
- Views now use default SECURITY INVOKER for proper permission enforcement
- Eliminates privilege escalation vulnerabilities where views ran with superuser privileges
- Fixed remaining views: `admin_check`, `contributor_stats`, `recent_activity`, and others still in use
- Resolves 21 ERROR-level security findings from Supabase security advisor

#### RLS Policy Fixes (January 2025)
- Enabled RLS on `rate_limit_tracking`, `data_capture_queue`, and `commits` tables
- Added appropriate access policies following existing patterns:
  - `rate_limit_tracking`: Public read access, service role management
  - `data_capture_queue`: Service role only (internal queue)
  - `commits`: Public read, authenticated write, service role delete
- Resolved security advisories identified by Supabase linter

## Overview

Row Level Security (RLS) provides fine-grained access control at the database level. For Contributor.info, we need policies that:

- Allow public read access to contributor data
- Restrict write access to authenticated users
- Protect sensitive user information
- Enable data sync operations

## Policy Categories

### 1. Public Read Access (Recommended)

Since contributor data is public on GitHub, we can safely allow public read access to most tables.

### 2. Authenticated Write Access

Only authenticated users (sync jobs, admin users) should be able to modify data.

### 3. Admin-Only Operations

Some operations like managing tracked repositories should be admin-only.

## Policy Implementation

### Contributors Table

```sql
-- Enable RLS
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all contributors
CREATE POLICY "Allow public read access to contributors"
ON contributors
FOR SELECT
USING (true);

-- Allow authenticated users to insert new contributors
CREATE POLICY "Allow authenticated users to insert contributors"
ON contributors
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update contributors
CREATE POLICY "Allow authenticated users to update contributors"
ON contributors
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to delete (for cleanup)
CREATE POLICY "Allow service role to delete contributors"
ON contributors
FOR DELETE
TO service_role
USING (true);
```

### Repositories Table

```sql
-- Enable RLS
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all repositories
CREATE POLICY "Allow public read access to repositories"
ON repositories
FOR SELECT
USING (true);

-- Allow authenticated users to insert repositories
CREATE POLICY "Allow authenticated users to insert repositories"
ON repositories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update repositories
CREATE POLICY "Allow authenticated users to update repositories"
ON repositories
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to delete
CREATE POLICY "Allow service role to delete repositories"
ON repositories
FOR DELETE
TO service_role
USING (true);
```

### Pull Requests Table

```sql
-- Enable RLS
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all pull requests
CREATE POLICY "Allow public read access to pull_requests"
ON pull_requests
FOR SELECT
USING (true);

-- Allow authenticated users to insert pull requests
CREATE POLICY "Allow authenticated users to insert pull_requests"
ON pull_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update pull requests
CREATE POLICY "Allow authenticated users to update pull_requests"
ON pull_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to delete
CREATE POLICY "Allow service role to delete pull_requests"
ON pull_requests
FOR DELETE
TO service_role
USING (true);
```

### Reviews Table

```sql
-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews
CREATE POLICY "Allow public read access to reviews"
ON reviews
FOR SELECT
USING (true);

-- Allow authenticated users to insert reviews
CREATE POLICY "Allow authenticated users to insert reviews"
ON reviews
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update reviews
CREATE POLICY "Allow authenticated users to update reviews"
ON reviews
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to delete
CREATE POLICY "Allow service role to delete reviews"
ON reviews
FOR DELETE
TO service_role
USING (true);
```

### Comments Table

```sql
-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Allow public read access to comments
CREATE POLICY "Allow public read access to comments"
ON comments
FOR SELECT
USING (true);

-- Allow authenticated users to insert comments
CREATE POLICY "Allow authenticated users to insert comments"
ON comments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update comments
CREATE POLICY "Allow authenticated users to update comments"
ON comments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to delete
CREATE POLICY "Allow service role to delete comments"
ON comments
FOR DELETE
TO service_role
USING (true);
```

### Organizations Table

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Allow public read access to organizations
CREATE POLICY "Allow public read access to organizations"
ON organizations
FOR SELECT
USING (true);

-- Allow authenticated users to insert organizations
CREATE POLICY "Allow authenticated users to insert organizations"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update organizations
CREATE POLICY "Allow authenticated users to update organizations"
ON organizations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to delete
CREATE POLICY "Allow service role to delete organizations"
ON organizations
FOR DELETE
TO service_role
USING (true);
```

### Contributor Organizations Junction Table

```sql
-- Enable RLS
ALTER TABLE contributor_organizations ENABLE ROW LEVEL SECURITY;

-- Allow public read access to contributor organization relationships
CREATE POLICY "Allow public read access to contributor_organizations"
ON contributor_organizations
FOR SELECT
USING (true);

-- Allow authenticated users to manage relationships
CREATE POLICY "Allow authenticated users to insert contributor_organizations"
ON contributor_organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update contributor_organizations"
ON contributor_organizations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete contributor_organizations"
ON contributor_organizations
FOR DELETE
TO authenticated
USING (true);
```

### Tracked Repositories (Admin-Only)

```sql
-- Enable RLS
ALTER TABLE tracked_repositories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to see which repos are tracked
CREATE POLICY "Allow public read access to tracked_repositories"
ON tracked_repositories
FOR SELECT
USING (true);

-- Only service role can manage tracked repositories
CREATE POLICY "Only service role can insert tracked_repositories"
ON tracked_repositories
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Only service role can update tracked_repositories"
ON tracked_repositories
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Only service role can delete tracked_repositories"
ON tracked_repositories
FOR DELETE
TO service_role
USING (true);
```

### Monthly Rankings Table

```sql
-- Enable RLS
ALTER TABLE monthly_rankings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to rankings
CREATE POLICY "Allow public read access to monthly_rankings"
ON monthly_rankings
FOR SELECT
USING (true);

-- Only authenticated users can insert rankings (sync jobs)
CREATE POLICY "Allow authenticated users to insert monthly_rankings"
ON monthly_rankings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only authenticated users can update rankings
CREATE POLICY "Allow authenticated users to update monthly_rankings"
ON monthly_rankings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only service role can delete rankings
CREATE POLICY "Allow service role to delete monthly_rankings"
ON monthly_rankings
FOR DELETE
TO service_role
USING (true);
```

### Daily Activity Snapshots

```sql
-- Enable RLS
ALTER TABLE daily_activity_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access to activity data
CREATE POLICY "Allow public read access to daily_activity_snapshots"
ON daily_activity_snapshots
FOR SELECT
USING (true);

-- Only authenticated users can insert activity data
CREATE POLICY "Allow authenticated users to insert daily_activity_snapshots"
ON daily_activity_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only authenticated users can update activity data
CREATE POLICY "Allow authenticated users to update daily_activity_snapshots"
ON daily_activity_snapshots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only service role can delete activity data
CREATE POLICY "Allow service role to delete daily_activity_snapshots"
ON daily_activity_snapshots
FOR DELETE
TO service_role
USING (true);
```

### Sync Logs (Admin-Only)

```sql
-- Enable RLS
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access sync logs
CREATE POLICY "Only service role can access sync_logs"
ON sync_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Optional: Allow authenticated users to view sync logs
CREATE POLICY "Allow authenticated users to read sync_logs"
ON sync_logs
FOR SELECT
TO authenticated
USING (true);
```

## Policy Application Script

Here's a complete script to apply all RLS policies:

```sql
-- Apply all RLS policies for Contributor.info
-- Run this after the initial database migration

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PUBLIC READ ACCESS POLICIES
-- =====================================================

-- Contributors
CREATE POLICY "Allow public read access to contributors"
ON contributors FOR SELECT USING (true);

-- Repositories  
CREATE POLICY "Allow public read access to repositories"
ON repositories FOR SELECT USING (true);

-- Pull Requests
CREATE POLICY "Allow public read access to pull_requests"
ON pull_requests FOR SELECT USING (true);

-- Reviews
CREATE POLICY "Allow public read access to reviews"
ON reviews FOR SELECT USING (true);

-- Comments
CREATE POLICY "Allow public read access to comments"
ON comments FOR SELECT USING (true);

-- Organizations
CREATE POLICY "Allow public read access to organizations"
ON organizations FOR SELECT USING (true);

-- Contributor Organizations
CREATE POLICY "Allow public read access to contributor_organizations"
ON contributor_organizations FOR SELECT USING (true);

-- Tracked Repositories
CREATE POLICY "Allow public read access to tracked_repositories"
ON tracked_repositories FOR SELECT USING (true);

-- Monthly Rankings
CREATE POLICY "Allow public read access to monthly_rankings"
ON monthly_rankings FOR SELECT USING (true);

-- Daily Activity
CREATE POLICY "Allow public read access to daily_activity_snapshots"
ON daily_activity_snapshots FOR SELECT USING (true);

-- =====================================================
-- AUTHENTICATED USER WRITE POLICIES
-- =====================================================

-- Contributors
CREATE POLICY "Allow authenticated users to insert contributors"
ON contributors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update contributors"
ON contributors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Repositories
CREATE POLICY "Allow authenticated users to insert repositories"
ON repositories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update repositories"
ON repositories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pull Requests
CREATE POLICY "Allow authenticated users to insert pull_requests"
ON pull_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update pull_requests"
ON pull_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Reviews
CREATE POLICY "Allow authenticated users to insert reviews"
ON reviews FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update reviews"
ON reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Comments
CREATE POLICY "Allow authenticated users to insert comments"
ON comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update comments"
ON comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Organizations
CREATE POLICY "Allow authenticated users to insert organizations"
ON organizations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update organizations"
ON organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Contributor Organizations
CREATE POLICY "Allow authenticated users to manage contributor_organizations"
ON contributor_organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Monthly Rankings
CREATE POLICY "Allow authenticated users to insert monthly_rankings"
ON monthly_rankings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update monthly_rankings"
ON monthly_rankings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Daily Activity
CREATE POLICY "Allow authenticated users to insert daily_activity_snapshots"
ON daily_activity_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update daily_activity_snapshots"
ON daily_activity_snapshots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- SERVICE ROLE ADMIN POLICIES
-- =====================================================

-- Tracked Repositories (Admin only)
CREATE POLICY "Service role can manage tracked_repositories"
ON tracked_repositories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Delete permissions for cleanup
CREATE POLICY "Service role can delete contributors"
ON contributors FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete repositories"
ON repositories FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete pull_requests"
ON pull_requests FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete reviews"
ON reviews FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete comments"
ON comments FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete organizations"
ON organizations FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete monthly_rankings"
ON monthly_rankings FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can delete daily_activity_snapshots"
ON daily_activity_snapshots FOR DELETE TO service_role USING (true);

-- Sync Logs (Service role only)
CREATE POLICY "Service role can manage sync_logs"
ON sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Optional: Allow authenticated users to read sync logs
CREATE POLICY "Authenticated users can read sync_logs"
ON sync_logs FOR SELECT TO authenticated USING (true);

-- =====================================================
-- ADDITIONAL TABLES (Added Jan 2025)
-- =====================================================

-- Rate Limit Tracking
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_rate_limit_tracking"
ON rate_limit_tracking FOR SELECT USING (true);

CREATE POLICY "service_manage_rate_limit_tracking"
ON rate_limit_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Data Capture Queue (Internal use only)
ALTER TABLE data_capture_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_data_capture_queue"
ON data_capture_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Commits
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_commits"
ON commits FOR SELECT USING (true);

CREATE POLICY "auth_insert_commits"
ON commits FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_commits"
ON commits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_delete_commits"
ON commits FOR DELETE TO service_role USING (true);
```

## Testing RLS Policies

After applying policies, test them with different user contexts:

### 1. Test Anonymous Access

```sql
-- This should work (public read)
SELECT COUNT(*) FROM contributors;

-- This should fail (no authentication)
INSERT INTO contributors (github_id, username) VALUES (999999, 'test_user');
```

### 2. Test Authenticated Access

```sql
-- Set authenticated context (use actual user ID)
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid"}';

-- This should work
INSERT INTO contributors (github_id, username) VALUES (999999, 'test_user');

-- Clean up
DELETE FROM contributors WHERE username = 'test_user';
```

### 3. Test Service Role Access

```sql
-- Set service role context
SET LOCAL role TO service_role;

-- This should work (admin operation)
INSERT INTO tracked_repositories (repository_id) 
SELECT id FROM repositories LIMIT 1;
```

## Security Considerations

### 1. Data Sensitivity

- **Public Data**: GitHub contributor data is already public
- **Personal Info**: Be careful with email addresses and private org memberships
- **API Tokens**: Never store GitHub tokens in the database

### 2. Rate Limiting

Consider implementing rate limiting policies:

```sql
-- Example: Limit insertions per user per minute
CREATE POLICY "Rate limit insertions"
ON contributors
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT COUNT(*) FROM contributors 
   WHERE created_at > NOW() - INTERVAL '1 minute'
   AND auth.uid() = created_by_user_id) < 10
);
```

### 3. Audit Trail

For sensitive operations, consider adding audit triggers:

```sql
-- Create audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example audit trigger
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id)
  VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

## Troubleshooting RLS

### Common Issues

1. **Policy Too Restrictive**: Start with permissive policies and tighten gradually
2. **Authentication Context**: Ensure proper JWT context is set
3. **Policy Conflicts**: Check for conflicting policies on the same table
4. **Performance**: RLS policies can affect query performance

### Debug Commands

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- List all policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public';

-- Test policy evaluation
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM contributors WHERE username = 'test';
```

---

These RLS policies provide a secure foundation for the Contributor.info application while maintaining the open nature of GitHub contribution data. Adjust the policies based on your specific security requirements and use cases.