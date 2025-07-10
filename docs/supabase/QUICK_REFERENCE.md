# Supabase Quick Reference

## 🚀 Common Commands

### Check Migration Status
```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Count records in each table
SELECT 
  'contributors' as table_name, COUNT(*) as count FROM contributors
UNION ALL
SELECT 'repositories', COUNT(*) FROM repositories
UNION ALL
SELECT 'pull_requests', COUNT(*) FROM pull_requests;
```

### Test Access Patterns
```javascript
// Test anonymous access (should work for reads)
const { data } = await supabase
  .from('contributors')
  .select('*')
  .limit(5);

// Test authenticated write (requires login)
const { error } = await supabase
  .from('contributors')
  .insert({ github_id: 123, username: 'test' });
```

### Apply Migrations
```bash
# Option 1: CLI (requires Docker)
npx supabase db push

# Option 2: Dashboard
# Copy supabase/migrations/20240614000000_initial_contributor_schema.sql
# Paste in SQL Editor at https://supabase.com/dashboard
```

### Apply RLS
```sql
-- Run the full script: supabase/apply-rls-policies.sql
-- Or apply basic RLS:
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON table_name FOR SELECT USING (true);
```

## 📊 Monitoring Queries

### Storage Usage
```sql
-- Database size
SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb;

-- Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC
LIMIT 10;
```

### Performance Checks
```sql
-- Slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 🔧 Common Fixes

### Reset Sample Data
```sql
-- Clear all data (CAUTION!)
TRUNCATE contributors, repositories, pull_requests CASCADE;

-- Re-insert sample data
INSERT INTO repositories (github_id, full_name, owner, name)
VALUES (1, 'github/docs', 'github', 'docs');

INSERT INTO contributors (github_id, username, display_name)
VALUES (583231, 'octocat', 'The Octocat');
```

### Fix RLS Issues
```sql
-- If locked out, disable RLS temporarily
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Re-enable with proper policies
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_select" ON table_name 
FOR SELECT USING (true);
```

### Clean Up Test Data
```sql
-- Remove test users
DELETE FROM contributors WHERE username LIKE 'test%';

-- Remove orphaned records
DELETE FROM pull_requests 
WHERE author_id NOT IN (SELECT id FROM contributors);
```

## 🎯 Key Points to Remember

1. **Public Read Access**: All tables allow anonymous SELECT
2. **Auth Required for Writes**: INSERT/UPDATE need authentication
3. **Service Role for Admin**: DELETE operations need service role
4. **Progressive Onboarding**: First search free (app logic, not RLS)
5. **Storage Limits**: 500MB free tier = ~10-20 repos for 1 year

## 📁 Important Files

- `supabase/migrations/20240614000000_initial_contributor_schema.sql` - Database schema
- `supabase/apply-rls-policies.sql` - Security policies
- `test-rls-access.js` - Test RLS implementation
- `.env` - Environment variables (don't commit!)
- `.mcp.json` - MCP server config