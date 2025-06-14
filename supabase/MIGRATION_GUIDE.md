# Migration Application Guide

This guide walks you through applying the Contributor.info database migration step-by-step.

## Pre-Flight Checklist

Before applying the migration, ensure you have:

- [ ] Supabase project created
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Project linked to your Supabase instance
- [ ] Backup of existing data (if any)
- [ ] GitHub Personal Access Token ready

## Step-by-Step Application

### Step 1: Verify Project Connection

```bash
# Check if you're connected to the right project
supabase projects list
supabase status
```

You should see your project details and local/remote status.

### Step 2: Review Migration File

The migration file is located at:
```
supabase/migrations/20240614000000_initial_contributor_schema.sql
```

**Key components:**
- 11 core tables for contributor data
- Indexes for performance optimization
- Views for common queries
- Functions for scoring algorithms
- Sample data for testing

### Step 3: Apply Migration

Choose one of these methods:

#### Method A: Supabase CLI (Recommended)

```bash
# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase migration up --target 20240614000000
```

#### Method B: Direct SQL Execution

1. Open Supabase Dashboard → SQL Editor
2. Copy the migration file contents
3. Execute the SQL query
4. Verify all tables were created

#### Method C: Use MCP Server (If configured)

```bash
# Using the MCP server from your .mcp.json
supabase migration apply initial_contributor_schema
```

### Step 4: Verify Migration Success

```bash
# List all tables
supabase db list

# Check specific tables exist
supabase db exec "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

Expected tables:
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

### Step 5: Test Sample Data

The migration includes sample data. Verify it was inserted:

```sql
-- Check sample repository
SELECT * FROM repositories WHERE full_name = 'github/docs';

-- Check sample contributor  
SELECT * FROM contributors WHERE username = 'octocat';

-- Check tracking setup
SELECT * FROM tracked_repositories;
```

### Step 6: Verify Views and Functions

```sql
-- Test contributor stats view
SELECT * FROM contributor_stats LIMIT 5;

-- Test scoring function
SELECT calculate_weighted_score(10, 5, 20, 3, 1000, 500) as test_score;

-- Test ranking function
SELECT get_contributor_rank(
  (SELECT id FROM contributors WHERE username = 'octocat'), 
  12, 2024
) as test_rank;
```

## Post-Migration Setup

### 1. Configure Row Level Security

See `RLS_POLICIES.md` for detailed RLS setup.

Quick setup for public read access:

```sql
-- Enable RLS on main tables
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to contributors" 
ON contributors FOR SELECT USING (true);

CREATE POLICY "Allow public read access to repositories" 
ON repositories FOR SELECT USING (true);

CREATE POLICY "Allow public read access to pull_requests" 
ON pull_requests FOR SELECT USING (true);
```

### 2. Set Up GitHub API Sync

Create environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_GITHUB_TOKEN=ghp_your_token_here
```

### 3. Update Application Code

Modify your app to query the database instead of direct GitHub API:

```typescript
// Before: Direct GitHub API call
const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`);

// After: Supabase query
const { data: contributors } = await supabase
  .from('contributor_stats') 
  .select('*')
  .order('total_pull_requests', { ascending: false });
```

## Migration Rollback

If you need to rollback the migration:

### Method 1: Drop All Tables

```sql
-- WARNING: This will delete all data!
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS daily_activity_snapshots CASCADE;
DROP TABLE IF EXISTS monthly_rankings CASCADE;
DROP TABLE IF EXISTS tracked_repositories CASCADE;
DROP TABLE IF EXISTS contributor_organizations CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS pull_requests CASCADE;
DROP TABLE IF EXISTS repositories CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS contributors CASCADE;

DROP VIEW IF EXISTS recent_activity;
DROP VIEW IF EXISTS repository_stats;
DROP VIEW IF EXISTS contributor_stats;

DROP FUNCTION IF EXISTS calculate_weighted_score;
DROP FUNCTION IF EXISTS get_contributor_rank;
DROP FUNCTION IF EXISTS refresh_contributor_stats;
DROP FUNCTION IF EXISTS update_last_updated_column;
```

### Method 2: Supabase CLI Rollback

```bash
# Reset to previous migration (if exists)
supabase migration down

# Or reset entire database
supabase db reset
```

## Troubleshooting

### Common Issues

#### 1. "Extension does not exist" Error

```sql
-- Manually install UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### 2. "Permission denied" Error

- Check your database user has proper permissions
- Ensure you're connected to the correct project
- Verify your access token in `.mcp.json`

#### 3. "Relation already exists" Error

```sql
-- Check if tables already exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%contributor%';

-- Drop conflicting tables if safe to do so
DROP TABLE IF EXISTS existing_table_name CASCADE;
```

#### 4. Migration Hangs or Times Out

- Check for large datasets
- Apply migration during low-traffic periods
- Consider breaking down into smaller migrations

### Verification Queries

```sql
-- Count of tables created
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verify functions exist
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%contributor%' OR proname LIKE '%weighted%';

-- Check views exist
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public';
```

## Performance Validation

After migration, run these queries to ensure good performance:

```sql
-- Test contributor lookup (should use index)
EXPLAIN ANALYZE SELECT * FROM contributors WHERE username = 'octocat';

-- Test repository query (should use index)  
EXPLAIN ANALYZE SELECT * FROM repositories WHERE full_name = 'github/docs';

-- Test join performance
EXPLAIN ANALYZE 
SELECT c.username, COUNT(pr.id) as pr_count
FROM contributors c 
LEFT JOIN pull_requests pr ON c.id = pr.author_id 
GROUP BY c.id, c.username;
```

Look for:
- Index scans instead of sequential scans
- Reasonable execution times (< 100ms for most queries)
- Proper join strategies

## Next Steps

1. ✅ **Migration Applied Successfully**
2. 🔧 **Configure RLS Policies** (see RLS_POLICIES.md)
3. 🔄 **Build Data Sync Jobs** 
4. 🧪 **Test Application Integration**
5. 📊 **Monitor Performance**
6. 🚀 **Deploy to Production**

## Getting Help

If you encounter issues:

1. Check the logs: `supabase logs`
2. Review Supabase Dashboard for errors
3. Consult [Supabase Documentation](https://supabase.com/docs)
4. Open an issue in the project repository

---

**Success!** 🎉 

Your Contributor.info database schema is now ready. The migration provides a solid foundation for storing and analyzing GitHub contributor data efficiently.