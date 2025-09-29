# Supabase Implementation Guide

This guide documents the complete process of setting up Supabase for contributor.info, including migrations, RLS policies, and testing.

## Table of Contents
1. [Initial Setup](#initial-setup)
2. [Running Migrations](#running-migrations)
3. [Implementing Row Level Security](#implementing-row-level-security)
4. [Testing & Verification](#testing--verification)
5. [Troubleshooting](#troubleshooting)
6. [Next Steps](#next-steps)

## Initial Setup

### Prerequisites
- Supabase project created at [supabase.com](https://supabase.com)
- Project URL and keys configured in `.env`
- MCP server configured in `.mcp.json` (optional but helpful)

### Environment Variables
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_TOKEN=your-service-role-key  # For admin operations
```

## Running Migrations

### Migration Options

We discovered two main approaches for applying migrations:

#### Option 1: Supabase Dashboard (Recommended for Docker issues)
1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor**
3. Copy the entire migration file: `supabase/migrations/20240614000000_initial_contributor_schema.sql`
4. Paste and run the query
5. Verify with the verification queries

#### Option 2: Supabase CLI (Requires Docker)
```bash
# Check Docker is running
docker info

# Initialize Supabase locally (if not done)
npx supabase init

# Link to your project
npx supabase link --project-ref your-project-ref

# Apply migrations
npx supabase db push
```

### What the Migration Creates

The migration establishes 11 core tables:

1. **contributors** - GitHub user information
2. **organizations** - GitHub org data
3. **repositories** - Repository metadata
4. **pull_requests** - PR information
5. **reviews** - PR review data
6. **comments** - PR and issue comments
7. **contributor_organizations** - User-org relationships
8. **tracked_repositories** - Repos being monitored
9. **monthly_rankings** - Contributor of the month data
10. **daily_activity_snapshots** - Activity trends
11. **sync_logs** - Data synchronization tracking

Plus 3 views for common queries:
- **contributor_stats** - Aggregated contributor metrics
- **repository_stats** - Repository-level statistics  
- **recent_activity** - Last 30 days of activity

### Verification After Migration

Run these queries to confirm successful migration:

```sql
-- Check all tables exist
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 11 tables

-- Verify sample data
SELECT * FROM contributors WHERE username = 'octocat';
SELECT * FROM repositories WHERE full_name = 'github/docs';

-- Test functions
SELECT calculate_weighted_score(10, 5, 20, 3, 1000, 500);
-- Expected: numeric score

-- Check views
SELECT COUNT(*) FROM contributor_stats;
SELECT COUNT(*) FROM repository_stats;
```

## Implementing Row Level Security

### Key Learning: RLS Preserves Progressive Onboarding

We discovered that RLS with public read access **does not** interfere with the app's progressive onboarding flow:

- **First search**: Works without login (public read from Supabase)
- **Second search**: App logic requires login (not database restriction)
- **Key insight**: The login requirement is enforced by the React app, not the database

### Standard RLS Policy Patterns

The contributor.info project follows these standard RLS policy patterns for consistent security across all tables:

#### Pattern 1: Core Data Tables (Contributors, Repositories, Pull Requests)
```sql
-- 1. Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Public read access (preserves progressive onboarding)
CREATE POLICY "public_read_table_name"
ON table_name FOR SELECT
USING (true);

-- 3. Authenticated users can write
CREATE POLICY "service_and_auth_insert_table_name"
ON table_name FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_table_name"
ON table_name FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 4. Only service role can delete (for cleanup)
CREATE POLICY "service_delete_table_name"
ON table_name FOR DELETE
TO service_role
USING (true);
```

#### Pattern 2: User Management Tables (Workspaces, Members)
```sql
-- Enable RLS
ALTER TABLE workspace_table ENABLE ROW LEVEL SECURITY;

-- Users can only see their own workspaces/data
CREATE POLICY "user_read_own_workspace_table"
ON workspace_table FOR SELECT
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() IN (
    SELECT user_id FROM workspace_members 
    WHERE workspace_id = workspace_table.workspace_id
));

-- Users can only modify their own data
CREATE POLICY "user_write_own_workspace_table"
ON workspace_table FOR INSERT/UPDATE
TO authenticated
WITH CHECK (auth.uid() = owner_id);
```

#### Pattern 3: System/Admin Tables (Logs, Metrics, Configuration)
```sql
-- Enable RLS
ALTER TABLE system_table ENABLE ROW LEVEL SECURITY;

-- Only service role can access system tables
CREATE POLICY "service_manage_system_table"
ON system_table FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Optional: Allow authenticated users to read status/logs
CREATE POLICY "auth_read_system_table"
ON system_table FOR SELECT
TO authenticated
USING (true);
```

#### Pattern 4: Tracking/Analytics Tables
```sql
-- Enable RLS
ALTER TABLE tracking_table ENABLE ROW LEVEL SECURITY;

-- Public read for transparency
CREATE POLICY "public_read_tracking_table"
ON tracking_table FOR SELECT
USING (true);

-- Only service role can write tracking data
CREATE POLICY "service_write_tracking_table"
ON tracking_table FOR INSERT/UPDATE
TO service_role
WITH CHECK (true);
```

### Applying RLS Policies

1. Run the complete RLS script: `supabase/apply-rls-policies.sql`
2. This creates ~50 policies across all tables
3. Maintains public read access while securing writes

### Testing RLS Implementation

#### Automated RLS Policy Tests

We created comprehensive SQL-based tests to verify RLS behavior across all tables:

**Location**: `supabase/tests/rls-policy-tests.sql`

**Test Coverage**:
- ✅ RLS enabled on all core tables (10+ tables)
- ✅ Public read access policies exist and work
- ✅ Anonymous users cannot write to any table
- ✅ Service role can read/write/delete all data
- ✅ Policy coverage verification (minimum 2 policies per table)
- ✅ Comprehensive reporting of policy status

**Running the Tests**:
```sql
-- Via Supabase Dashboard SQL Editor
-- Copy and paste: supabase/tests/rls-policy-tests.sql
-- Expected: All tests pass with ✅ messages

-- Via Supabase CLI
psql -d your_database -f supabase/tests/rls-policy-tests.sql
```

#### Manual RLS Testing

For additional verification, you can test RLS behavior programmatically:

```javascript
// test-rls-access.js
import { createClient } from '@supabase/supabase-js';

// Test with anon key (unauthenticated user)
const { data, error } = await supabase
  .from('contributors')
  .select('*');
// ✅ Should succeed - public read access

const { error: writeError } = await supabase
  .from('contributors')
  .insert({ ... });
// ❌ Should fail - no write access without auth
```

#### Test Results Interpretation

**Success Indicators**:
- All core tables show "✅ RLS Enabled"
- Public read policies exist for all core tables
- Anonymous read access works for contributors, repositories, pull_requests
- Anonymous write access fails with `insufficient_privilege` error
- Service role can perform all operations

**Failure Indicators**:
- Any table shows "❌ RLS Disabled"
- Missing public read policies
- Anonymous users can write data (security vulnerability)
- Service role cannot access system tables

## Testing & Verification

### 1. Connection Test
```javascript
node test-supabase-connection.js
```
Verifies:
- Database connection
- Table existence
- Row counts
- Sample data

### 2. RLS Access Test
```javascript
node test-rls-access.js
```
Confirms:
- Anonymous read access works
- Anonymous write access blocked
- Authenticated access patterns

### 3. Manual Verification
```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- List all policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Troubleshooting

### Common Issues We Encountered

#### 1. Docker Not Running
**Problem**: `supabase db push` fails with Docker connection error
**Solution**: Use Supabase Dashboard SQL Editor instead

#### 2. Migration Appears to Succeed but Tables Missing
**Problem**: SQL Editor shows success but tables don't exist
**Solution**: 
- Check for UUID extension: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- Run migration in smaller chunks
- Look for specific error messages in the output

#### 3. RLS Blocking All Access
**Problem**: After enabling RLS, all queries fail
**Solution**: Ensure public read policies are created:
```sql
CREATE POLICY "public_read_tablename"
ON tablename FOR SELECT USING (true);
```

#### 4. Authentication Not Working
**Problem**: Authenticated users can't write data
**Solution**: Check JWT settings and auth policies:
```sql
-- Verify auth context
SELECT current_setting('request.jwt.claims', true);
```

### Debug Queries

```sql
-- Database size check
SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb;

-- Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Recent errors
SELECT * FROM pg_stat_database WHERE datname = current_database();
```

## Next Steps

### 1. Set Up Data Synchronization
- Create GitHub webhook handlers
- Implement incremental sync functions
- Schedule regular data updates

### 2. Optimize Queries
- Add custom indexes for common queries
- Create materialized views for expensive operations
- Implement query result caching

### 3. Monitor Usage
- Set up storage alerts
- Track API usage patterns
- Monitor query performance

### 4. Implement Archival Strategy
```sql
-- Archive old data
CREATE TABLE archived_pull_requests AS 
SELECT * FROM pull_requests 
WHERE created_at < NOW() - INTERVAL '1 year';

-- Clean up main table
DELETE FROM pull_requests 
WHERE created_at < NOW() - INTERVAL '1 year';
```

## Key Learnings

1. **Supabase Dashboard is reliable** - When CLI tools fail, the web interface works
2. **RLS is non-invasive** - With proper policies, it adds security without breaking functionality
3. **Public read + authenticated write** - Perfect pattern for GitHub data
4. **Progressive onboarding preserved** - App logic controls login flow, not database
5. **Storage is manageable** - Even large repos only use ~400MB/year

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [RLS Policies](./RLS_POLICIES.md)
- [Storage Estimation](./supabase-storage-estimation.md)