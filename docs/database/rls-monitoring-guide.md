# RLS Performance Monitoring Guide

## Overview

This guide describes the RLS (Row Level Security) performance monitoring system implemented for contributor.info. The monitoring ensures our RLS policies remain optimized as the codebase evolves.

## Components

### 1. GitHub Actions Workflow (`.github/workflows/rls-monitor.yml`)

Automated checks that run:
- **Weekly**: Every Monday at 3 AM UTC
- **On PRs**: When SQL files are modified
- **Manual**: Via workflow dispatch

#### What it checks:
- ✅ Unoptimized auth function patterns
- ✅ Multiple permissive policies on same table/action
- ✅ Supabase Database Linter warnings (production only)

### 2. Monitoring SQL Views (`monitoring` schema)

#### Available Views:

**`monitoring.rls_policy_summary`**
- Overview of policies per table
- Detects multiple permissive policies
- Shows optimization status

```sql
SELECT * FROM monitoring.rls_policy_summary
WHERE optimization_status != 'OK';
```

**`monitoring.rls_performance_metrics`**
- Combines policy counts with table statistics
- Risk assessment based on row count + policy complexity
- Identifies high-risk tables

```sql
SELECT * FROM monitoring.rls_performance_metrics
WHERE performance_risk IN ('High', 'Critical');
```

**`monitoring.check_unoptimized_policies()`**
- Detects auth functions without SELECT wrapper
- Returns specific issues and affected policies

```sql
SELECT * FROM monitoring.check_unoptimized_policies();
```

**`monitoring.generate_rls_report()`**
- Generates health summary report
- Shows key metrics with status indicators

```sql
SELECT * FROM monitoring.generate_rls_report();
```

### 3. Policy Templates (`supabase/templates/rls-policy-templates.sql`)

Pre-optimized templates for common patterns:
- Public read access
- Authenticated user access
- Service role access
- Workspace member access
- Owner/admin combined access
- Time-based access
- Rate limiting patterns

## Usage

### For Developers

1. **Before creating new RLS policies**, check the templates:
   ```bash
   cat supabase/templates/rls-policy-templates.sql
   ```

2. **Always wrap auth functions** in SELECT:
   ```sql
   -- ❌ BAD
   USING (user_id = auth.uid())

   -- ✅ GOOD
   USING (user_id = (SELECT auth.uid()))
   ```

3. **Consolidate multiple policies** for same action:
   ```sql
   -- ❌ BAD: Multiple policies
   CREATE POLICY "read_1" ON table FOR SELECT USING (condition1);
   CREATE POLICY "read_2" ON table FOR SELECT USING (condition2);

   -- ✅ GOOD: Single policy
   CREATE POLICY "read_all" ON table FOR SELECT
   USING (condition1 OR condition2);
   ```

### For DevOps

1. **Check monitoring dashboard**:
   ```sql
   -- Connect to Supabase SQL Editor
   SELECT * FROM monitoring.generate_rls_report();
   ```

2. **Review weekly reports**: Check GitHub Actions summary every Monday

3. **Set up alerts** (optional):
   - Configure Supabase webhooks for performance degradation
   - Monitor query execution times > 100ms

### CI/CD Integration

The workflow automatically:
1. Validates new migrations for RLS patterns
2. Blocks PRs with unoptimized auth patterns
3. Warns about multiple permissive policies
4. Generates weekly performance reports

To run manually:
```bash
gh workflow run rls-monitor.yml
```

## Metrics & Thresholds

### Alert Thresholds
- **Critical**: Query time increase > 20% from baseline
- **Warning**: New `auth_rls_initplan` warnings detected
- **Info**: RLS evaluation time > 100ms

### Success Metrics (Achieved)
- ✅ Zero auth_rls_initplan warnings
- ✅ 100% reduction in duplicate policies
- ✅ 50-60% query performance improvement
- ✅ No security regressions

## Troubleshooting

### Common Issues

1. **Workflow fails on PR**
   - Check for unwrapped auth functions
   - Look for multiple policies on same table/action
   - Review error output for specific line numbers

2. **High risk tables detected**
   - Review `monitoring.rls_performance_metrics`
   - Consider archiving old data
   - Optimize complex policies

3. **Slow queries**
   - Enable `pg_stat_statements` extension
   - Check `monitoring.rls_performance_metrics`
   - Review policy complexity scores

## Maintenance

### Weekly Tasks
- Review automated reports
- Check for new unoptimized patterns
- Monitor query performance trends

### Monthly Tasks
- Analyze high-risk tables
- Update templates with new patterns
- Review and optimize complex policies

### Quarterly Tasks
- Performance baseline review
- Policy consolidation audit
- Update monitoring thresholds

## References

- [Supabase RLS Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [Database Linter Documentation](https://supabase.com/docs/guides/database/database-linter)
- [Original Issue #820](https://github.com/bdougie/contributor.info/issues/820)
- [RLS Optimization Summary](./rls-optimization-summary.md)