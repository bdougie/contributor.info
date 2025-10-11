# Migration Guide: Using Shared Utilities

This guide shows how to migrate existing edge functions to use the new shared utilities
(`database.ts`, `responses.ts`, `github.ts`).

## Benefits of Migration

- **Less Code**: Reduce function size by 30-50%
- **Consistency**: Standardized error handling and responses
- **Maintainability**: Bug fixes in shared code benefit all functions
- **Type Safety**: Better TypeScript types and interfaces
- **Better Logging**: Structured logging with format specifiers

## Migration Steps

### Step 1: Replace CORS Headers

**Before:**

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

**After:**

```typescript
import { corsPreflightResponse } from '../_shared/responses.ts';

if (req.method === 'OPTIONS') {
  return corsPreflightResponse();
}
```

### Step 2: Replace Supabase Client Creation

**Before:**

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**After:**

```typescript
import { createSupabaseClient } from '../_shared/database.ts';

const supabase = createSupabaseClient();
```

### Step 3: Replace Contributor Upsert Logic

**Before:**

```typescript
// 40-50 lines of duplicated code
async function ensureContributor(supabase: any, githubUser: any): Promise<string | null> {
  if (!githubUser || !githubUser.id) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: githubUser.id,
        username: githubUser.login,
        display_name: githubUser.name || null,
        email: githubUser.email || null,
        avatar_url: githubUser.avatar_url || null,
        profile_url: `https://github.com/${githubUser.login}`,
        is_bot: githubUser.type === 'Bot' || githubUser.login.includes('[bot]'),
        is_active: true,
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error upserting contributor:', error);
    return null;
  }

  return data?.id || null;
}
```

**After:**

```typescript
import { ensureContributor } from '../_shared/database.ts';

// That's it! Just use the function
const contributorId = await ensureContributor(supabase, githubUser);
```

### Step 4: Replace Error Responses

**Before:**

```typescript
if (!owner || !name) {
  return new Response(
    JSON.stringify({
      error: 'Missing required fields',
      details: 'Both owner and name are required',
    }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// Repository not found
return new Response(
  JSON.stringify({
    error: 'Repository not found',
  }),
  {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  },
);

// Server error
return new Response(
  JSON.stringify({
    error: 'Sync failed',
    details: error instanceof Error ? error.message : 'Unknown error',
  }),
  {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  },
);
```

**After:**

```typescript
import { handleError, notFoundError, validationError } from '../_shared/responses.ts';

if (!owner || !name) {
  return validationError('Missing required fields', 'Both owner and name are required');
}

// Repository not found
return notFoundError('Repository');

// Server error
try {
  // ... operation
} catch (error) {
  return handleError(error, 'repository sync');
}
```

### Step 5: Replace Success Responses

**Before:**

```typescript
return new Response(
  JSON.stringify({
    success: true,
    processed: processed,
    errors: errors,
    repository: {
      owner,
      name,
    },
  }),
  {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  },
);
```

**After:**

```typescript
import { successResponse } from '../_shared/responses.ts';

return successResponse(
  {
    processed,
    errors,
    repository: { owner, name },
  },
  'Sync completed successfully',
);
```

### Step 6: Replace GitHub API Calls

**Before:**

```typescript
const token = Deno.env.get('GITHUB_TOKEN');
if (!token) {
  throw new Error('GitHub token not configured');
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'Contributor-Info-Bot',
};

const response = await fetch(url, { headers });

if (!response.ok) {
  if (response.status === 404) {
    console.error('Repository not found');
    return [];
  }
  throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
}

const data = await response.json();

// Check rate limit
const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
if (remaining < 100) {
  console.warn('Low rate limit: %s remaining', remaining);
}
```

**After:**

```typescript
import { checkRateLimit, fetchGitHubAPI, getGitHubHeaders } from '../_shared/github.ts';

// Simple fetch
const data = await fetchGitHubAPI(url);

// Or with rate limit checking
const headers = getGitHubHeaders();
const response = await fetch(url, { headers });
const data = await response.json();
checkRateLimit(response);
```

### Step 7: Replace Bot Detection

**Before:**

```typescript
const isBot = user.type === 'Bot' || user.login.includes('[bot]');
```

**After:**

```typescript
import { isBotUser } from '../_shared/github.ts';

const isBot = isBotUser(user.login, user.type);
```

## Complete Example: Before and After

### Before (repository-sync/index.ts - 400 lines)

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GITHUB_API_BASE = 'https://api.github.com';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { owner, name } = await req.json();

    if (!owner || !name) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'Both owner and name are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    // Fetch from GitHub
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Contributor-Info-Bot',
    };

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${name}`, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Repository not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repo = await response.json();

    // Process contributors...
    for (const contributor of contributors) {
      const contributorId = await ensureContributor(supabase, contributor);
      // ...
    }

    return new Response(
      JSON.stringify({
        success: true,
        repository: { owner, name },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

// 40 lines of ensureContributor function...
async function ensureContributor(supabase: any, githubUser: any): Promise<string | null> {
  // ... duplicated logic
}
```

### After (repository-sync/index.ts - ~200 lines)

```typescript
import { createSupabaseClient, ensureContributor } from '../_shared/database.ts';
import {
  corsPreflightResponse,
  handleError,
  notFoundError,
  successResponse,
  validationError,
} from '../_shared/responses.ts';
import { fetchRepository, GITHUB_API_BASE } from '../_shared/github.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const { owner, name } = await req.json();

    if (!owner || !name) {
      return validationError('Missing required fields', 'Both owner and name are required');
    }

    const supabase = createSupabaseClient();

    // Fetch repository
    try {
      const repo = await fetchRepository(owner, name);
    } catch (error) {
      if (error.message.includes('404')) {
        return notFoundError('Repository');
      }
      throw error;
    }

    // Process contributors...
    for (const contributor of contributors) {
      const contributorId = await ensureContributor(supabase, contributor);
      // ...
    }

    return successResponse({ repository: { owner, name } }, 'Sync completed successfully');
  } catch (error) {
    return handleError(error, 'repository sync');
  }
});
```

**Result: 50% reduction in code, much clearer logic!**

## Testing Your Migration

After migrating a function, test it:

1. **Deploy to Supabase:**
   ```bash
   npx supabase functions deploy function-name
   ```

2. **Test locally:**
   ```bash
   npx supabase functions serve function-name
   ```

3. **Call the function:**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/function-name \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"owner":"facebook","name":"react"}'
   ```

4. **Verify response format:**
   - Success responses should have `{ "success": true, "data": {...} }`
   - Error responses should have `{ "success": false, "error": "...", "code": "..." }`

## Checklist

Use this checklist when migrating a function:

- [ ] Replace CORS headers with `corsPreflightResponse()`
- [ ] Replace Supabase client creation with `createSupabaseClient()`
- [ ] Replace contributor upsert with `ensureContributor()`
- [ ] Replace manual error responses with response helpers
- [ ] Replace manual success responses with `successResponse()`
- [ ] Replace GitHub API headers with `getGitHubHeaders()`
- [ ] Replace bot detection with `isBotUser()`
- [ ] Update imports at the top of the file
- [ ] Remove local helper functions now in shared utilities
- [ ] Test the function locally
- [ ] Deploy and verify in production

## Common Issues

### Import errors

Make sure to include `.ts` extension in imports:

```typescript
// ✅ GOOD
import { corsPreflightResponse } from '../_shared/responses.ts';

// ❌ BAD
import { corsPreflightResponse } from '../_shared/responses';
```

### Type errors

Import types correctly:

```typescript
import type { GitHubUser } from '../_shared/database.ts';
```

### Missing CORS on errors

Use response helpers which automatically include CORS:

```typescript
// ✅ GOOD
return validationError('Invalid input');

// ❌ BAD - missing CORS headers
return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
```

## Next Steps

After migrating a function:

1. Update any documentation that references the old patterns
2. Remove any local helper functions that are now in shared utilities
3. Consider migrating related functions to maintain consistency
4. Update tests to work with new response format

## Questions?

See the main [Shared Utilities README](./README.md) for detailed documentation on each utility
module.
