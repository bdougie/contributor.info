# SSR TTFB Investigation - Issue #1401

## Problem Statement

Lighthouse reports 930ms Time to First Byte (TTFB) for the main document SSR.

## Investigation Findings

### Schema Mismatch

The issue #1401 references `repository_contributors` table for index optimization, but **this table does not exist** in the current schema.

The SSR edge function `fetchRepoContributorStats()` in `netlify/edge-functions/_shared/supabase.ts` queries this non-existent table, which will cause failures.

### Current Table State

| Table | Exists | Description |
|-------|--------|-------------|
| `repositories` | ✅ | Has composite unique index on `(owner, name)` |
| `contributors` | ✅ | Stores contributor profiles |
| `pull_requests` | ✅ | Links repos to contributors via `author_id` |
| `repository_contributors` | ❌ | **Does not exist** |

### Existing Indexes (repositories)

- `repositories_owner_name_key` - UNIQUE on `(owner, name)` - used by SSR
- `idx_repositories_stars` - on `(stargazers_count DESC)` - for trending
- `idx_repositories_full_name` - on `(full_name)`

### Existing Indexes (pull_requests)

- `idx_pull_requests_repository` - on `(repository_id)`
- `idx_pull_requests_repository_created` - on `(repository_id, created_at DESC)`
- `idx_pull_requests_author` - on `(author_id)`

## Proposed Resolution

### Option 1: Create Denormalized Table (Recommended)

Create `repository_contributors` table to cache contributor stats per repo:

```sql
CREATE TABLE repository_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id),
  contributor_id UUID NOT NULL REFERENCES contributors(id),
  contributions INTEGER NOT NULL DEFAULT 0,
  first_contribution_at TIMESTAMPTZ,
  last_contribution_at TIMESTAMPTZ,
  UNIQUE(repository_id, contributor_id)
);

-- Indexes from issue #1401
CREATE INDEX idx_repository_contributors_repo_contrib
ON repository_contributors(repository_id, contributions DESC);

CREATE INDEX idx_repository_contributors_contributor_id
ON repository_contributors(contributor_id);
```

### Option 2: Fix SSR Query

Update `fetchRepoContributorStats()` to derive stats from `pull_requests`:

```sql
SELECT
  c.login,
  c.avatar_url,
  COUNT(*) as contributions
FROM pull_requests pr
JOIN contributors c ON pr.author_id = c.id
WHERE pr.repository_id = $1
GROUP BY c.id, c.login, c.avatar_url
ORDER BY contributions DESC
LIMIT 10;
```

### Option 3: Remove from SSR

Remove contributor stats from SSR response entirely - load via client-side API instead.

## Decision Required

Need to decide which approach before implementing Phase 1 indexes.
