# Zod Runtime Validation Strategy

## Overview

This document outlines our approach to runtime validation using Zod, implemented as part of issue #541 to eliminate unsafe TypeScript `any` types and type assertions throughout the codebase.

## Problem Statement

### Previous Issues
1. **Unsafe Type Assertions**: Code used `as unknown as Type` patterns without validation
2. **Runtime Failures**: Type assertions could fail silently at runtime with malformed data
3. **Missing Validation**: No runtime checks for Supabase query responses
4. **Technical Debt**: 31+ `any` types scattered throughout the codebase

### Example of Problematic Code
```typescript
// ❌ BEFORE: Unsafe type assertion
const contributor = (dbPR as unknown as { contributors?: SupabaseContributor }).contributors;
const username = contributor?.username || 'unknown';
```

## Solution: Zod Runtime Validation

### Implementation Strategy

We replaced all unsafe type assertions with Zod schemas that validate data at runtime, providing both type safety and runtime guarantees.

### Core Implementation

#### 1. Schema Definition (`src/lib/validation/supabase-response-schemas.ts`)

```typescript
// Define the shape of nested contributor data
export const supabaseContributorNestedSchema = z.object({
  github_id: z.number(),
  username: z.string(),
  avatar_url: z.string(),
  is_bot: z.boolean(),
}).nullable();

// Define pull request with all relationships
export const supabasePullRequestWithRelationsSchema = z.object({
  id: z.string().uuid(),
  github_id: z.number(),
  number: z.number(),
  title: z.string(),
  // ... other fields
  contributors: supabaseContributorNestedSchema,
  reviews: z.array(supabaseReviewWithContributorSchema).nullable(),
  comments: z.array(supabaseCommentWithContributorSchema).nullable(),
});
```

#### 2. Validation Function

```typescript
export function validateAndTransformPRData(
  data: unknown, 
  owner: string, 
  repo: string
) {
  const validation = validateSupabasePRArray(data);
  
  if (!validation.success) {
    console.error(`Failed to validate PR data for ${owner}/${repo}:`, validation.error);
    return [];
  }
  
  return validation.data.map(pr => {
    const transformed = transformSupabasePRToAppFormat(pr);
    transformed.repository_owner = owner;
    transformed.repository_name = repo;
    return transformed;
  });
}
```

#### 3. Usage in Data Fetching

```typescript
// ✅ AFTER: Safe runtime validation
const { data: dbPRs, error } = await supabase
  .from('pull_requests')
  .select('...')
  .eq('repository_id', repoId);

// Validate and transform with proper error handling
const transformedPRs = validateAndTransformPRData(dbPRs || [], owner, repo);
```

## Benefits

### 1. Runtime Safety
- Catches malformed data before it causes runtime errors
- Provides detailed validation error messages
- Gracefully handles partial data failures

### 2. Developer Experience
- TypeScript automatically infers types from Zod schemas
- Single source of truth for data shape
- Clear error messages during development

### 3. Data Quality
- Validates data completeness
- Handles missing nested relationships gracefully
- Logs validation failures for monitoring

## Migration Guide

### Phase 1: Add TODO Comments
Mark unsafe type assertions for replacement:
```typescript
// TODO: Replace with Zod validation (Issue #541)
const data = response as unknown as MyType;
```

### Phase 2: Create Zod Schemas
Define schemas matching your data structure:
```typescript
const mySchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().optional(),
});
```

### Phase 3: Replace Type Assertions
Replace assertions with validation:
```typescript
// Before
const data = apiResponse as unknown as MyType;

// After
const validation = mySchema.safeParse(apiResponse);
if (!validation.success) {
  console.error('Validation failed:', validation.error);
  return defaultValue;
}
const data = validation.data;
```

## Common Patterns

### Nested Objects
```typescript
const nestedSchema = z.object({
  user: z.object({
    id: z.number(),
    name: z.string(),
  }).nullable(),
});
```

### Arrays with Fallbacks
```typescript
const arraySchema = z.array(itemSchema).nullable().transform(val => val || []);
```

### Optional Fields with Defaults
```typescript
const schemaWithDefaults = z.object({
  count: z.number().optional().default(0),
  name: z.string().optional().default('Unknown'),
});
```

## Error Handling

### Development Mode
In development, log detailed validation errors:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.error('Validation failed:', error.errors);
}
```

### Production Mode
In production, fail gracefully with fallback data:
```typescript
if (!validation.success) {
  // Log to error tracking service
  trackError('validation_failure', { error: validation.error });
  // Return safe fallback
  return [];
}
```

## Performance Considerations

1. **Parse Once**: Validate data once at the boundary (API response)
2. **Type Inference**: Let TypeScript infer types from schemas
3. **Selective Validation**: Only validate external data, not internal state
4. **Caching**: Cache validated results when appropriate

## Testing

### Unit Tests
```typescript
describe('Zod Validation', () => {
  it('validates correct data shape', () => {
    const data = { /* valid data */ };
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });
  
  it('rejects invalid data', () => {
    const data = { /* invalid data */ };
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests
Test with real Supabase responses to ensure schemas match actual data.

## File Organization

```
src/lib/validation/
├── index.ts                          # Main exports
├── supabase-response-schemas.ts      # Supabase-specific schemas
├── github-api-schemas.ts             # GitHub API schemas
├── database-schemas.ts               # Database table schemas
└── validation-utils.ts               # Shared utilities
```

## Future Improvements

1. **Schema Generation**: Auto-generate Zod schemas from Supabase types
2. **Runtime Metrics**: Track validation success/failure rates
3. **Schema Versioning**: Handle schema evolution over time
4. **Performance Optimization**: Implement lazy validation for large datasets

## References

- [Zod Documentation](https://zod.dev)
- [TypeScript Handbook - Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
- [Issue #541 - Remove TypeScript any types](https://github.com/bdougie/contributor.info/issues/541)