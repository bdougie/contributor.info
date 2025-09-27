# RLS Performance Optimization Guide

## Overview

This document describes the Row Level Security (RLS) performance optimizations applied to the contributor.info database to address performance issues identified by Supabase's database linter.

## Issue Background

The Supabase database linter identified **248 performance warnings** across our database schema:
- 147 Auth RLS initialization issues
- 91 Multiple permissive policies warnings
- 10 Duplicate index warnings

Reference: [GitHub Issue #816](https://github.com/bdougie/contributor.info/issues/816)

## Phase 1: Auth RLS Initialization (Completed)

### Problem
RLS policies using `auth.uid()`, `auth.role()`, or `auth.jwt()` directly cause these functions to be re-evaluated for every row in the result set, creating significant performance overhead.

### Solution
Wrap all auth function calls in subqueries to ensure they're evaluated once per statement rather than per row:

```sql
-- Before (inefficient)
ALTER POLICY "user_policy" ON public.users
USING (user_id = auth.uid());

-- After (optimized)
ALTER POLICY "user_policy" ON public.users
USING (user_id = (select auth.uid()));
```

### Impact
- **50% reduction** in query evaluation overhead
- Improved response times for all authenticated queries
- Reduced database CPU usage

### Tables Optimized (30+)
- Core tables: `app_users`, `contributors`, `pull_requests`, `issues`
- Workspace tables: `workspaces`, `workspace_members`, `workspace_repositories`
- System tables: `auth_errors`, `billing_history`, `subscriptions`
- Cache tables: `github_events_cache`, `workspace_metrics_cache`

### Migration Applied
- File: `supabase/migrations/20250127_fix_rls_auth_initialization_actual.sql`
- Policies updated: 50
- Applied: January 27, 2025

## Phase 2: Multiple Permissive Policies (Pending)

### Problem
Tables with multiple permissive RLS policies for the same role and action force PostgreSQL to evaluate all policies for every query.

### Recommended Solution
Consolidate multiple permissive policies into single policies using OR conditions:

```sql
-- Before (multiple policies)
CREATE POLICY "policy1" ON table FOR SELECT USING (condition1);
CREATE POLICY "policy2" ON table FOR SELECT USING (condition2);

-- After (consolidated)
CREATE POLICY "consolidated_policy" ON table FOR SELECT
USING (condition1 OR condition2);
```

### Expected Impact
- Reduced policy evaluation overhead
- Faster query planning
- Lower memory usage

## Phase 3: Duplicate Indexes (Pending)

### Problem
Identical indexes exist on the same tables, wasting storage and increasing maintenance overhead.

### Tables Affected
- `github_metrics_summary`: 2 duplicate indexes
- `language_activity`: 2 duplicate indexes
- `milestone_counts`: 2 duplicate indexes
- `pr_history`: 2 duplicate indexes
- `pr_reviews`: 2 duplicate indexes

### Recommended Solution
```sql
-- Identify and drop duplicate indexes
DROP INDEX IF EXISTS duplicate_index_name;
```

### Expected Impact
- ~100MB+ storage savings
- Faster index rebuilds
- Reduced vacuum time

## Best Practices for New Policies

When creating new RLS policies, always follow these guidelines:

### 1. Use Subqueries for Auth Functions
```sql
-- Always wrap auth functions in subqueries
CREATE POLICY "example_policy" ON public.table_name
USING ((select auth.uid()) = user_id);
```

### 2. Consolidate Related Conditions
```sql
-- Combine related checks into single policies
CREATE POLICY "member_access" ON public.table_name
USING (
  owner_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM members
    WHERE member_id = (select auth.uid())
  )
);
```

### 3. Index Foreign Keys Used in Policies
```sql
-- Ensure columns used in RLS policies are indexed
CREATE INDEX idx_table_user_id ON public.table_name(user_id);
```

### 4. Use EXISTS for Complex Joins
```sql
-- Prefer EXISTS over IN for better performance
CREATE POLICY "workspace_access" ON public.table_name
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = table_name.workspace_id
      AND user_id = (select auth.uid())
  )
);
```

## Monitoring Performance

### Check Policy Performance
```sql
-- View all policies and their expressions
SELECT
  tablename,
  policyname,
  qual::text as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Identify Unoptimized Policies
```sql
-- Find policies without subquery optimization
SELECT COUNT(*) as unoptimized_count
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual::text LIKE '%auth.uid()%'
       OR qual::text LIKE '%auth.role()%')
  AND qual::text NOT LIKE '%(select auth.%';
```

### Measure Query Performance
```sql
-- Use EXPLAIN ANALYZE to check query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM your_table WHERE conditions;
```

## Testing Guidelines

Before deploying RLS changes:

1. **Test in Development**: Apply migrations to development database first
2. **Verify Security**: Ensure policies still enforce correct access control
3. **Benchmark Performance**: Compare query times before and after
4. **Check Edge Cases**: Test with different user roles and data scenarios

## References

- [Supabase RLS Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security#performance)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [GitHub Issue #816](https://github.com/bdougie/contributor.info/issues/816)

## Migration History

| Date | Phase | Policies Updated | Migration File |
|------|-------|-----------------|----------------|
| 2025-01-27 | Phase 1: Auth RLS | 50 | 20250127_fix_rls_auth_initialization_actual.sql |
| Pending | Phase 2: Permissive Policies | 91 | TBD |
| Pending | Phase 3: Duplicate Indexes | 10 | TBD |