# Repository Tracking Guide

> **Note**: As of January 2025, repository tracking is now **manual and user-initiated**. 
> See [Manual Repository Tracking](./manual-repository-tracking.md) for the current implementation.

## Overview

The repository tracking system in contributor.info uses a relational database structure where `tracked_repositories` references `repositories` by UUID, not by owner/name strings. Tracking is initiated by users through the UI, not automatically.

## Database Structure

### repositories table
- `id`: UUID (primary key)
- `github_id`: BIGINT (GitHub's repository ID)
- `full_name`: TEXT (format: "owner/repo")
- `owner`: TEXT
- `name`: TEXT
- Other repository metadata...

### tracked_repositories table
- `id`: UUID (primary key)
- `repository_id`: UUID (foreign key to repositories.id)
- `tracking_enabled`: BOOLEAN
- `last_sync_at`: TIMESTAMPTZ
- Other tracking metadata...

## Correct Implementation Pattern

### Step 1: Ensure Repository Exists

Before tracking a repository, it must exist in the `repositories` table. This typically happens through:

1. **GitHub Sync Process**: When syncing data from GitHub, the repository is created/updated
2. **Manual Creation**: Fetching repository data from GitHub API and inserting it

### Step 2: Track Repository Using UUID

```typescript
// CORRECT: Using repository UUID
const { data: repository } = await supabase
  .from('repositories')
  .select('id')
  .eq('full_name', `${owner}/${repo}`)
  .single()

if (repository) {
  await supabase
    .from('tracked_repositories')
    .insert({
      repository_id: repository.id,
      tracking_enabled: true
    })
}
```

## Current Issue in useAutoTrackRepository

The `useAutoTrackRepository` hook incorrectly tries to use `organization_name` and `repository_name` columns that don't exist in the `tracked_repositories` table:

```typescript
// INCORRECT - These columns don't exist
.eq('organization_name', owner)
.eq('repository_name', repo)
```

## Recommended Fix

The hook should:

1. First check if the repository exists in the `repositories` table
2. If not, fetch repository data from GitHub API and create it
3. Then add to `tracked_repositories` using the repository's UUID

```typescript
// 1. Check if repository exists
const { data: repository } = await supabase
  .from('repositories')
  .select('id')
  .eq('full_name', `${owner}/${repo}`)
  .single()

if (!repository) {
  // 2. Fetch from GitHub and create repository
  const repoData = await fetchRepositoryFromGitHub(owner, repo)
  const { data: newRepo } = await supabase
    .from('repositories')
    .insert({
      github_id: repoData.id,
      full_name: repoData.full_name,
      owner: repoData.owner.login,
      name: repoData.name,
      // ... other fields
    })
    .select()
    .single()
    
  repository = newRepo
}

// 3. Track the repository
if (repository) {
  await supabase
    .from('tracked_repositories')
    .insert({
      repository_id: repository.id,
      tracking_enabled: true
    })
}
```

## Alternative Approaches

### 1. Database View
Create a view that joins repositories and tracked_repositories for easier querying:

```sql
CREATE VIEW tracked_repositories_view AS
SELECT 
  tr.*,
  r.full_name,
  r.owner,
  r.name
FROM tracked_repositories tr
JOIN repositories r ON tr.repository_id = r.id;
```

### 2. Trigger-Based Approach
Use the existing sync process which automatically creates repositories when data is synced from GitHub.

### 3. Edge Function
The `github-sync` edge function handles repository creation as part of the sync process.

## Best Practices

1. **Always use UUIDs**: The foreign key relationship requires repository_id (UUID)
2. **Check existence first**: Verify repository exists before tracking
3. **Handle GitHub API errors**: Repository fetch might fail due to rate limits or permissions
4. **Use transactions**: When creating both repository and tracking records
5. **Consider RLS policies**: Ensure proper permissions for insert operations

## Related Files

- `/supabase/migrations/20240614000000_initial_contributor_schema.sql` - Database schema
- `/src/hooks/use-on-demand-sync.ts` - Example of proper repository handling
- `/supabase/seed.sql` - Shows correct pattern for tracking repositories