# CODEOWNERS and Workspace Sync Migration to Supabase Edge Functions

## Overview

As of January 2025, the CODEOWNERS API and Workspace Sync API have been migrated from Netlify Functions to Supabase Edge Functions to improve reliability and leverage longer timeout limits.

## Problem

While these APIs didn't have the same bundling issues as Inngest, migrating them provides:
1. **Longer timeouts**: 150s vs 26s (Netlify) - important for large repositories
2. **Platform consistency**: All serverless functions on one platform
3. **Better isolation**: Separate from main application deployment
4. **Cost efficiency**: Only charged for actual execution time

## Solution

By moving both APIs to Supabase Edge Functions (which use Deno runtime with native ES module support), we gain all the benefits of the Supabase platform while maintaining full backward compatibility through Netlify redirects.

## Architecture

### Before
```
Client → /api/repos/:owner/:repo/codeowners → Netlify Function → GitHub API
Client → /.netlify/functions/workspace-sync-simple → Netlify Function → Database
```

### After
```
Client → /api/repos/:owner/:repo/codeowners → Supabase Edge Function → GitHub API
Client → /.netlify/functions/workspace-sync-simple → Supabase Edge Function → Database
```

## Implementation Details

### Files Changed

1. **Supabase Functions**:
   - `/supabase/functions/codeowners/index.ts` - CODEOWNERS API
   - `/supabase/functions/workspace-sync/index.ts` - Workspace sync API

2. **Routing**: `/netlify.toml`
   - Redirects `/api/repos/*/*/codeowners` to Supabase
   - Redirects `/.netlify/functions/workspace-sync-simple` to Supabase
   - Includes `X-Forwarded-Host` header for proper host detection

3. **Archived**:
   - `/netlify/functions/api-codeowners.mts.disabled`
   - `/netlify/functions/workspace-sync-simple.ts.disabled`

### Key Features Preserved

#### CODEOWNERS API
- Database caching of CODEOWNERS files
- GitHub API fallback when not cached
- `?refresh=true` parameter for force refresh
- Rate limiting (60 requests/minute)
- Multi-path search (`.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS`, `.gitlab/CODEOWNERS`)
- Graceful 200 response when file doesn't exist (not 404)
- Repository tracking validation

#### Workspace Sync API
- Rate limiting (10 syncs/hour per workspace)
- Batch repository sync requests
- Updates `tracked_repositories` with `sync_requested_at` timestamp
- Logs sync events to `workspace_sync_logs`
- Triggers Inngest `workspace.metrics.aggregate` event
- In-memory rate limiting (survives across invocations in same container)

### Environment Variables Required

Set these in Supabase Dashboard (Settings → Edge Functions → Secrets):

**CODEOWNERS Function:**
- `GITHUB_TOKEN`: GitHub API token for fetching CODEOWNERS
- `SUPABASE_URL`: (Auto-set by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY`: (Auto-set by Supabase)

**Workspace Sync Function:**
- `INNGEST_PRODUCTION_EVENT_KEY`: For triggering workspace metrics aggregation
- `SUPABASE_URL`: (Auto-set by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY`: (Auto-set by Supabase)

## Deployment

### Deploy the Functions

```bash
# Deploy CODEOWNERS function
supabase functions deploy codeowners --project-ref egcxzonpmmcirmgqdrla

# Deploy Workspace Sync function
supabase functions deploy workspace-sync --project-ref egcxzonpmmcirmgqdrla
```

### Set Environment Variables

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla/settings/functions)
2. Add the required environment variables as secrets
3. Save changes

### Verify Deployment

```bash
# Test CODEOWNERS endpoint
curl "https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/codeowners/repos/open-sauced/ai/codeowners"

# Test Workspace Sync endpoint (requires POST)
curl -X POST "https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/workspace-sync" \
  -H "Content-Type: application/json" \
  -d '{"repositoryIds": ["test-id"], "workspaceId": "test-workspace"}'

# View logs
supabase functions logs codeowners --project-ref egcxzonpmmcirmgqdrla
supabase functions logs workspace-sync --project-ref egcxzonpmmcirmgqdrla
```

## Monitoring

### Check Function Status

```bash
# View recent logs for CODEOWNERS
supabase functions logs codeowners --project-ref egcxzonpmmcirmgqdrla --tail

# View recent logs for Workspace Sync
supabase functions logs workspace-sync --project-ref egcxzonpmmcirmgqdrla --tail

# Check function health
curl -I "https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/codeowners"
curl -I "https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/workspace-sync"
```

### Client Usage

**CODEOWNERS API:**
- Used in: `src/services/reviewer-suggestions.service.ts:29`
- Route: `/api/repos/:owner/:repo/codeowners`
- Optional query param: `?refresh=true`

**Workspace Sync API:**
- Used in: `src/components/features/workspace/WorkspaceAutoSync.tsx:45`
- Used in: `src/components/features/workspace/WorkspaceSyncButton.tsx:41`
- Route: `/.netlify/functions/workspace-sync-simple`
- Method: POST
- Body: `{ repositoryIds: string[], workspaceId?: string }`

## Rollback Plan

If issues occur, rollback by:

1. Update `/netlify.toml` to restore original redirects:
   ```toml
   [[redirects]]
     from = "/api/repos/*/*/codeowners"
     to = "/.netlify/functions/api-codeowners"
     status = 200
     force = true

   [[redirects]]
     from = "/.netlify/functions/workspace-sync-simple"
     to = "/.netlify/functions/workspace-sync-simple"
     status = 200
     force = true
   ```

2. Rename the disabled functions back:
   ```bash
   mv netlify/functions/api-codeowners.mts.disabled netlify/functions/api-codeowners.mts
   mv netlify/functions/workspace-sync-simple.ts.disabled netlify/functions/workspace-sync-simple.ts
   ```

3. Deploy to Netlify:
   ```bash
   git push
   ```

## Benefits

1. **Longer Timeout**: 150s vs 26s allows for processing larger repositories
2. **Platform Consistency**: All serverless functions on Supabase
3. **Better Isolation**: Separate from main application deployment
4. **Native ES Modules**: Deno runtime with no bundling issues
5. **Cost Efficiency**: Only charged for actual execution time
6. **Improved Logging**: Better observability via Supabase dashboard

## Code Changes from Netlify to Supabase

### Key Adaptations

1. **Import Statements**: Changed from `npm:` to `jsr:` imports
   ```typescript
   // Netlify
   import { createClient } from '@supabase/supabase-js';

   // Supabase
   import { createClient } from 'jsr:@supabase/supabase-js@2';
   ```

2. **Environment Variables**: Changed from `process.env` to `Deno.env`
   ```typescript
   // Netlify
   const token = process.env.GITHUB_TOKEN;

   // Supabase
   const token = Deno.env.get('GITHUB_TOKEN');
   ```

3. **Base64 Decoding**: Changed from Node's `Buffer` to web-standard `atob`
   ```typescript
   // Netlify
   Buffer.from(data.content, 'base64').toString('utf-8')

   // Supabase
   atob(data.content.replace(/\s/g, ''))
   ```

4. **Console Logging**: Updated to use secure format strings
   ```typescript
   // Netlify (insecure)
   console.log(`Saved CODEOWNERS for ${owner}/${repo}`)

   // Supabase (secure)
   console.log('Saved CODEOWNERS for %s/%s', owner, repo)
   ```

5. **Request Handler**: Changed from Netlify Handler to Deno.serve
   ```typescript
   // Netlify
   export default async (req: Request, context: Context) => { }

   // Supabase
   Deno.serve(async (req: Request) => { })
   ```

## Testing Checklist

- [x] Build passes without errors
- [ ] CODEOWNERS API returns cached data
- [ ] CODEOWNERS API fetches from GitHub with `?refresh=true`
- [ ] CODEOWNERS API handles non-existent repositories gracefully
- [ ] Workspace Sync API updates repository timestamps
- [ ] Workspace Sync API respects rate limits
- [ ] Workspace Sync API triggers Inngest metrics aggregation
- [ ] Client code works without changes
- [ ] Rate limiting works correctly

## Related Issues

- Issue #1070: Migrate CODEOWNERS and Workspace Sync APIs to Supabase Edge Functions

## Related PRs

- PR #[number]: CODEOWNERS and Workspace Sync Supabase Migration (this implementation)
- PR #900: Inngest Supabase Migration (reference pattern)

## Future Improvements

1. **Shared Rate Limiting**: Move to database-based rate limiting for consistency
2. **Monitoring**: Add structured logging and metrics collection
3. **Testing**: Add integration tests for Edge Function endpoints
4. **Caching**: Implement edge caching for frequently accessed CODEOWNERS files
