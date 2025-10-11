# Schema Validation for Edge Functions

## Overview

This feature provides compile-time and runtime validation to prevent database schema mismatches in Supabase Edge Functions. It ensures that all database operations use only columns that exist in the actual database schema.

## Problem Statement

Previously, Edge Functions could attempt to insert or update database columns that didn't exist in the schema, causing silent failures. Operations would return HTTP 200 status codes while failing to persist data because the Supabase client returns errors in response objects rather than throwing exceptions.

### Example of the Problem

```typescript
// This would silently fail - repository_full_name doesn't exist in pr_comments table
await supabase.from('pr_comments').upsert({
  comment_id: 123,
  repository_full_name: 'owner/repo', // ❌ Column doesn't exist!
  body: 'Comment text',
});
// Returns: { data: null, error: { message: 'column repository_full_name does not exist' } }
// Job completes with HTTP 200, but no data is saved
```

## Solution

### 1. Generated TypeScript Types

Auto-generated TypeScript types from the actual Supabase schema provide compile-time safety:

```bash
npx supabase gen types typescript --project-id PROJECT_ID --schema public > src/types/supabase.ts
```

These types define the exact structure of each table, preventing typos and schema drift.

### 2. Schema Validation Tests

Runtime tests validate that upsert objects match table schemas:

```typescript
// supabase/functions/tests/schema-validation.test.ts
function validateUpsertObject(
  tableName: keyof typeof KNOWN_SCHEMAS,
  upsertObject: Record<string, unknown>
): { valid: boolean; invalidColumns: string[] }
```

### 3. CI/CD Integration

GitHub Actions workflow runs tests on every PR:

```yaml
# .github/workflows/edge-functions-quality.yml
- name: Run tests
  run: |
    cd supabase/functions
    deno task test
```

## Usage

### For Developers

When working with Edge Functions that interact with the database:

1. **Import generated types**:
   ```typescript
   import type { Database } from '../../../src/types/supabase.ts';
   type Tables = Database['public']['Tables'];
   ```

2. **Use typed upsert operations**:
   ```typescript
   const commentData: Tables['pr_comments']['Insert'] = {
     github_id: 123,
     repository_id: repoId, // ✅ Uses repository_id, not repository_full_name
     body: 'Comment text',
   };
   await supabase.from('pr_comments').upsert(commentData);
   ```

3. **Run tests before committing**:
   ```bash
   npm run test:edge-functions
   ```

### Updating Schema

When the database schema changes:

1. Update the migration files
2. Apply migrations to Supabase
3. Regenerate TypeScript types:
   ```bash
   npx supabase gen types typescript --project-id egcxzonpmmcirmgqdrla --schema public > src/types/supabase.ts
   ```
4. Update `KNOWN_SCHEMAS` in `schema-validation.test.ts`
5. Run tests to catch any code using old schema

## Test Coverage

The schema validation test suite covers all critical tables:

- `issues` table
- `pr_comments` table
- `pr_reviews` table
- `issue_comments` table
- `pull_requests` table

Each table has tests for both valid and invalid column usage.

## Related Issues

- [Issue #1097](https://github.com/bdougie/contributor.info/issues/1097) - Schema validation testing
- [PR #1098](https://github.com/bdougie/contributor.info/pull/1098) - Implementation

## See Also

- [Architecture Documentation](../architecture/schema-validation-architecture.md)
- [Postmortem: Schema Mismatch Incident](../postmortems/2025-10-11-inngest-event-data-structure-mismatch.md)
