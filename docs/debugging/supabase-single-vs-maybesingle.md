# Supabase `.single()` vs `.maybeSingle()` - Avoiding 406 Errors

## Problem

One of the most common causes of **406 Not Acceptable** errors in Supabase is using `.single()` when querying for data that might not exist.

## The 406 Error

When you see errors like:
```
Failed to load resource: the server responded with a status of 406 ()
```

With the error details:
```json
{
  "code": "PGRST116",
  "details": "The result contains 0 rows",
  "message": "JSON object requested, multiple (or no) rows returned"
}
```

## Root Cause

The `.single()` method expects **exactly one row** to be returned. When it gets:
- **0 rows**: Throws a 406 error
- **Multiple rows**: Also throws a 406 error

This is particularly problematic when checking if something exists in the database, as the absence of data is often a valid state.

## Solution

Use `.maybeSingle()` instead of `.single()` when:
- Checking if a record exists
- The query might legitimately return no results
- You're doing a lookup that could fail

### When to use `.single()`

```typescript
// ✅ Good: Inserting and expecting the inserted row back
const { data, error } = await supabase
  .from('repositories')
  .insert({ owner, name })
  .select()
  .single(); // We know this will return exactly one row

// ✅ Good: Getting a record by primary key that MUST exist
const { data, error } = await supabase
  .from('users')
  .select()
  .eq('id', userId)
  .single(); // User must exist at this point in the flow
```

### When to use `.maybeSingle()`

```typescript
// ✅ Good: Checking if a repository exists
const { data, error } = await supabase
  .from('repositories')
  .select('id, owner, name')
  .eq('owner', owner)
  .eq('name', repo)
  .maybeSingle(); // Returns null if not found, no error

// ✅ Good: Looking up optional metadata
const { data, error } = await supabase
  .from('tracked_repositories')
  .select('size, priority')
  .eq('repository_id', repoId)
  .maybeSingle(); // Tracking data might not exist yet
```

## Error Handling Differences

### With `.single()`
```typescript
const { data, error } = await supabase
  .from('repositories')
  .select()
  .eq('owner', owner)
  .single();

if (error) {
  if (error.code === 'PGRST116') {
    // No rows found - but this is an ERROR state
    console.log('Repository not found');
  } else {
    // Real database error
    console.error('Database error:', error);
  }
}
```

### With `.maybeSingle()`
```typescript
const { data, error } = await supabase
  .from('repositories')
  .select()
  .eq('owner', owner)
  .maybeSingle();

if (error) {
  // Only real database errors arrive here
  console.error('Database error:', error);
  return;
}

if (!data) {
  // No rows found - this is a NORMAL state
  console.log('Repository not found');
} else {
  // Process the data
  console.log('Found repository:', data);
}
```

## Common Patterns in This Codebase

### Repository Discovery Pattern
```typescript
// Check if repository exists
const { data: repoData } = await supabase
  .from('repositories')
  .select('id')
  .eq('owner', owner)
  .eq('name', repo)
  .maybeSingle(); // Use maybeSingle for existence checks

if (!repoData) {
  // Repository doesn't exist - trigger discovery
  await initiateDiscovery(owner, repo);
}
```

### Polling Pattern
```typescript
// Poll for repository creation
const checkInterval = setInterval(async () => {
  const { data } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle(); // Don't error on each poll attempt
  
  if (data) {
    clearInterval(checkInterval);
    // Repository now exists!
  }
}, 2000);
```

## Files Recently Fixed

The following files were updated to use `.maybeSingle()` to fix 406 errors:

1. **`src/hooks/use-repository-discovery.ts`**
   - Changed repository existence checks
   - Fixed polling checks

2. **`src/hooks/use-repository-metadata.ts`**
   - Fixed repository ID lookups
   - Fixed tracked repository metadata queries

3. **`src/hooks/use-auto-track-repository.ts`**
   - Fixed checks for already-tracked repositories

## Prevention Tips

1. **Default to `.maybeSingle()`** for any query that's checking existence
2. **Only use `.single()`** when you're certain exactly one row will be returned
3. **Add comments** when using `.single()` to explain why exactly one row is expected
4. **Test with non-existent data** to ensure your queries handle missing records gracefully

## Quick Reference

| Method | Returns when 0 rows | Returns when 1 row | Returns when 2+ rows | Use Case |
|--------|-------------------|-------------------|---------------------|----------|
| `.single()` | 406 Error | Data | 406 Error | Must have exactly 1 row |
| `.maybeSingle()` | `null` | Data | Error | 0 or 1 row expected |
| (no modifier) | `[]` | `[data]` | `[data1, data2, ...]` | Any number of rows |

## Related Issues

- [Issue #375](https://github.com/bdougie/contributor.info/issues/375) - Fixed 406 errors when tracking new repositories
- [PR #377](https://github.com/bdougie/contributor.info/pull/377) - Implementation of the fix

## Key Takeaway

**When in doubt, use `.maybeSingle()`** - it's more forgiving and won't crash your app when data doesn't exist. Reserve `.single()` for cases where the absence of data would indicate a serious problem in your application logic.