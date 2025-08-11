# PostgREST 406 Error Resolution

## Incident Summary
**Date**: January 2025  
**Impact**: Critical - All new repository discovery was blocked  
**Root Cause**: PostgREST `.single()` method throwing 406 errors when queries return 0 rows  
**Resolution**: Replaced all `.single()` calls with `.maybeSingle()` throughout codebase  

## Problem Description

Users were experiencing 406 "Not Acceptable" errors when:
- Attempting to track new repositories
- Checking if repositories existed in the database
- Looking up contributors that hadn't been created yet
- Any query that could potentially return 0 rows

The errors manifested as:
```
GET /rest/v1/repositories?select=id&owner=eq.owner&name=eq.repo
Response: 406 Not Acceptable
```

## Root Cause Analysis

### Initial Misdiagnosis
The first attempt to fix this issue incorrectly added Accept headers to the Supabase client configuration:
```typescript
// INCORRECT FIX - Don't do this
global: {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
}
```

This was based on a misunderstanding that the 406 error was related to content negotiation.

### Actual Root Cause
PostgREST's `.single()` method has specific behavior:
- Returns the row if exactly 1 row matches
- Throws 406 error if 0 rows match
- Throws error if multiple rows match

When checking if a repository exists (common operation), the query would return 0 rows for new repositories, causing a 406 error.

## Solution

### Systematic Replacement
Replaced all `.single()` calls with `.maybeSingle()`:

```typescript
// Before - throws 406 if no rows
const { data, error } = await supabase
  .from('repositories')
  .select('id')
  .eq('owner', owner)
  .eq('name', repo)
  .single();

// After - returns null if no rows
const { data, error } = await supabase
  .from('repositories')
  .select('id')
  .eq('owner', owner)
  .eq('name', repo)
  .maybeSingle();
```

### TypeScript Adjustments
The migration required adding null checks since `.maybeSingle()` can return null:

```typescript
// Add null checks after migration
if (!data) {
  // Handle case where no row exists
  return null;
}
```

## Files Affected

### High Priority (Core Data Fetching)
- `src/lib/supabase-pr-data.ts`
- `src/lib/supabase-pr-data-smart.ts`
- `src/lib/supabase-with-retry.ts`
- `src/lib/github-graphql-stats.ts`
- `src/lib/api/spam-filtered-feed.ts`

### Medium Priority (Queue Management)
- `src/lib/progressive-capture/*.ts` (all files)
- `src/lib/inngest/functions/*.ts` (all functions)
- `src/hooks/*.ts` (all hooks)

### Lower Priority (Background Jobs)
- `app/webhooks/*.ts` (all webhooks)
- `app/services/*.ts` (all services)
- `supabase/functions/**/*.ts` (all Edge Functions)
- Various scripts and utilities

Total replacements: ~95 instances across 56 files

## Prevention Measures

### 1. Use `.maybeSingle()` by Default
Unless you specifically need an error when no rows exist, always use `.maybeSingle()`.

### 2. Query Pattern Guidelines

```typescript
// ✅ GOOD - Checking existence
const { data: exists } = await supabase
  .from('table')
  .select('id')
  .eq('key', value)
  .maybeSingle();

if (!exists) {
  // Create new record
}

// ❌ BAD - Will throw 406 if not found
const { data } = await supabase
  .from('table')
  .select('id')
  .eq('key', value)
  .single(); // Avoid this pattern
```

### 3. ESLint Rule (TODO)
Consider adding an ESLint rule to warn against `.single()` usage:
```javascript
// Warn when .single() is used
"no-restricted-syntax": [
  "warn",
  {
    "selector": "CallExpression[callee.property.name='single']",
    "message": "Avoid .single() - use .maybeSingle() to prevent 406 errors"
  }
]
```

## Lessons Learned

1. **Understand the Error**: 406 errors from PostgREST are not about HTTP Accept headers, but about row count expectations
2. **Test with Empty Databases**: Always test queries against empty tables to catch these issues early
3. **Read PostgREST Documentation**: The behavior of `.single()` vs `.maybeSingle()` is documented but easily overlooked
4. **Systematic Fixes**: When fixing pervasive issues, use scripts to ensure all instances are addressed

## Testing Checklist

After implementing this fix, verify:
- [ ] New repository discovery works
- [ ] Repository existence checks return null (not error) for missing repos
- [ ] Contributor lookups handle missing users gracefully
- [ ] All TypeScript compilation passes
- [ ] No 406 errors in browser console
- [ ] Background jobs handle missing data without crashing

## References

- [PostgREST Documentation on Singular Responses](https://postgrest.org/en/stable/references/api/tables_views.html#singular-or-plural)
- [Supabase JS Client Single vs MaybeSingle](https://supabase.com/docs/reference/javascript/single)
- GitHub Issue: #403