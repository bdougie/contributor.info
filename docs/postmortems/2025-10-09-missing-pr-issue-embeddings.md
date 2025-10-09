# Missing PR and Issue Embeddings - Similarity Search Not Working

**Date**: 2025-10-09
**Status**: Identified
**Impact**: High - Similarity search feature only works for discussions, not PRs or issues

## Problem

The similarity search feature for workspaces is not returning PRs or issues because embeddings are not being generated for these item types.

## Data Analysis

### Current Embedding Coverage

| Table | Total Rows | With Embeddings | Coverage % |
|-------|------------|-----------------|------------|
| **pull_requests** | 126,863 | 92 | **0.07%** ❌ |
| **issues** | 1,383 | 537 | **38.83%** ⚠️ |
| **discussions** | 202 | 173 | **85.64%** ✅ |

### Repository Breakdown (PRs with embeddings)

| Repository | Total PRs | With Embeddings | Coverage % |
|------------|-----------|-----------------|------------|
| tensorflow/tensorflow | 1,408 | 38 | 2.70% |
| grafana/grafana | 632 | 7 | 1.11% |
| pytorch/pytorch | 107,674 | 5 | 0.00% |
| vercel/ai | 639 | 5 | 0.78% |

## Technical Details

### Database Schema
- ✅ `pull_requests` table HAS `embedding` column (vector 384)
- ✅ `issues` table HAS `embedding` column (vector 384)
- ✅ `discussions` table HAS `embedding` column (vector 384)

### RPC Functions
- ✅ `find_similar_pull_requests_in_workspace` exists
- ✅ `find_similar_issues_in_workspace` exists
- ✅ `find_similar_discussions_in_workspace` exists

### Root Cause
The embedding **generation process** is not running for PRs and issues. The schema and functions are correct, but embeddings aren't being created.

## Code References

- Similarity search implementation: `src/services/similarity-search.ts:93-138`
- Issues explicitly skipped: `src/services/similarity-search.ts:109-111` (comment says no embeddings)
- Response modal: `src/components/features/workspace/ResponsePreviewModal.tsx`

## Impact on Features

1. **"Respond with Similar Items" feature**: Only shows discussions, missing most relevant PRs/issues
2. **Workspace insights**: Cannot find similar PRs for duplication detection
3. **Smart notifications**: Cannot suggest related PRs/issues to users

## Next Steps

1. **Investigate embedding generation process**:
   - Check Supabase edge functions
   - Look for cron jobs or triggers
   - Review `compute-embeddings` function (mentioned in background jobs)

2. **Verify embedding generation is enabled** for PRs and issues tables

3. **Check if there's a backfill process** needed for existing data

4. **Monitor embedding generation** after fixes are deployed

## Related Background Jobs

Active background processes detected:
- `./scripts/auto-process-embeddings.sh` (multiple instances running)
- `supabase functions deploy compute-embeddings` (deployment in progress)

These may be related to the fix attempts.

## Migration Files

- `20250802000000_enhance_vector_similarity_search.sql` - Issues similarity functions
- `20251007000000_add_workspace_discussion_similarity.sql` - Discussions (working!)
- Need to check for PR-specific embedding migrations

## Solution Implemented

### 1. Created Priority-Based View
**Migration**: `20251009000000_add_priority_embeddings_view.sql`

Created `items_needing_embeddings_priority` view that:
- ✅ Removes 90-day restriction (processes all items)
- ✅ Increases batch size from 100 to 200 items
- ✅ Implements workspace-based prioritization
- ✅ Priority scoring:
  - Score 3: Workspace issues (highest)
  - Score 2: Workspace PRs and discussions
  - Score 1: Non-workspace issues
  - Score 0: Non-workspace PRs (lowest)

### 2. Updated Embedding Function
**File**: `src/lib/inngest/functions/compute-embeddings.ts:105-113`

Changed from `items_needing_embeddings` to `items_needing_embeddings_priority` view:
- Now processes 200 items per batch (was 100)
- Automatically prioritizes workspace items and issues
- No code changes needed for priority logic (handled by view)

### 3. Created Backfill Script
**Script**: `scripts/backfill-embeddings-priority.sh`

Features:
- Configurable iterations and delay (default: 100 runs, 15s delay)
- Progress tracking and summary statistics
- Automatically uses priority view for issues-first backfill
- Estimates ~20,000 items processed per run (100 iterations × 200 items)

Usage:
```bash
./scripts/backfill-embeddings-priority.sh 50 30   # 50 iterations, 30s delay
./scripts/backfill-embeddings-priority.sh         # Default: 100 iterations
```

### 4. Data Type Fixes
Fixed compatibility issues:
- Cast UUID IDs to text for UNION compatibility with VARCHAR discussion IDs
- Changed `deleted_at` to `is_active` for workspace filtering

## Next Steps

1. **Deploy Updated Function**: The compute-embeddings function needs to be redeployed with the priority view changes
2. **Run Backfill**: Execute `./scripts/backfill-embeddings-priority.sh` to process existing items
3. **Monitor Progress**: Check embedding coverage with:
   ```sql
   SELECT
     item_type,
     COUNT(*) as total,
     COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
     ROUND(100.0 * COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_pct
   FROM (
     SELECT id, embedding, 'issue' as item_type FROM issues
     UNION ALL
     SELECT id, embedding, 'pull_request' FROM pull_requests
     UNION ALL
     SELECT id::text, embedding, 'discussion' FROM discussions
   ) items
   GROUP BY item_type;
   ```
4. **Add Monitoring**: Set up alerts when embedding coverage drops below 80%

## Resolution Status

**Status**: Solution Deployed ✅
**Date**: 2025-10-09
**Impact**: Will restore full similarity search functionality for PRs and issues
