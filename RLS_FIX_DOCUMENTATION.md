# RLS Fix Documentation

## Summary

This document describes the fixes applied to resolve all Row Level Security (RLS) issues identified by the Supabase linter while preserving the logged-out user experience.

## Issues Fixed

### 1. SECURITY DEFINER Views (4 errors)
The following views were using `SECURITY DEFINER` which bypasses RLS:
- `contributor_stats`
- `repository_stats`
- `recent_activity`
- `share_analytics_summary`

**Fix**: Recreated all views without `SECURITY DEFINER` to respect user RLS policies.

### 2. RLS Disabled on Tables (18 errors)
The following tables had RLS disabled:
- Core tables: `reviews`, `comments`, `organizations`, `contributor_organizations`, `monthly_rankings`, `daily_activity_snapshots`, `sync_logs`, `repositories`, `pull_requests`, `contributors`
- New tables: `contributor_roles`, `github_sync_status`, `contributor_role_history`
- Partition tables: `github_events_cache_2025_01`, `github_events_cache_2025_02`, `github_events_cache_2025_03`, `github_events_cache_2025_06`

**Fix**: Enabled RLS on all tables and created appropriate policies.

## RLS Policy Structure

### Public Read Access
All tables have public read policies to preserve the logged-out user experience:
```sql
CREATE POLICY "public_read_[table]" ON [table] FOR SELECT USING (true);
```

### Authenticated Write Access
Authenticated users can insert and update data:
```sql
CREATE POLICY "auth_insert_[table]" ON [table] FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_[table]" ON [table] FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```

### Service Role Admin Access
Service role has full access for administrative tasks:
```sql
CREATE POLICY "service_delete_[table]" ON [table] FOR DELETE TO service_role USING (true);
```

## Migration File

The complete fix is in: `supabase/migrations/20250126_fix_all_rls_issues.sql`

## Testing

Use the provided test script to verify the logged-out experience:
```bash
node test-rls-logged-out.js
```

This script verifies:
- ✅ Anonymous users can READ all data (preserving progressive onboarding)
- ✅ Anonymous users CANNOT write data (security maintained)
- ✅ All views work correctly without SECURITY DEFINER

## Applying the Migration

To apply these fixes to your Supabase instance:

1. **Via Supabase Dashboard**:
   - Go to SQL Editor
   - Copy the contents of `20250126_fix_all_rls_issues.sql`
   - Run the migration

2. **Via CLI** (if available):
   ```bash
   supabase db push
   ```

## Post-Migration Verification

After applying the migration, the Supabase linter should show:
- ✅ No SECURITY DEFINER view errors
- ✅ No RLS disabled errors
- ✅ All tables have appropriate policies

## Important Notes

1. **Progressive Onboarding Preserved**: Users can still search and view data without logging in
2. **Security Maintained**: Only authenticated users can modify data
3. **Performance**: Views no longer use SECURITY DEFINER, which may slightly improve performance
4. **Future Tables**: Remember to enable RLS and create policies for any new tables