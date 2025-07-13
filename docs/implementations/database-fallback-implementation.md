# Database Fallback Implementation

## Overview

This document covers the implementation of database-first fallback patterns to avoid GitHub API rate limiting issues. The changes prioritize cached database data over expensive GitHub API calls.

## Changes Made

### 1. Fixed Pull Request Database Queries

**File**: `/src/lib/supabase-pr-data.ts`

**Issues Fixed**:
- Column name mismatch: `commits_count` → `commits`
- Missing contributor data causing placeholder avatars
- Incorrect PostgREST foreign key syntax

**Changes**:
```typescript
// Before: Failed query with wrong column name
commits_count,

// After: Correct column name
commits,

// Before: No contributor data, placeholder avatars
user: {
  login: 'unknown',
  id: 0,
  avatar_url: '',
  type: 'User'
}

// After: Cached contributor data from database
user: {
  login: dbPR.contributors?.username || 'unknown',
  id: dbPR.contributors?.github_id || 0,
  avatar_url: dbPR.contributors?.avatar_url || '',
  type: dbPR.contributors?.is_bot ? 'Bot' : 'User'
}

// Foreign key join syntax
contributors!pull_requests_contributor_id_fkey(
  github_id,
  username,
  avatar_url,
  is_bot
)
```

### 2. Added Commits Table

**Migration**: `add_commits_table`

**Schema Added**:
```sql
CREATE TABLE commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sha TEXT NOT NULL,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    author_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
    committer_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    authored_at TIMESTAMPTZ NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    changed_files INTEGER DEFAULT 0,
    is_direct_commit BOOLEAN DEFAULT FALSE,
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE SET NULL,
    html_url TEXT,
    api_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT commits_repo_sha_key UNIQUE (repository_id, sha)
);
```

### 3. Created Database-First Direct Commits

**File**: `/src/lib/supabase-direct-commits.ts`

**Purpose**: Replace expensive `fetchDirectCommits` that made 200+ GitHub API calls

**Implementation**:
- Queries cached commit data from database
- Calculates YOLO coder stats from cached data
- Returns empty data if no commits cached (avoids API entirely)
- Uses proper PostgREST foreign key syntax

### 4. Updated All Hooks

**Files Modified**:
- `/src/hooks/use-repo-stats.ts`
- `/src/hooks/use-repo-data.ts` 
- `/src/hooks/use-cached-repo-data.ts`

**Changes**:
```typescript
// Before: Hit GitHub API with 200+ requests
import { fetchDirectCommits } from '@/lib/github';
fetchDirectCommits(owner, repo, timeRange)

// After: Use database-first approach
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
fetchDirectCommitsWithDatabaseFallback(owner, repo, timeRange)
```

## Current Architecture

### Data Flow

1. **Pull Requests**: Database → GitHub API (fallback)
2. **Direct Commits**: Database → Empty data (no API fallback)
3. **Contributors**: Cached in database with avatars
4. **Reviews/Comments**: Not yet cached (GitHub API only)

### Database-First Benefits

- ✅ No rate limiting during normal operation
- ✅ Faster loading times
- ✅ Cached contributor avatars and metadata
- ✅ Reduced GitHub API usage by 90%+

## Known Limitations

### Missing Database Data

1. **Recent PRs**: Database may not have PRs from last 5 days
2. **PR Reviews**: Not stored in database, will show 0
3. **PR Comments**: Not stored in database, will show 0
4. **Commit Data**: New commits table is empty, needs population
5. **File Changes**: Line additions/deletions may be 0 in cached data

### Features Affected

1. **PR Activity Lines Changed**: Shows 0 due to missing file change data
2. **Recent Activity**: May miss last 5 days if not in cache
3. **Review Metrics**: Shows 0 reviews due to no database caching
4. **Trends/Metrics**: May fail if expecting review/comment data

## Regression Analysis

See [database-fallback-regressions.md](./database-fallback-regressions.md) for detailed regression analysis and fixes.

## Next Steps

1. **Populate commit data**: Add background sync to populate commits table
2. **Cache reviews/comments**: Extend database schema for these entities
3. **Hybrid approach**: Use cached data with selective API calls for recent data
4. **Data validation**: Ensure database data quality and completeness