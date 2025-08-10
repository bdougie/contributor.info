# Common Errors and Solutions

## Supabase / PostgREST Errors

### 406 Not Acceptable

**Error Message**: `GET /rest/v1/table?select=*&column=eq.value - 406 Not Acceptable`

**Cause**: Using `.single()` on a query that returns 0 rows

**Solution**: Replace `.single()` with `.maybeSingle()`

```typescript
// ❌ Causes 406 error
const { data } = await supabase
  .from('table')
  .select()
  .eq('id', 'non-existent')
  .single(); // Throws 406 if no rows found

// ✅ Fixed
const { data } = await supabase
  .from('table')
  .select()
  .eq('id', 'might-not-exist')
  .maybeSingle(); // Returns null if no rows found
```

**See**: [Full 406 Error Postmortem](../postmortems/406-error-resolution.md)

### PGRST116 - No Rows Found

**Error Message**: `PGRST116`

**Cause**: This is actually not an error when using `.maybeSingle()` - it's the expected code when no rows match

**Solution**: Check for this specific code to distinguish "not found" from real errors

```typescript
const { data, error } = await supabase
  .from('table')
  .select()
  .eq('id', id)
  .maybeSingle();

if (error && error.code !== 'PGRST116') {
  // Real error - handle it
  throw error;
}

if (!data) {
  // No row found (PGRST116) - this is OK
  return null;
}
```

### 23505 - Unique Constraint Violation

**Error Message**: `duplicate key value violates unique constraint`

**Cause**: Trying to insert a row that violates a unique constraint

**Solution**: Use upsert or handle the conflict

```typescript
// Option 1: Upsert
const { data, error } = await supabase
  .from('repositories')
  .upsert({
    github_id: repo.id,
    owner: repo.owner,
    name: repo.name
  }, {
    onConflict: 'github_id',
    ignoreDuplicates: false // Update if exists
  })
  .select()
  .maybeSingle();

// Option 2: Check first
const { data: existing } = await supabase
  .from('repositories')
  .select('id')
  .eq('github_id', repo.id)
  .maybeSingle();

if (!existing) {
  // Safe to insert
}
```

## GitHub API Errors

### 403 Forbidden / Rate Limit

**Error Message**: `API rate limit exceeded`

**Cause**: Hit GitHub's rate limit (5000 requests/hour for authenticated)

**Solution**: 
1. Check rate limit status
2. Use conditional requests
3. Implement exponential backoff

```typescript
// Check rate limit
const response = await fetch(url, { headers });
const remaining = response.headers.get('x-ratelimit-remaining');
if (remaining === '0') {
  const resetTime = response.headers.get('x-ratelimit-reset');
  // Wait until reset
}
```

### 404 Not Found

**Common Causes**:
- Repository is private and token lacks access
- Repository was deleted/renamed
- Typo in owner/repo name

**Solution**: Verify repository exists and is accessible

```typescript
// Check if repo exists first
const repoResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}`,
  { headers }
);

if (!repoResponse.ok) {
  if (repoResponse.status === 404) {
    console.log('Repository not found or not accessible');
  }
}
```

## TypeScript Errors

### Object is possibly 'null'

**After migrating from `.single()` to `.maybeSingle()`**

**Solution**: Add null checks

```typescript
const { data } = await supabase
  .from('table')
  .select()
  .eq('id', id)
  .maybeSingle();

// TypeScript error: Object is possibly 'null'
// console.log(data.field); 

// ✅ Fixed
if (data) {
  console.log(data.field);
}

// Or with early return
if (!data) {
  return null;
}
console.log(data.field); // TypeScript knows data is defined
```

## Netlify Function Errors

### Function Timeout

**Error**: Function execution exceeded 10 seconds (default timeout)

**Solution**: 
1. Break into smaller operations
2. Use background processing (Inngest)
3. Increase timeout in `netlify.toml`

```toml
[functions]
  timeout = 26 # Maximum for free tier
```

### Module Not Found in Production

**Error**: Works locally but fails in production

**Common Cause**: Using `.mts` files which Netlify doesn't deploy correctly

**Solution**: Use `.js` or `.ts` files instead

```javascript
// netlify/functions/api-endpoint.js (not .mts)
export default async (req, context) => {
  // Function code
}
```

## Database Migration Errors

### Migration Already Exists

**Error**: `migration "20240614000000_initial_schema" already exists`

**Solution**: Use unique timestamps for each migration

```bash
# Generate unique timestamp
date +%Y%m%d%H%M%S
# Output: 20240614153045

# Use in migration name
20240614153045_add_new_table.sql
```

### Foreign Key Constraint Violation

**Error**: `violates foreign key constraint`

**Solution**: Ensure referenced record exists first

```sql
-- Wrong order
INSERT INTO pull_requests (repository_id) VALUES ('123');
INSERT INTO repositories (id) VALUES ('123');

-- Correct order
INSERT INTO repositories (id) VALUES ('123');
INSERT INTO pull_requests (repository_id) VALUES ('123');
```

## Common Development Issues

### Environment Variables Not Loading

**Symptom**: `undefined` environment variables

**Solution**: Check `.env` file location and format

```typescript
// For Vite apps
import.meta.env.VITE_SUPABASE_URL

// For Node/Netlify functions
process.env.SUPABASE_URL

// Universal approach (see src/lib/env.ts)
const url = import.meta.env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
```

### CORS Errors in Development

**Error**: `Access-Control-Allow-Origin` errors

**Solution**: Check Supabase project settings or use proxy

```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://your-project.supabase.co',
        changeOrigin: true
      }
    }
  }
}
```