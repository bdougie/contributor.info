# Database Documentation

This folder contains documentation for database schema, queries, performance optimizations, and Row Level Security (RLS) policies for the contributor.info Supabase PostgreSQL database.

## Contents

### RLS Performance and Optimization

- **[rls-monitoring-guide.md](./rls-monitoring-guide.md)** - Comprehensive guide to RLS performance monitoring system including GitHub Actions workflows, SQL views, and policy templates
- **[rls-optimization-summary.md](./rls-optimization-summary.md)** - Summary of RLS policy optimization efforts and results
- **[rls-performance-optimization.md](./rls-performance-optimization.md)** - Detailed RLS performance optimization techniques and implementations
- **[rls-policy-consolidation-lessons.md](./rls-policy-consolidation-lessons.md)** - Lessons learned from consolidating RLS policies
- **[rls-policy-quick-reference.md](./rls-policy-quick-reference.md)** - Quick reference guide for RLS policy patterns and best practices

### Schema and Operations

- **[trigger-troubleshooting.md](./trigger-troubleshooting.md)** - Guide to debugging and troubleshooting database triggers
- **[workspace-schema.md](./workspace-schema.md)** - Workspace feature database schema documentation

## Key Concepts

### Row Level Security (RLS)

RLS policies control data access at the database row level, ensuring users only see and modify data they're authorized to access. Our RLS implementation:
- Uses optimized patterns with SELECT-wrapped auth functions
- Consolidates multiple policies to improve performance
- Includes automated monitoring via GitHub Actions
- Achieved 50-60% query performance improvement

### Monitoring and Alerts

The `monitoring` schema provides:
- `rls_policy_summary` - Policy counts and optimization status per table
- `rls_performance_metrics` - Risk assessment based on row counts and policy complexity
- `check_unoptimized_policies()` - Detects unoptimized auth function usage
- `generate_rls_report()` - Health summary reports

## Best Practices

### Writing RLS Policies

1. **Always wrap auth functions in SELECT**:
   ```sql
   -- ✅ GOOD
   USING (user_id = (SELECT auth.uid()))

   -- ❌ BAD
   USING (user_id = auth.uid())
   ```

2. **Consolidate multiple policies** for the same action:
   ```sql
   -- ✅ GOOD: Single policy with OR
   CREATE POLICY "read_all" ON table FOR SELECT
   USING (condition1 OR condition2);

   -- ❌ BAD: Multiple policies
   CREATE POLICY "read_1" ON table FOR SELECT USING (condition1);
   CREATE POLICY "read_2" ON table FOR SELECT USING (condition2);
   ```

3. **Use policy templates** from `supabase/templates/rls-policy-templates.sql`

## Performance Guidelines

### Alert Thresholds
- **Critical**: Query time increase > 20% from baseline
- **Warning**: New `auth_rls_initplan` warnings detected
- **Info**: RLS evaluation time > 100ms

### Success Metrics
- ✅ Zero auth_rls_initplan warnings
- ✅ 100% reduction in duplicate policies
- ✅ 50-60% query performance improvement
- ✅ No security regressions

## Related Documentation

- [Supabase Implementation Guide](../supabase/implementation-guide.md) - Complete Supabase setup
- [Database Optimizations](../database-optimizations/) - Database performance improvements
- [Migrations](../migrations/) - Schema migration documentation
- [Architecture](../architecture/) - System architecture patterns
