# Workspace Data Fetching Migration

## Overview
This migration implements Phase 1 of the workspace data fetching feature, adding infrastructure for workspace-specific data collection including issues, commit activity, and repository metadata.

## Migration File
- **File**: `20250125000000_workspace_data_fetching.sql`
- **Dependencies**: Requires existing `workspaces`, `tracked_repositories`, and `repositories` tables

## What This Migration Does

### 1. Creates New Tables

#### workspace_tracked_repositories
- Links workspaces to tracked repositories (many-to-many)
- Stores workspace-specific sync settings
- Tracks sync status and history
- Implements priority scoring for sync ordering

#### daily_activity_metrics
- Stores daily aggregated metrics per repository
- Includes commit, PR, and issue statistics
- Used for activity charts in workspace UI

#### workspace_issues_cache
- Caches aggregated issue metrics at workspace level
- Improves query performance for workspace dashboards
- Configurable cache TTL (default 1 hour)

### 2. Adds Repository Metadata Fields
Enhances the `repositories` table with:
- `avatar_url` - Repository logo/avatar
- `homepage_url` - Repository website
- `topics` - GitHub topics array
- `is_template`, `is_fork` - Repository type flags
- `has_issues`, `has_projects`, `has_wiki`, `has_discussions` - Feature flags

### 3. Creates Helper Functions
- `calculate_workspace_repo_priority()` - Dynamic priority scoring
- `get_workspace_repos_for_sync()` - Efficient sync queue retrieval  
- `update_workspace_sync_status()` - Sync status management

### 4. Adds Performance Indexes
- 14 strategic indexes for optimal query performance
- Partial indexes for common query patterns
- GIN index for topics array searching

## How to Apply

### Production (via Supabase Dashboard)
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `20250125000000_workspace_data_fetching.sql`
3. Paste and run in SQL Editor
4. Verify tables created: Check Table Editor

### Local Development
```bash
# Start Supabase locally
supabase start

# Apply migration
supabase db push

# Or apply directly
supabase db execute --file supabase/migrations/20250125000000_workspace_data_fetching.sql
```

### Post-Migration Steps
1. Run `scripts/link-workspace-repos.sql` to link existing repositories to workspaces
2. Update environment variables if needed
3. Deploy updated Inngest functions for data fetching

## Rollback Plan
If needed, rollback with:
```sql
-- Drop new tables (CASCADE will handle dependencies)
DROP TABLE IF EXISTS workspace_tracked_repositories CASCADE;
DROP TABLE IF EXISTS daily_activity_metrics CASCADE;
DROP TABLE IF EXISTS workspace_issues_cache CASCADE;

-- Drop new functions
DROP FUNCTION IF EXISTS calculate_workspace_repo_priority CASCADE;
DROP FUNCTION IF EXISTS get_workspace_repos_for_sync CASCADE;
DROP FUNCTION IF EXISTS update_workspace_sync_status CASCADE;

-- Remove new columns from repositories
ALTER TABLE repositories 
DROP COLUMN IF EXISTS avatar_url,
DROP COLUMN IF EXISTS homepage_url,
DROP COLUMN IF EXISTS topics,
DROP COLUMN IF EXISTS is_template,
DROP COLUMN IF EXISTS is_fork,
DROP COLUMN IF EXISTS parent_repository_id,
DROP COLUMN IF EXISTS has_issues,
DROP COLUMN IF EXISTS has_projects,
DROP COLUMN IF EXISTS has_wiki,
DROP COLUMN IF EXISTS has_discussions;
```

## Testing
Use `scripts/test-workspace-migration.sql` to validate prerequisites before applying.

## Performance Considerations
- Priority scoring ensures important workspaces sync first
- Partial indexes reduce index size and improve query speed
- Cache tables prevent expensive aggregation queries
- Configurable sync frequencies prevent API rate limit issues

## Next Steps
After Phase 1 is complete:
1. Implement Inngest functions for issues capture (Phase 2)
2. Create GitHub Actions for data fetching (Phase 2)
3. Implement Supabase Edge Functions for metrics (Phase 3)