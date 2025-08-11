# Supabase Query Patterns Best Practices

## Query Methods Comparison

### `.single()` vs `.maybeSingle()` vs `.limit(1)`

| Method | Returns | When No Rows | When Multiple Rows | Use Case |
|--------|---------|--------------|-------------------|----------|
| `.single()` | Object | 406 Error | Error | When row MUST exist |
| `.maybeSingle()` | Object or null | null | Error | When row might not exist |
| `.limit(1)` | Array | Empty array | First row only | When you want first match |

## Recommended Patterns

### Checking Existence

```typescript
// ✅ GOOD - Returns null if not found
const { data: repository } = await supabase
  .from('repositories')
  .select('id')
  .eq('owner', owner)
  .eq('name', repo)
  .maybeSingle();

if (!repository) {
  // Repository doesn't exist - create it
  const { data: newRepo } = await supabase
    .from('repositories')
    .insert({ owner, name: repo })
    .select()
    .maybeSingle();
}
```

### Upserting Records

```typescript
// ✅ GOOD - Handles both insert and update
const { data, error } = await supabase
  .from('contributors')
  .upsert({
    github_id: user.id,
    username: user.login,
    avatar_url: user.avatar_url
  }, {
    onConflict: 'github_id',
    ignoreDuplicates: false
  })
  .select()
  .maybeSingle();

// Check both error and data
if (error || !data) {
  console.error('Failed to upsert contributor');
  return null;
}
```

### Fetching Optional Configuration

```typescript
// ✅ GOOD - Config might not exist
const { data: config } = await supabase
  .from('repository_settings')
  .select('*')
  .eq('repository_id', repoId)
  .maybeSingle();

// Use defaults if no config
const settings = config || DEFAULT_SETTINGS;
```

### Fetching Required Data

```typescript
// ✅ GOOD - Clear error handling for required data
const { data: user, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .maybeSingle();

if (error || !user) {
  throw new Error(`User ${userId} not found`);
}

// TypeScript knows user is defined here
console.log(user.email);
```

## Anti-Patterns to Avoid

### ❌ Using `.single()` for Existence Checks

```typescript
// BAD - Throws 406 if repository doesn't exist
const { data, error } = await supabase
  .from('repositories')
  .select('id')
  .eq('owner', owner)
  .eq('name', repo)
  .single(); // Will throw 406 if not found!

if (error) {
  // Can't distinguish between "not found" and actual errors
}
```

### ❌ Not Checking for Null After `.maybeSingle()`

```typescript
// BAD - data might be null
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .maybeSingle();

// TypeScript error: Object is possibly 'null'
console.log(data.email); // data might be null!
```

### ❌ Using `.single()` with Upsert

```typescript
// BAD - Upsert might not return a row with some RLS policies
const { data } = await supabase
  .from('table')
  .upsert(values)
  .select()
  .single(); // Might throw if RLS blocks the return
```

## Migration Guide

### Step 1: Find All `.single()` Calls

```bash
# Find all files with .single() calls
grep -r "\.single()" --include="*.ts" --include="*.js" src app supabase
```

### Step 2: Replace with `.maybeSingle()`

```bash
# Automated replacement (test carefully!)
find src app supabase -name "*.ts" -o -name "*.js" | \
  xargs sed -i 's/\.single()/\.maybeSingle()/g'
```

### Step 3: Add Null Checks

After replacement, TypeScript will show errors where null checks are needed:

```typescript
// Before
const { data } = await query.single();
return data.id;

// After
const { data } = await query.maybeSingle();
if (!data) {
  throw new Error('Record not found');
}
return data.id;
```

## Performance Considerations

- `.maybeSingle()` has the same performance as `.single()`
- Both methods add `LIMIT 1` to the query
- The only difference is error handling behavior

## RLS (Row Level Security) Considerations

When using RLS policies that might filter out rows:

```typescript
// User might not have access to this repository
const { data: repo } = await supabase
  .from('private_repositories')
  .select('*')
  .eq('id', repoId)
  .maybeSingle(); // Returns null if RLS blocks access

if (!repo) {
  // Could be: doesn't exist OR user lacks permission
  return { error: 'Repository not found or access denied' };
}
```

## Prevention Measures

### ESLint Rule

The project includes an ESLint rule that automatically prevents `.single()` usage:

```javascript
// eslint.config.js
'no-restricted-syntax': [
  'error',
  {
    selector: 'CallExpression[callee.property.name="single"]',
    message: 'Use .maybeSingle() instead of .single() to prevent 406 errors. .single() throws when no rows are found, while .maybeSingle() returns null safely.'
  }
]
```

This rule will:
- Show an error when `.single()` is used anywhere in the codebase
- Provide a helpful message explaining why `.maybeSingle()` should be used instead
- Prevent builds/commits if `.single()` is detected (when pre-commit hooks are enabled)

To test the linting:
```bash
# Run ESLint on a specific file
npx eslint src/lib/supabase.ts

# Run ESLint on entire codebase
npm run lint
```

## Summary

**Default to `.maybeSingle()`** unless you have a specific reason to require exactly one row. This prevents 406 errors and makes your application more robust when dealing with data that might not exist yet. The ESLint rule enforces this pattern automatically.