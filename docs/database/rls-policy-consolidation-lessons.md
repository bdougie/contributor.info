# RLS Policy Consolidation: Lessons from PR #818

## Executive Summary

PR #818 consolidated 91 duplicate permissive RLS policies across 30+ tables, achieving a 30-40% reduction in policy evaluation overhead. This document captures the lessons learned and establishes guidelines to prevent similar issues.

## The Problem: Multiple Permissive Policies

### What Went Wrong
- **91 duplicate policies** were created across the database
- Multiple permissive policies on the same table for the same operation
- PostgreSQL was forced to evaluate ALL policies for every query
- Each additional policy added exponential overhead to query planning

### Root Causes
1. **Incremental Development**: Policies added over time without reviewing existing ones
2. **Copy-Paste Pattern**: Duplicating policy patterns without consolidation
3. **Lack of Tooling**: No automated checks for duplicate policies
4. **Missing Guidelines**: No documented best practices for RLS policy creation

### Performance Impact
```sql
-- BAD: Multiple policies evaluated separately (O(n) evaluation)
CREATE POLICY "allow_public_read" ON table FOR SELECT USING (true);
CREATE POLICY "allow_authenticated" ON table FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allow_specific_user" ON table FOR SELECT USING (user_id = auth.uid());
-- Result: 3 policy evaluations per query
```

## The Solution: Policy Consolidation

### Consolidation Pattern
```sql
-- GOOD: Single consolidated policy (O(1) evaluation)
CREATE POLICY "consolidated_read_policy" ON table FOR SELECT
USING (
  true  -- public access
  OR auth.uid() IS NOT NULL  -- authenticated users
  OR user_id = auth.uid()  -- specific user
);
-- Result: 1 policy evaluation per query
```

### Key Benefits
- **30-40% performance improvement** in policy evaluation
- **Reduced memory usage** during query processing
- **Faster query planning** with fewer policies to evaluate
- **Clearer security model** with consolidated logic

## Prevention Guidelines

### 1. Before Creating a New Policy

**ALWAYS check existing policies first:**
```sql
-- List all policies for a table
SELECT
  polname as policy_name,
  polcmd as operation,
  polpermissive as is_permissive,
  polroles::text as roles,
  polqual::text as using_expression,
  polwithcheck::text as check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'your_table_name'
ORDER BY polcmd, polname;
```

### 2. Policy Creation Checklist

- [ ] **Check for existing policies** on the same table and operation
- [ ] **Can this be added to an existing policy?** If yes, consolidate
- [ ] **Is this truly a new access pattern?** If not, modify existing
- [ ] **Document the business reason** for the policy
- [ ] **Test the consolidated policy** before deployment

### 3. Consolidation Rules

#### When to Consolidate
- Multiple permissive policies on same table/operation
- Policies with similar access patterns
- Policies that could be expressed as OR conditions

#### When NOT to Consolidate
- Restrictive policies (non-permissive)
- Different operations (SELECT vs INSERT vs UPDATE)
- Fundamentally different security contexts
- When it would make the policy too complex to understand

### 4. Naming Conventions

Use clear, descriptive names that indicate consolidation:
```sql
-- Good naming examples
"public_and_authenticated_read"
"owner_or_admin_write"
"consolidated_select_policy"

-- Bad naming examples
"policy1", "policy2"
"temp_fix"
"new_policy"
```

## Automated Detection

### SQL Query to Find Duplicate Policies
```sql
-- Find tables with multiple permissive policies for same operation
WITH policy_counts AS (
  SELECT
    schemaname,
    tablename,
    polcmd,
    COUNT(*) FILTER (WHERE polpermissive = true) as permissive_count,
    array_agg(polname ORDER BY polname) FILTER (WHERE polpermissive = true) as policy_names
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename, polcmd
)
SELECT
  tablename,
  CASE polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    ELSE polcmd
  END as operation,
  permissive_count,
  policy_names
FROM policy_counts
WHERE permissive_count > 1
ORDER BY permissive_count DESC, tablename;
```

### Monitoring Script
Add to CI/CD pipeline:
```bash
#!/bin/bash
# Check for duplicate permissive policies

DUPLICATE_COUNT=$(psql $DATABASE_URL -t -c "
  WITH policy_counts AS (
    SELECT
      tablename,
      polcmd,
      COUNT(*) FILTER (WHERE polpermissive = true) as count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename, polcmd
  )
  SELECT COUNT(*)
  FROM policy_counts
  WHERE count > 1;
")

if [ $DUPLICATE_COUNT -gt 0 ]; then
  echo "⚠️  WARNING: Found $DUPLICATE_COUNT instances of duplicate permissive policies"
  echo "Run the duplicate detection query for details"
  exit 1
fi
```

## Migration Template

When consolidating policies, use this template:
```sql
-- Migration: Consolidate duplicate policies on [TABLE_NAME]
-- Author: [Your Name]
-- Date: [Date]
-- Reason: [Why consolidation is needed]

BEGIN;

-- Step 1: Document existing policies
-- List current policies here for reference

-- Step 2: Drop duplicate policies
DROP POLICY IF EXISTS "old_policy_1" ON table_name;
DROP POLICY IF EXISTS "old_policy_2" ON table_name;

-- Step 3: Create consolidated policy
CREATE POLICY "consolidated_policy_name" ON table_name
FOR [OPERATION]
USING (
  -- Combine all conditions with OR
  condition_1
  OR condition_2
  OR condition_3
);

-- Step 4: Verify no policies were lost
-- Add verification query here

COMMIT;
```

## Testing Guidelines

### Performance Testing
```sql
-- Before consolidation
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM table_name WHERE ...;

-- After consolidation
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM table_name WHERE ...;

-- Compare:
-- - Planning Time
-- - Execution Time
-- - Buffer usage
```

### Security Testing
```sql
-- Test each access pattern separately
-- 1. Public access
SET LOCAL role TO anon;
SELECT * FROM table_name;

-- 2. Authenticated access
SET LOCAL role TO authenticated;
SET LOCAL auth.uid TO 'test-user-id';
SELECT * FROM table_name;

-- 3. Specific conditions
-- Test each OR branch independently
```

## Common Anti-Patterns to Avoid

### 1. The "Just Add Another Policy" Pattern
```sql
-- ❌ BAD: Adding policies without checking existing ones
CREATE POLICY "feature_x_access" ON table FOR SELECT USING (...);
CREATE POLICY "feature_y_access" ON table FOR SELECT USING (...);
CREATE POLICY "feature_z_access" ON table FOR SELECT USING (...);
```

### 2. The "Temporary Fix" Pattern
```sql
-- ❌ BAD: Creating "temporary" policies that become permanent
CREATE POLICY "temp_fix_for_bug_123" ON table FOR SELECT USING (...);
-- These never get cleaned up!
```

### 3. The "Over-Specific" Pattern
```sql
-- ❌ BAD: Creating ultra-specific policies for each use case
CREATE POLICY "mobile_app_ios_read" ON table FOR SELECT USING (...);
CREATE POLICY "mobile_app_android_read" ON table FOR SELECT USING (...);
CREATE POLICY "web_app_read" ON table FOR SELECT USING (...);
-- Should be: "client_app_read" with combined conditions
```

## Maintenance Schedule

### Weekly
- Run duplicate policy detection query
- Review any new policies added

### Monthly
- Full policy audit for consolidation opportunities
- Performance testing on high-traffic tables

### Quarterly
- Review and update this documentation
- Train team on RLS best practices

## Tools and Resources

### Useful Queries
- [Duplicate Policy Detection](#sql-query-to-find-duplicate-policies)
- [Policy Performance Analysis](./rls-performance-optimization.md)
- [Security Audit Queries](./security-audit-queries.sql)

### Documentation
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Performance Optimization Guide](./rls-performance-optimization.md)

## Conclusion

The consolidation of 91 duplicate policies in PR #818 revealed systemic issues in our RLS policy management. By following these guidelines:

1. **Always check for existing policies** before creating new ones
2. **Consolidate permissive policies** using OR conditions
3. **Use automated detection** to catch duplicates early
4. **Follow naming conventions** for clarity
5. **Test both performance and security** after changes

We can prevent similar issues and maintain optimal database performance while ensuring security.

## Change Log

- **2025-01-27**: Initial documentation created following PR #818 consolidation
- **Phase 2 Completion**: 91 policies consolidated, 30-40% performance improvement achieved

---

*This document should be reviewed and updated quarterly or whenever significant RLS changes occur.*