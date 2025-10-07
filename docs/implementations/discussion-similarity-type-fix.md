# Discussion Similarity Function Type Fix

## Issue Summary

**Issue:** #1011  
**PR:** #1012  
**Date:** 2025-10-07

## Problem

The planned `find_similar_discussions_in_workspace` database function had a type mismatch that would cause runtime errors:

- **Function parameter expected:** `exclude_discussion_id uuid`
- **Actual column type:** `discussions.id VARCHAR`

GitHub discussions use GraphQL node IDs (e.g., `"D_kwDOJm0kOc4AiTSy"`) which are strings, not UUIDs.

## Root Cause

The function was planned before the discussions schema was finalized. The discussions table correctly uses VARCHAR for IDs (matching GitHub's GraphQL API format), but the similarity function signature was designed with UUID parameters like other similar functions.

## Solution

Created migration `20251007000000_add_workspace_discussion_similarity.sql` that:

### 1. Adds Embedding Support to Discussions

```sql
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;
```

**Why:** Discussions need embeddings to participate in vector similarity searches.

### 2. Creates the Similarity Function with Correct Types

```sql
CREATE OR REPLACE FUNCTION find_similar_discussions_in_workspace(
  query_embedding vector(384),
  repo_ids uuid[],
  match_count integer DEFAULT 5,
  exclude_discussion_id varchar DEFAULT NULL  -- ✅ VARCHAR, not UUID
)
```

**Key change:** `exclude_discussion_id` parameter uses `varchar` to match `discussions.id` type.

### 3. Proper WHERE Clause

```sql
WHERE 
  d.embedding IS NOT NULL
  AND d.repository_id = ANY(repo_ids)
  AND (exclude_discussion_id IS NULL OR d.id != exclude_discussion_id)  -- String comparison
```

## Type Consistency Matrix

| Component | Type | Status |
|-----------|------|--------|
| `discussions.id` | VARCHAR | ✅ Correct |
| `discussions.github_id` | VARCHAR | ✅ Correct |
| Function parameter `exclude_discussion_id` | VARCHAR | ✅ Fixed |
| WHERE clause comparison | String comparison | ✅ Correct |

## Implementation Details

### Function Return Type

Returns comprehensive discussion metadata:

```sql
RETURNS TABLE (
  id varchar,
  github_id varchar,
  repository_id uuid,
  number integer,
  title text,
  body_snippet text,
  category_name varchar,
  category_emoji varchar,
  author_login varchar,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  url varchar,
  is_answered boolean,
  upvote_count integer,
  comment_count integer
)
```

### Performance Optimizations

1. **Vector Index:**
   ```sql
   CREATE INDEX idx_discussions_embedding
   ON discussions USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100)
   ```

2. **Tracking Index:**
   ```sql
   CREATE INDEX idx_discussions_embedding_generated_at
   ON discussions(embedding_generated_at)
   ```

### Permissions

Granted to all user types following existing patterns:
- `authenticated` - For logged-in users
- `anon` - For public repository access
- `service_role` - For backend operations

## Usage Example

```typescript
// TypeScript usage (future implementation)
const similarDiscussions = await supabase.rpc('find_similar_discussions_in_workspace', {
  query_embedding: discussionEmbedding,
  repo_ids: workspaceRepoIds,
  match_count: 5,
  exclude_discussion_id: currentDiscussion.id  // ✅ Passes VARCHAR string
});
```

## Related Functions

This follows the pattern of existing similarity functions:

- `find_similar_issues()` - Single repository
- `find_similar_issues_cross_repo()` - Cross-repository  
- `find_similar_discussions_in_workspace()` - **NEW** - Workspace discussions

## Testing

Migration includes validation:

```sql
DO $$
DECLARE
  function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'find_similar_discussions_in_workspace'
  ) INTO function_exists;

  IF function_exists THEN
    RAISE NOTICE '✅ Function created successfully';
  END IF;
END $$;
```

## Impact

### Before
- Function didn't exist (prevented implementation)
- Discussions lacked embedding support
- Type mismatch would cause runtime errors

### After
- ✅ Function exists with correct types
- ✅ Discussions support vector embeddings
- ✅ Type-safe similarity searches across workspace repositories
- ✅ Ready for embedding generation integration (#1009, #1010)

## Next Steps

1. **Embedding Generation:** Implement discussion embedding generation (relates to #1009)
2. **Integration:** Add frontend components to display similar discussions
3. **Testing:** Add integration tests for the similarity function
4. **Monitoring:** Track embedding generation coverage for discussions

## References

- Issue: https://github.com/bdougie/contributor.info/issues/1011
- PR: https://github.com/bdougie/contributor.info/pull/1012
- Related: #1009 (Embedding generation), #1010 (Pipeline exclusion)
- Migration: `supabase/migrations/20251007000000_add_workspace_discussion_similarity.sql`
