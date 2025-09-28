# Postmortem: Missing Commits Table Causing Console Errors

**Date**: September 27, 2025
**Author**: Engineering Team
**Severity**: Medium
**Impact**: Data visualization features (direct commits analysis) were broken for all repositories

## Executive Summary

The `commits` table was missing from the production database, causing 400 Bad Request errors when the application tried to query commit data. Additionally, overly restrictive RLS policies on `progressive_capture_jobs` caused 403 Forbidden errors. This prevented the direct commits analysis feature from working.

## Timeline

- **Unknown Date**: Commits table was likely dropped or never properly migrated to production
- **Sept 27, 2025**: Issue discovered when loading continuedev/continue repository
- **Sept 27, 2025**: Root cause identified - missing table and RLS policy issues
- **Sept 27, 2025**: Fix implemented and deployed

## What Went Wrong

### 1. Missing Database Table
The `commits` table didn't exist in the production database despite code expecting it:
```
GET .../commits?select=sha%2Cis_direct_commit... 400 (Bad Request)
Error: "Could not find a relationship between 'commits' and 'contributors'"
```

### 2. Restrictive RLS Policies
The `progressive_capture_jobs` table had overly restrictive policies:
```
POST .../progressive_capture_jobs?select=* 403 (Forbidden)
```

### 3. No Data Population Mechanism
Even if the table existed, there was no mechanism to populate commit data from GitHub.

## Root Causes

### 1. Incomplete Migration Strategy
- A migration creating the commits table (`20250704105449_add_commits_table.sql`) was listed but the table didn't exist
- Possible causes:
  - Migration was rolled back but not removed from history
  - Table was dropped in a later migration without proper tracking
  - Migration never ran successfully in production

### 2. Lack of Schema Validation
- No automated checks to verify expected tables exist
- No alerts when database queries fail with schema errors
- Application assumed table existence without validation

### 3. Missing Data Pipeline
- Code expected commits to be in the database but no process populated them
- The `commit_pr_check` job type existed but was never triggered
- No documentation on how commits should be captured

## How It Was Fixed

### 1. Recreated the Commits Table
```sql
CREATE TABLE IF NOT EXISTS public.commits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES public.repositories(id),
    sha TEXT NOT NULL,
    author_id UUID REFERENCES public.contributors(id),
    message TEXT,
    authored_at TIMESTAMPTZ,
    is_direct_commit BOOLEAN,
    pull_request_id UUID REFERENCES public.pull_requests(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Fixed RLS Policies
```sql
-- Allow public reads and anon writes for data capture
CREATE POLICY "commits_select_all" ON public.commits FOR SELECT USING (true);
CREATE POLICY "commits_insert_all" ON public.commits FOR INSERT WITH CHECK (true);
```

### 3. Created Data Capture Utility
- Built `capture-commits.ts` to fetch commits from GitHub API
- Added `npm run populate-commits` script for easy data population
- Implemented proper error handling and duplicate management

## Lessons Learned

### What Went Well
- Error messages were descriptive enough to identify the root cause
- Supabase MCP server made it easy to apply fixes directly
- Modular architecture allowed adding data capture without major refactoring

### What Went Poorly
- No monitoring caught the missing table issue
- RLS policies were too restrictive by default
- No data population mechanism was built alongside the schema

## Action Items

### Immediate (Completed)
- [x] Recreate commits table with proper structure
- [x] Fix RLS policies for affected tables
- [x] Create data capture utility
- [x] Document the issue and resolution

### Short-term (To Do)
- [ ] Add database schema validation on application startup
- [ ] Create automated tests that verify all expected tables exist
- [ ] Add monitoring for database schema errors
- [ ] Audit other tables for similar issues

### Long-term (To Consider)
- [ ] Implement proper migration rollback tracking
- [ ] Create a data pipeline for automatic commit capture
- [ ] Add integration with GitHub webhooks for real-time updates
- [ ] Implement schema versioning and compatibility checks

## Prevention Measures

### 1. Migration Best Practices
```bash
# Always verify migrations in local environment first
npm run supabase:migrate:local

# Check migration status before deploying
npx supabase db status

# Never drop tables without a rollback plan
# Always use IF EXISTS checks
```

### 2. Add Schema Validation
```typescript
// Add to application startup
async function validateDatabaseSchema() {
  const requiredTables = ['commits', 'repositories', 'contributors'];
  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error?.code === 'PGRST200') {
      console.error(`Missing required table: ${table}`);
      // Send alert to monitoring service
    }
  }
}
```

### 3. Data Capture Automation
```typescript
// Run periodically or via GitHub webhook
async function syncRepositoryCommits(owner: string, repo: string) {
  const result = await captureCommits(owner, repo);
  if (!result.success) {
    // Alert on failure
    console.error(`Failed to sync commits for ${owner}/${repo}:`, result.error);
  }
}
```

### 4. RLS Policy Guidelines
- Start with permissive read policies for public data
- Use restrictive policies only where necessary
- Document why each policy exists
- Test policies with different authentication contexts

### 5. Monitoring Requirements
- Alert on 400 errors with "relationship not found" messages
- Alert on repeated 403 Forbidden errors
- Track database query failure rates
- Monitor for missing table errors

## Technical Details

### Affected Components
- `src/lib/progressive-capture/smart-commit-analyzer.ts`: Queries commits table
- `src/lib/supabase-direct-commits.ts`: Expects commits to exist
- Multiple queue managers expecting to process commit data

### Database Schema Dependencies
```
commits -> repositories (foreign key)
commits -> contributors (foreign key)
commits -> pull_requests (foreign key)
progressive_capture_jobs -> repositories (foreign key)
```

### Error Patterns to Monitor
```javascript
// Schema errors
error.code === 'PGRST200' // Table or relationship not found
error.code === '42P01'     // Undefined table

// Permission errors
error.code === '42501'     // RLS policy violation
response.status === 403    // Forbidden access
```

## Conclusion

This incident highlighted gaps in our database migration process and monitoring. While the fix was straightforward, the issue could have been prevented with better schema validation and monitoring. The new data capture utility provides a foundation for proper commit data management going forward.

The key takeaway is that we need to treat database schema as code - with proper version control, testing, and monitoring. Every table that code depends on should have:
1. A migration that creates it
2. A test that verifies it exists
3. A data population mechanism if needed
4. Appropriate RLS policies
5. Monitoring for access errors