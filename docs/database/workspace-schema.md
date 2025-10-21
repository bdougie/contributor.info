# Workspace Database Schema

**Last Updated:** 2025-10-21
**Migration:** `20251021000000_fix_workspace_user_relations.sql`

## Overview

The workspace feature enables users to organize repositories into collaborative workspaces with team member management, role-based access control, and invitation systems.

## Tables

### Core Tables

#### `workspaces`

Primary table storing workspace configurations.

```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    owner_id UUID NOT NULL,  -- FK to app_users.id
    visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'private')),
    tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'pro', 'private')),
    max_repositories INTEGER NOT NULL DEFAULT 4,
    current_repository_count INTEGER NOT NULL DEFAULT 0,
    data_retention_days INTEGER NOT NULL DEFAULT 30,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT workspace_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT workspace_name_length CHECK (char_length(name) BETWEEN 3 AND 100),
    CONSTRAINT workspace_slug_length CHECK (char_length(slug) BETWEEN 3 AND 50),
    CONSTRAINT workspace_repo_limit CHECK (current_repository_count <= max_repositories)
);
```

**Foreign Keys:**
- `owner_id` → `app_users.id` ON DELETE CASCADE

**Indexes:**
- `idx_workspaces_owner` ON `owner_id` WHERE `is_active = TRUE`
- `idx_workspaces_owner_id_fkey` ON `owner_id` (Added 2025-10-21)
- `idx_workspaces_slug` ON `slug` WHERE `is_active = TRUE`
- `idx_workspaces_visibility` ON `visibility` WHERE `is_active = TRUE`
- `idx_workspaces_updated` ON `updated_at DESC` WHERE `is_active = TRUE`

---

#### `workspace_members`

Stores team collaboration with role-based access control.

```sql
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,  -- FK to workspaces.id
    user_id UUID NOT NULL,       -- FK to app_users.id
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by UUID,             -- FK to app_users.id (nullable)
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,

    CONSTRAINT unique_workspace_member UNIQUE (workspace_id, user_id)
);
```

**Foreign Keys:**
- `workspace_id` → `workspaces.id` ON DELETE CASCADE
- `user_id` → `app_users.id` ON DELETE CASCADE
- `invited_by` → `app_users.id` ON DELETE SET NULL

**Indexes:**
- `idx_workspace_members_workspace` ON `workspace_id`
- `idx_workspace_members_user` ON `user_id`
- `idx_workspace_members_user_id_fkey` ON `user_id` (Added 2025-10-21)
- `idx_workspace_members_invited_by_fkey` ON `invited_by` (Added 2025-10-21)
- `idx_workspace_members_role` ON `workspace_id, role`
- `idx_workspace_members_accepted` ON `workspace_id, accepted_at` WHERE `accepted_at IS NOT NULL`

---

#### `workspace_repositories`

Junction table for many-to-many workspace-repository relationships.

```sql
CREATE TABLE workspace_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,  -- FK to workspaces.id
    repository_id UUID NOT NULL, -- FK to repositories.id
    added_by UUID,               -- FK to app_users.id (nullable, changed 2025-10-21)
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    tags TEXT[],
    is_pinned BOOLEAN DEFAULT FALSE,

    CONSTRAINT unique_workspace_repository UNIQUE (workspace_id, repository_id)
);
```

**Foreign Keys:**
- `workspace_id` → `workspaces.id` ON DELETE CASCADE
- `repository_id` → `repositories.id` ON DELETE CASCADE
- `added_by` → `app_users.id` ON DELETE SET NULL

**Indexes:**
- `idx_workspace_repos_workspace` ON `workspace_id`
- `idx_workspace_repos_repository` ON `repository_id`
- `idx_workspace_repositories_added_by_fkey` ON `added_by` (Added 2025-10-21)
- `idx_workspace_repos_pinned` ON `workspace_id, is_pinned` WHERE `is_pinned = TRUE`

**Schema Changes (2025-10-21):**
- `added_by` column changed from NOT NULL to nullable to allow orphaned reference cleanup

---

#### `workspace_invitations`

Stores pending workspace invitations.

```sql
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,     -- FK to workspaces.id
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    invitation_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    invited_by UUID NOT NULL,        -- FK to app_users.id
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);
```

**Foreign Keys:**
- `workspace_id` → `workspaces.id` ON DELETE CASCADE
- `invited_by` → `app_users.id` ON DELETE CASCADE

**Indexes:**
- `idx_invitations_workspace` ON `workspace_id`
- `idx_invitations_invited_by_fkey` ON `invited_by` (Added 2025-10-21)
- `idx_invitations_email` ON `email` WHERE `status = 'pending'`
- `idx_invitations_token` ON `invitation_token` WHERE `status = 'pending'`
- `idx_invitations_expires` ON `expires_at` WHERE `status = 'pending'`
- `unique_pending_invitation` UNIQUE INDEX ON `workspace_id, email` WHERE `status = 'pending'`

---

### Supporting Tables

#### `workspace_metrics_cache`

Performance optimization table for aggregated metrics.

```sql
CREATE TABLE workspace_metrics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,  -- FK to workspaces.id
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    time_range TEXT NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    is_stale BOOLEAN DEFAULT FALSE,

    CONSTRAINT unique_workspace_metrics_period
        UNIQUE (workspace_id, time_range, period_end)
);
```

**Indexes:**
- `idx_metrics_cache_workspace` ON `workspace_id`
- `idx_metrics_cache_lookup` ON `workspace_id, time_range, period_end`
- `idx_metrics_cache_expires` ON `expires_at` WHERE `is_stale = FALSE`

---

## Views

### `users`

**Added:** 2025-10-21
**Purpose:** Backward compatibility layer for PostgREST queries

```sql
CREATE OR REPLACE VIEW users AS
SELECT
    id,
    auth_user_id,
    email,
    display_name,
    avatar_url,
    created_at,
    updated_at
FROM app_users;
```

**Why:** The workspace service code uses PostgREST joins like `users!workspaces_owner_id_fkey` which require a `users` table/view to exist. This view provides compatibility without requiring application code changes.

**Permissions:**
- `GRANT SELECT ON users TO authenticated, anon;`

---

## Foreign Key Relationships

### Relationship Diagram

```
app_users (id)
    ↓ (owner_id, CASCADE)
    workspaces
        ↓ (workspace_id, CASCADE)
        ├── workspace_members
        │   ├─→ app_users (user_id, CASCADE)
        │   └─→ app_users (invited_by, SET NULL)
        ├── workspace_repositories
        │   ├─→ repositories (repository_id, CASCADE)
        │   └─→ app_users (added_by, SET NULL)
        ├── workspace_invitations
        │   └─→ app_users (invited_by, CASCADE)
        └── workspace_metrics_cache
```

### Cascade Behavior

**ON DELETE CASCADE:**
- When a user (`app_users`) is deleted:
  - Their owned workspaces are deleted
  - Their workspace memberships are deleted
  - Invitations they sent are deleted
- When a workspace is deleted:
  - All members are removed
  - All repository associations are removed
  - All invitations are deleted
  - All cached metrics are removed

**ON DELETE SET NULL:**
- When a user who invited a workspace member is deleted:
  - The membership record remains, but `invited_by` is set to NULL (historical tracking)
- When a user who added a repository is deleted:
  - The repository association remains, but `added_by` is set to NULL (historical tracking)

---

## Role Hierarchy

### Workspace Member Roles

| Role | Can Invite | Can Add Repos | Can Remove Repos | Can Change Settings | Can Delete Workspace |
|------|-----------|---------------|------------------|---------------------|---------------------|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `editor` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `viewer` | ❌ | ❌ | ❌ | ❌ | ❌ |

### Invitation Roles

Invitations use a subset of workspace member roles. The `owner` role cannot be assigned via invitation (only through workspace creation):

| Invitation Role | Resulting Member Role | Notes |
|-----------------|----------------------|-------|
| `admin` | `admin` | Full workspace management except deletion |
| `editor` | `editor` | Can add/remove repositories |
| `viewer` | `viewer` | Read-only access |

---

## Data Integrity Constraints

### Check Constraints

1. **Workspace Slug Format:** Must be lowercase alphanumeric with hyphens
   ```sql
   CHECK (slug ~ '^[a-z0-9-]+$')
   ```

2. **Name/Slug Length:** Between 3-100 characters (name), 3-50 characters (slug)
   ```sql
   CHECK (char_length(name) BETWEEN 3 AND 100)
   CHECK (char_length(slug) BETWEEN 3 AND 50)
   ```

3. **Repository Count:** Cannot exceed max_repositories
   ```sql
   CHECK (current_repository_count <= max_repositories)
   ```

4. **Visibility:** Must be 'public' or 'private'
5. **Tier:** Must be 'free', 'pro', or 'private'
6. **Member Role:** Must be 'owner', 'admin', 'editor', or 'viewer'
7. **Invitation Status:** Must be 'pending', 'accepted', 'rejected', or 'expired'

### Unique Constraints

1. **workspace.slug:** Globally unique workspace identifier
2. **workspace_members.(workspace_id, user_id):** One membership per user per workspace
3. **workspace_repositories.(workspace_id, repository_id):** One repo per workspace
4. **workspace_invitations.(workspace_id, email) WHERE status='pending':** One pending invite per email per workspace
5. **workspace_invitations.invitation_token:** Unique invitation tokens

---

## Migration History

### 2025-10-21: Workspace User Relations Fix

**Migration:** `20251021000000_fix_workspace_user_relations.sql`
**Issue:** [#1147](https://github.com/bdougie/contributor.info/issues/1147)

**Changes:**
1. Created `users` view for PostgREST compatibility
2. Added 5 foreign key constraints
3. Added 5 performance indexes
4. Migrated orphaned data (workspaces using auth_user_id instead of app_users.id)
5. Made `workspace_repositories.added_by` nullable
6. Cleaned up null UUID placeholders

**Impact:**
- Fixed workspace creation errors
- Improved data integrity
- Better query performance
- No breaking changes to application code

See: `docs/migrations/2025-10-workspace-user-relations-fix.md`

---

## Performance Considerations

### Index Usage

All foreign keys have covering indexes for optimal JOIN performance:
- Owner lookups: `idx_workspaces_owner_id_fkey`
- Member lookups: `idx_workspace_members_user_id_fkey`
- Repository contributor lookups: `idx_workspace_repositories_added_by_fkey`
- Invitation sender lookups: `idx_workspace_invitations_invited_by_fkey`

### Query Optimization

**Recommended patterns:**

```sql
-- Good: Uses index on workspace_id
SELECT * FROM workspace_members
WHERE workspace_id = 'uuid-here';

-- Good: Uses composite index
SELECT * FROM workspace_members
WHERE workspace_id = 'uuid-here' AND role = 'owner';

-- Avoid: Full table scan
SELECT * FROM workspace_members
WHERE user_id IN (SELECT id FROM app_users WHERE email LIKE '%@example.com');
```

---

## Security

### Row Level Security (RLS)

All workspace tables have RLS policies enforcing:
1. Users can only see workspaces they're members of
2. Only workspace owners can delete workspaces
3. Only owners/admins can invite members
4. Only owners/admins can manage repositories

**Important**: RLS policies use `auth.uid()` which returns `auth.users.id` (stored as `app_users.auth_user_id`). Since foreign keys reference `app_users.id` (which is different), RLS policies must map between these IDs:

```sql
-- Pattern used in RLS policies
WHERE user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
```

This mapping is necessary because:
- `auth.uid()` → returns `auth.users.id` (UUID from Supabase Auth)
- `app_users.auth_user_id` → stores this same value
- `app_users.id` → separate primary key used in foreign keys
- Without mapping, comparisons like `added_by = auth.uid()` fail

### Data Exposure

The `users` view only exposes non-sensitive user fields:
- ✅ Exposed: `id`, `email`, `display_name`, `avatar_url`, timestamps
- ❌ Hidden: `github_user_id`, `is_admin`, `last_login_at`

---

## Related Documentation

- [Workspace Migrations Status](../supabase/workspace-migrations-status.md)
- [Migration Guide: Workspace User Relations](../migrations/2025-10-workspace-user-relations-fix.md)
- [Workspace Service Implementation](../../src/services/workspace.service.ts)
- [RLS Policy Quick Reference](./rls-policy-quick-reference.md)
