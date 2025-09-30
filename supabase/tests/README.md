# RLS Policy Tests

Tests for Row Level Security policies using pgTAP.

## ⚠️ Known Issues

The test suite currently fails due to migration ordering issues:
- Migration `20240115000000` runs before `20240614000000` (initial schema)
- This causes "relation does not exist" errors
- **Fix required**: Renumber migrations to ensure proper execution order

## Running Tests

```bash
supabase test db
```

**Note**: Tests will fail until migration order is fixed.

## What's Tested

The `rls-policies.test.sql` file verifies:

1. **RLS Enabled**: All tables have RLS turned on
2. **Public Read Access**: Anonymous users can read all data (preserves progressive onboarding)
3. **Protected Writes**: Only authenticated users can insert/update data

## Coverage

Tests cover 11 tables:
- contributors
- repositories
- pull_requests
- reviews
- comments
- organizations
- contributor_organizations
- tracked_repositories
- monthly_rankings
- daily_activity_snapshots
- sync_logs

## Adding New Tests

When adding new tables with RLS policies:

1. Enable RLS in migration
2. Add public read policy
3. Add authenticated write policies
4. Update test count in `SELECT plan(N)`
5. Add tests for new table