# Supabase Authentication Keys and RLS

## Overview

This document explains the proper usage of Supabase authentication keys in contributor.info, particularly regarding Row Level Security (RLS) policies and database operations.

## Key Types

### 1. Anon Key (Public)
- **Location**: `VITE_SUPABASE_ANON_KEY` environment variable
- **Usage**: Browser-side operations, client authentication
- **Limitations**: Subject to RLS policies
- **Security**: Safe to expose in browser bundles

### 2. Service Role Key (Private)
- **Location**: `SUPABASE_SERVICE_ROLE_KEY` environment variable (server-only)
- **Usage**: Server-side operations that need to bypass RLS
- **Capabilities**: Full database access, bypasses all RLS policies
- **Security**: MUST NEVER be exposed to browser

## Current Architecture

### Browser Components
Components like `WorkspaceSyncButton` and `WorkspaceAutoSync` run in the browser and use the anon key:

```typescript
// Browser-side code uses anon key
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
headers['Authorization'] = `Bearer ${anonKey}`;
```

### Edge Functions
The actual workspace-sync Edge Function running on Supabase should use the service role key to bypass RLS:

```typescript
// Edge function uses service role key
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Bypasses RLS
  {
    auth: {
      persistSession: false,
    },
  }
);
```

## RLS Impact

### Why Service Role Key is Needed

Our RLS policies restrict write operations to authenticated users:
- **Read**: Public access allowed
- **Insert/Update/Delete**: Requires authentication

When the workspace-sync function needs to update `last_synced_at` timestamps or insert new data, it requires the service role key to bypass these restrictions.

### Security Best Practices

1. **Never expose service role key to browser**: Use it only in server-side functions
2. **Use environment variables**: Avoid hardcoding URLs or keys
3. **Separate concerns**: Browser initiates sync, server performs database operations
4. **Audit usage**: Track where service role key is used

## Implementation Notes

### Current Setup
- Browser components trigger sync via API endpoint
- In development: Direct call to Supabase Edge Function
- In production: Netlify redirect to Supabase Edge Function
- Edge Function uses service role key for database operations

### Environment Variables
```bash
# Browser-safe (VITE_ prefix)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server-only (no VITE_ prefix)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Migration Path

If we need browser components to perform operations that require bypassing RLS:

1. **Create server-side API endpoint**: Netlify Function or Edge Function
2. **Validate user permissions**: Check authentication/authorization
3. **Use service role key**: Perform database operations server-side
4. **Return results**: Send response back to browser

This ensures security while maintaining functionality.