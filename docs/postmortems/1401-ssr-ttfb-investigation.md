# SSR TTFB Investigation - Issue #1401

## Problem Statement

Lighthouse reports 930ms Time to First Byte (TTFB) for the main document SSR.

## Investigation Findings

### Phase 1 Status: Already Complete ✅

The `repository_contributors` table and indexes from issue #1401 **already exist** and are properly configured.

| Component | Status | Details |
|-----------|--------|---------|
| `repository_contributors` table | ✅ | 16,679 rows |
| `idx_repository_contributors_repo_contrib` | ✅ | `(repository_id, contributions DESC)` |
| `idx_repository_contributors_contributor_id` | ✅ | `(contributor_id)` |

### Current Index Coverage

**repositories table:**
- `repositories_owner_name_key` - UNIQUE on `(owner, name)` - used by SSR
- `idx_repositories_stars` - on `(stargazers_count DESC)` - for trending

**repository_contributors table:**
- `idx_repository_contributors_repo_contrib` - composite for fast lookups
- `idx_repository_contributors_contributor_id` - for JOIN optimization

**pull_requests table:**
- `idx_pull_requests_repository` - on `(repository_id)`
- `idx_pull_requests_repository_created` - on `(repository_id, created_at DESC)`

## Next Steps

Phase 1 (database indexes) is complete. Proceed to Phase 2:
- Denormalize `contributor_count` to repositories table
- Eliminate the secondary query in SSR

## Lessons Learned

Initial investigation incorrectly reported table as missing due to search method. Direct SQL verification confirmed the table exists with proper indexes.
