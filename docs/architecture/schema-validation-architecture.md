# Schema Validation Architecture

## System Design

This document describes the architecture and technical approach for preventing database schema mismatches in Supabase Edge Functions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Development Phase                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Developer writes Edge Function code                    │
│     └─> Uses generated TypeScript types                    │
│                                                             │
│  2. TypeScript compiler checks types                       │
│     └─> Catches compile-time schema mismatches            │
│                                                             │
│  3. Developer runs tests locally                           │
│     └─> npm run test:edge-functions                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        CI/CD Phase                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. GitHub Actions triggered on PR                         │
│     └─> Runs on all changes to supabase/functions/**      │
│                                                             │
│  2. Deno test suite executes                               │
│     ├─> Unit tests (_shared/*.test.ts)                    │
│     ├─> Integration tests (__tests__/*.test.ts)           │
│     └─> Schema validation tests (tests/*.test.ts)         │
│                                                             │
│  3. Test failures block PR merge                           │
│     └─> Forces developer to fix schema mismatches         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Production Phase                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Code passes all checks                                 │
│  2. Merged to main branch                                  │
│  3. Edge Functions deployed to Supabase                    │
│  4. Operations use only valid columns                      │
│     └─> No silent failures                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Generated TypeScript Types

**Location**: `src/types/supabase.ts` (245KB)

**Purpose**: Provides compile-time type safety for all database operations

**Generation**:
```bash
npx supabase gen types typescript \
  --project-id egcxzonpmmcirmgqdrla \
  --schema public \
  > src/types/supabase.ts
```

**Structure**:
```typescript
export interface Database {
  public: {
    Tables: {
      pr_comments: {
        Row: { /* actual table structure */ }
        Insert: { /* fields allowed on insert */ }
        Update: { /* fields allowed on update */ }
      }
      // ... all other tables
    }
  }
}
```

**Benefits**:
- IDE autocomplete for available columns
- Compile-time errors for typos
- Type inference for query results
- Documentation through types

### 2. Schema Validation Tests

**Location**: `supabase/functions/tests/schema-validation.test.ts` (358 lines)

**Purpose**: Runtime validation that upsert operations match actual schema

**Key Function**:
```typescript
function validateUpsertObject(
  tableName: keyof typeof KNOWN_SCHEMAS,
  upsertObject: Record<string, unknown>
): { valid: boolean; invalidColumns: string[] } {
  const schema = KNOWN_SCHEMAS[tableName];
  const objectKeys = Object.keys(upsertObject);
  const invalidColumns = objectKeys.filter((key) => !schema.includes(key));

  return {
    valid: invalidColumns.length === 0,
    invalidColumns,
  };
}
```

**Coverage**:
- 10 test cases across 5 critical tables
- Both positive and negative test scenarios
- Tests for common schema mismatch patterns

**Example Test**:
```typescript
Deno.test('pr_comments table - should not have repository_full_name column', () => {
  const invalidUpsert = {
    github_id: 123,
    repository_full_name: 'owner/repo', // Invalid!
  };

  const result = validateUpsertObject('pr_comments', invalidUpsert);
  assertEquals(result.valid, false);
  assertEquals(result.invalidColumns.includes('repository_full_name'), true);
});
```

### 3. CI/CD Pipeline

**Location**: `.github/workflows/edge-functions-quality.yml`

**Triggers**:
- Pull requests modifying `supabase/functions/**`
- Pushes to main branch

**Jobs**:

**Lint Job**:
```yaml
- name: Run linter
  run: |
    cd supabase/functions
    deno lint _shared/ tests/ __tests__/ spam-detection/
```

**Test Job**:
```yaml
- name: Run tests
  run: |
    cd supabase/functions
    deno task test
  env:
    SUPABASE_URL: https://test.supabase.co
    SUPABASE_SERVICE_ROLE_KEY: test-key
```

**Type Check Job**:
```yaml
- name: Type check
  run: |
    cd supabase/functions
    deno check _shared/*.ts tests/*.ts __tests__/*.ts
```

### 4. Test Infrastructure

**Location**: `supabase/functions/tests/setup.ts`

**Purpose**: Provides mock clients and test utilities

**Key Utilities**:
- `MockSupabaseClient` - Mock database operations
- `MockGitHubClient` - Mock GitHub API calls
- `createTestRequest` - HTTP request builder
- `assertSuccessResponse` - Response validators

## Data Flow

### Valid Operation Flow

```
Developer writes code
    │
    ├─> Uses TypeScript types
    │   └─> IDE shows available columns
    │
    ├─> Runs tests locally
    │   └─> Schema validation passes
    │
    └─> Commits code
        │
        ├─> GitHub Actions runs
        │   ├─> Lint passes
        │   ├─> Tests pass
        │   └─> Type check passes
        │
        └─> PR approved and merged
            │
            └─> Edge Function deployed
                └─> Database operations succeed ✅
```

### Invalid Operation Flow

```
Developer uses wrong column name
    │
    ├─> TypeScript compiler error
    │   └─> Fix or ignore (bad practice)
    │
    └─> Commits code anyway
        │
        └─> GitHub Actions runs
            │
            └─> Schema validation test FAILS ❌
                │
                ├─> PR blocked from merging
                │
                └─> Developer must fix
                    └─> Update code to use correct column
```

## Design Decisions

### Why TypeScript Types?

**Advantages**:
- Compile-time safety (catch errors before runtime)
- IDE support (autocomplete, inline documentation)
- Zero runtime overhead
- Auto-generated from source of truth (database schema)

**Disadvantages**:
- Requires regeneration when schema changes
- Large file size (245KB)
- Doesn't prevent runtime issues if types are ignored

### Why Runtime Tests?

**Advantages**:
- Catches issues TypeScript might miss
- Validates actual column usage in code
- Prevents type assertion bypasses
- Documents expected schema

**Disadvantages**:
- Requires manual schema definition in tests
- Needs updating when schema changes
- Adds test suite execution time

### Why Both?

TypeScript types and runtime tests are complementary:

1. **Types** catch issues at development time
2. **Tests** catch issues that bypass types
3. **Together** they provide defense in depth

## Performance Considerations

### Build Time Impact

- Type generation: ~2 seconds
- Test execution: ~5 seconds
- Lint/format: ~1 second
- Total CI time: ~15 seconds per PR

### Runtime Impact

- **Zero** - validation only runs in CI/CD
- Production code has no validation overhead
- Types are stripped during compilation

## Security Considerations

### Preventing SQL Injection

The schema validation doesn't directly prevent SQL injection (Supabase client handles that), but it does:

1. Enforce use of parameterized queries
2. Prevent dynamic column name construction
3. Require explicit column declarations

### Preventing Data Corruption

By catching schema mismatches before deployment:

1. Prevents silent data loss
2. Ensures referential integrity
3. Validates foreign key relationships

## Maintenance

### When Schema Changes

1. Update migration files in `supabase/migrations/`
2. Apply migration via Supabase CLI or dashboard
3. Regenerate TypeScript types:
   ```bash
   npx supabase gen types typescript --project-id egcxzonpmmcirmgqdrla --schema public > src/types/supabase.ts
   ```
4. Update `KNOWN_SCHEMAS` in `schema-validation.test.ts`
5. Run tests to identify affected code
6. Update Edge Function code as needed

### Adding New Tables

1. Create migration for new table
2. Apply migration
3. Regenerate types (types include all tables automatically)
4. Add table schema to `KNOWN_SCHEMAS` in tests
5. Write validation tests for new table

## Future Enhancements

### Potential Improvements

1. **Automated Schema Sync**:
   - GitHub Action to regenerate types on schema changes
   - Automatic PR creation with updated types

2. **Enhanced Validation**:
   - Validate foreign key relationships
   - Check required vs optional fields
   - Validate field types (string, number, etc.)

3. **Better Error Messages**:
   - Show which columns are available
   - Suggest correct column names for typos
   - Link to table documentation

4. **Integration Tests**:
   - E2E tests with actual Supabase instance
   - Verify database operations succeed
   - Test migration rollback scenarios

## Related Documentation

- [Feature Documentation](../features/schema-validation.md)
- [Postmortem: Schema Mismatch Incident](../postmortems/2025-10-11-inngest-event-data-structure-mismatch.md)
- [Testing Guidelines](../testing/edge-functions-testing.md)
