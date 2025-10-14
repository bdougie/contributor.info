# PR Capture Strategy

## Overview

The Inngest PR capture system automatically fetches and syncs pull request data from GitHub when users navigate to repository pages. This document explains how the capture strategy works and why it's designed this way.

## Capture Behavior

### What Gets Captured

When a user navigates to a repository page, the system:
1. Fetches the **100 most recent PRs by creation date** from GitHub
2. Upserts them to the Supabase database
3. Updates the repository's `last_synced_at` timestamp

### Why 100 PRs?

The 100-PR limit balances several factors:
- **User expectation**: Users navigating to a repo want to see recent activity
- **API efficiency**: GitHub API limits and rate considerations
- **Performance**: Keeps initial page loads fast
- **Completeness**: The gh-datapipe service handles historical backfill

### Why Creation Date (Not Update Date)?

**Before (UPDATED_AT DESC)**:
```graphql
pullRequests(
  first: 100
  orderBy: {field: UPDATED_AT, direction: DESC}
)
```
❌ Problem: Old PRs with recent comments pushed out newly created PRs

**After (CREATED_AT DESC)**:
```graphql
pullRequests(
  first: 100
  orderBy: {field: CREATED_AT, direction: DESC}
)
```
✅ Solution: Always captures the 100 newest PRs regardless of activity

### No Date Filtering

Earlier versions filtered PRs by date (e.g., last 30 days). This was removed because:
- If a repo had no PRs created in the last 30 days, nothing was captured
- User-initiated captures should always show the newest PRs
- Date filtering made the system unpredictable

## Integration with gh-datapipe

The 100-PR capture is designed to work alongside gh-datapipe:

- **Inngest PR Capture**: Quick, on-demand capture of 100 newest PRs
- **gh-datapipe**: Comprehensive historical backfill of all PRs
- **Together**: Provides both immediate value and complete data coverage

See `/docs/architecture/data-pipeline.md` for full pipeline details.

## Functions Involved

### 1. `capture/pr.details` (REST API)
- Captures single PR with full details
- Includes reviews and comments
- Used for individual PR updates

### 2. `capture/repository.sync-graphql` (GraphQL - Primary)
- Bulk captures 100 newest PRs efficiently
- Uses GitHub GraphQL API for better performance
- Preferred for user-initiated captures

### 3. `capture/repository.sync-enhanced` (GraphQL with Bulk Upsert)
- Most efficient version using bulk operations
- Minimal API calls and database operations
- Used for large-scale syncs

## Database Schema

PRs are stored in the `pull_requests` table with key columns:

```sql
CREATE TABLE pull_requests (
  github_id BIGINT PRIMARY KEY,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  draft BOOLEAN DEFAULT FALSE,  -- Note: column is 'draft', not 'is_draft'
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ,
  -- ... other columns
);
```

### Important: Column Naming

The database uses `draft` but GitHub's API returns `isDraft`. Code must map:
```typescript
{
  draft: pr.isDraft || false  // ✅ Correct
  // NOT: is_draft: pr.isDraft  // ❌ Wrong - causes PGRST204 error
}
```

## Debugging

The capture functions include detailed logging:

```typescript
console.log(`[DEBUG] Fetched ${prs.length} newest PRs from ${owner}/${name}`);
console.log('[DEBUG] First 3 PRs (newest):', prs.slice(0, 3).map(pr => ({
  number: pr.number,
  title: pr.title,
  createdAt: pr.createdAt
})));
console.log(`[DEBUG] Finished storing PRs: ${successCount} successful, ${errorCount} errors`);
```

These logs help verify:
- Correct number of PRs fetched
- PRs are ordered by creation date (newest first)
- Database upserts are succeeding

## Troubleshooting

### PRs Not Appearing

1. **Check Inngest logs** for function execution
2. **Verify ordering** - are newest PRs being fetched?
3. **Check error count** - are database upserts failing?
4. **Schema mismatch** - ensure column names match database

### Common Issues

**Issue**: `Could not find the 'is_draft' column`
**Fix**: Use `draft` not `is_draft` in upsert statements

**Issue**: Old PRs showing up instead of new ones
**Fix**: Verify query uses `CREATED_AT DESC` not `UPDATED_AT DESC`

**Issue**: No PRs captured despite function success
**Fix**: Check if date filtering is accidentally enabled

## Future Improvements

Potential enhancements to consider:
- Configurable PR limit (100 vs 500 vs all)
- Smart backfill based on repo size
- Incremental sync using `updated_at` cursor
- Webhook-based real-time updates
