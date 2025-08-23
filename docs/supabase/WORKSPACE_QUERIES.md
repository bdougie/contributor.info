# Workspace Database Queries Reference

## Overview

The workspace feature allows users to create and manage collections of repositories with team collaboration capabilities. This document provides common SQL queries and Supabase client examples for working with workspaces.

## Table Structure

- `workspaces` - Main workspace configurations
- `workspace_repositories` - Junction table linking workspaces to repositories
- `workspace_members` - Team members and their roles
- `workspace_metrics_cache` - Cached aggregated metrics
- `workspace_invitations` - Pending invitations

## Common Queries

### Create a New Workspace

```sql
-- Create workspace
INSERT INTO workspaces (name, slug, description, owner_id, visibility)
VALUES ('My Workspace', 'my-workspace', 'Description here', auth.uid(), 'public')
RETURNING *;

-- Add owner as member
INSERT INTO workspace_members (workspace_id, user_id, role, accepted_at)
VALUES ([workspace_id], auth.uid(), 'owner', NOW());
```

### Get Workspace with Stats

```sql
SELECT 
    w.*,
    COUNT(DISTINCT wr.repository_id) as repository_count,
    COUNT(DISTINCT wm.user_id) as member_count,
    SUM(r.stargazers_count) as total_stars
FROM workspaces w
LEFT JOIN workspace_repositories wr ON w.id = wr.workspace_id
LEFT JOIN repositories r ON wr.repository_id = r.id
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.accepted_at IS NOT NULL
WHERE w.slug = 'my-workspace' AND w.is_active = TRUE
GROUP BY w.id;
```

### List User's Workspaces

```sql
-- Get workspaces where user is owner or member
SELECT DISTINCT w.*
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE w.is_active = TRUE
  AND (w.owner_id = auth.uid() 
       OR (wm.user_id = auth.uid() AND wm.accepted_at IS NOT NULL))
ORDER BY w.updated_at DESC;
```

### Add Repository to Workspace

```sql
INSERT INTO workspace_repositories (workspace_id, repository_id, added_by, tags, is_pinned)
VALUES (
    [workspace_id],
    [repository_id],
    auth.uid(),
    ARRAY['typescript', 'frontend'],
    false
)
ON CONFLICT (workspace_id, repository_id) DO NOTHING
RETURNING *;
```

### Get Workspace Repositories with Details

```sql
SELECT 
    wr.*,
    r.full_name,
    r.description,
    r.language,
    r.stargazers_count,
    r.forks_count,
    r.open_issues_count,
    c.username as added_by_username
FROM workspace_repositories wr
JOIN repositories r ON wr.repository_id = r.id
LEFT JOIN contributors c ON wr.added_by = c.id
WHERE wr.workspace_id = [workspace_id]
ORDER BY wr.is_pinned DESC, wr.added_at DESC;
```

### Invite Member to Workspace

```sql
-- Create invitation
INSERT INTO workspace_invitations (
    workspace_id, 
    email, 
    role, 
    invited_by,
    expires_at
)
VALUES (
    [workspace_id],
    'user@example.com',
    'editor',
    auth.uid(),
    NOW() + INTERVAL '7 days'
)
RETURNING invitation_token;
```

### Accept Invitation

```sql
-- Update invitation status
UPDATE workspace_invitations
SET status = 'accepted', accepted_at = NOW()
WHERE invitation_token = [token] AND status = 'pending';

-- Add member
INSERT INTO workspace_members (
    workspace_id,
    user_id,
    role,
    invited_by,
    invited_at,
    accepted_at
)
SELECT 
    workspace_id,
    auth.uid(),
    role,
    invited_by,
    invited_at,
    NOW()
FROM workspace_invitations
WHERE invitation_token = [token];
```

### Get Workspace Members

```sql
SELECT 
    wm.*,
    u.email,
    u.raw_user_meta_data->>'full_name' as display_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    iu.email as invited_by_email
FROM workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
LEFT JOIN auth.users iu ON wm.invited_by = iu.id
WHERE wm.workspace_id = [workspace_id]
ORDER BY 
    CASE wm.role 
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'editor' THEN 3
        WHEN 'viewer' THEN 4
    END,
    wm.created_at DESC;
```

### Calculate Workspace Metrics

```sql
-- Get aggregated metrics for a workspace
WITH workspace_repos AS (
    SELECT repository_id
    FROM workspace_repositories
    WHERE workspace_id = [workspace_id]
),
pr_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE state = 'open') as open_prs,
        COUNT(*) FILTER (WHERE merged = true) as merged_prs,
        COUNT(*) as total_prs,
        AVG(EXTRACT(EPOCH FROM (merged_at - created_at))/3600)::int as avg_merge_hours
    FROM pull_requests
    WHERE repository_id IN (SELECT repository_id FROM workspace_repos)
      AND created_at >= NOW() - INTERVAL '30 days'
),
issue_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE state = 'open') as open_issues,
        COUNT(*) FILTER (WHERE state = 'closed') as closed_issues,
        COUNT(*) as total_issues
    FROM issues
    WHERE repository_id IN (SELECT repository_id FROM workspace_repos)
      AND created_at >= NOW() - INTERVAL '30 days'
),
contributor_stats AS (
    SELECT COUNT(DISTINCT author_id) as total_contributors
    FROM pull_requests
    WHERE repository_id IN (SELECT repository_id FROM workspace_repos)
      AND created_at >= NOW() - INTERVAL '30 days'
),
repo_stats AS (
    SELECT 
        SUM(stargazers_count) as total_stars,
        SUM(forks_count) as total_forks
    FROM repositories
    WHERE id IN (SELECT repository_id FROM workspace_repos)
)
SELECT 
    pr.*, 
    issue.*, 
    contrib.total_contributors,
    repo.*
FROM pr_stats pr, issue_stats issue, contributor_stats contrib, repo_stats repo;
```

### Update Workspace Activity

```sql
-- This is automatically handled by triggers, but can be manually updated
UPDATE workspaces 
SET last_activity_at = NOW()
WHERE id = [workspace_id];
```

## JavaScript/TypeScript Examples

### Using the Workspace Client

```typescript
import { 
    createWorkspace,
    getWorkspace,
    listWorkspaces,
    addRepositoryToWorkspace,
    inviteMemberToWorkspace 
} from '@/lib/workspace/workspace-client';

// Create a workspace
const workspace = await createWorkspace({
    name: 'My Team Workspace',
    description: 'Tracking our open source contributions',
    visibility: 'public'
});

// Get workspace by slug
const workspaceDetails = await getWorkspace('my-team-workspace');

// List user's workspaces
const myWorkspaces = await listWorkspaces({
    owned_by_me: true,
    sort_by: 'updated_at',
    sort_order: 'desc'
});

// Add repository
await addRepositoryToWorkspace(workspace.id, {
    repository_id: 'repo-uuid-here',
    tags: ['frontend', 'typescript'],
    is_pinned: true
});

// Invite team member
await inviteMemberToWorkspace(workspace.id, {
    email: 'teammate@example.com',
    role: 'editor'
});
```

### Direct Supabase Queries

```typescript
import { supabase } from '@/lib/supabase';

// Get workspace with member count
const { data, error } = await supabase
    .from('workspaces')
    .select(`
        *,
        workspace_members!inner(count),
        workspace_repositories(
            repository:repositories(
                full_name,
                stargazers_count
            )
        )
    `)
    .eq('slug', 'my-workspace')
    .single();

// Check user's role in workspace
const { data: role } = await supabase
    .rpc('get_workspace_role', {
        workspace_uuid: workspaceId,
        user_uuid: userId
    });
```

## RLS Policies Summary

### Workspaces Table
- **SELECT**: Public workspaces visible to all, private only to members
- **INSERT**: Any authenticated user can create
- **UPDATE**: Owner and admins only
- **DELETE**: Owner only

### Workspace Repositories
- **SELECT**: Based on workspace visibility
- **INSERT/UPDATE/DELETE**: Editors, admins, and owners

### Workspace Members
- **SELECT**: Public workspace members visible to all
- **INSERT**: Admins and owners only
- **UPDATE**: Users can update own settings, admins can change roles
- **DELETE**: Users can remove themselves, admins can remove others

### Metrics Cache
- **SELECT**: Based on workspace visibility
- **INSERT/UPDATE/DELETE**: Service role only (for background jobs)

### Invitations
- **SELECT**: Users see their own invitations
- **INSERT**: Admins and owners only
- **UPDATE**: Invitees can accept/reject
- **DELETE**: Admins can cancel

## Performance Tips

1. **Use indexes**: All critical queries are covered by indexes
2. **Cache metrics**: Use `workspace_metrics_cache` for expensive aggregations
3. **Batch operations**: When adding multiple repositories, use bulk insert
4. **Pagination**: Always paginate when listing repositories or members
5. **Selective fields**: Only select needed fields to reduce payload size

## Migration Rollback

If needed, rollback the workspace feature:

```sql
-- Drop all workspace tables (cascades to dependencies)
DROP TABLE IF EXISTS workspace_invitations CASCADE;
DROP TABLE IF EXISTS workspace_metrics_cache CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspace_repositories CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS generate_workspace_slug(TEXT);
DROP FUNCTION IF EXISTS update_workspace_activity();
DROP FUNCTION IF EXISTS is_workspace_member(UUID, UUID);
DROP FUNCTION IF EXISTS get_workspace_role(UUID, UUID);
```