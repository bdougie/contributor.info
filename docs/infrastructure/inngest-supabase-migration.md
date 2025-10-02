# Inngest Migration to Supabase Edge Functions

## Overview

As of January 2025, Inngest webhook handling has been migrated from Netlify Functions to Supabase Edge Functions to resolve critical bundling issues and improve reliability. All 10 Inngest functions are now fully implemented and operational.

## Problem

The Netlify Functions bundler (esbuild) was converting ES modules to CommonJS format, causing `import.meta` to be undefined. This resulted in consistent 502 errors with the message:

```
TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string or an instance of URL. Received undefined
```

## Solution

By moving Inngest to Supabase Edge Functions (which use Deno runtime with native ES module support), we:
1. Eliminate CommonJS bundling issues entirely
2. Gain 150s timeout (vs 26s on Netlify)
3. Maintain all existing functionality
4. Improve deployment reliability

## Architecture

### Before (Broken)
```
Client → /api/inngest → Netlify Function (CommonJS bundle) → 502 Error
```

### After (Working)
```
Client → /api/inngest → Supabase Edge Function (ES Modules) → Inngest Processing
```

## Implementation Details

### Files Changed

1. **Supabase Function**: `/supabase/functions/inngest-prod/index.ts`
   - Real Inngest SDK integration using `InngestCommHandler`
   - Implements all 10 Inngest functions with full functionality:
     - `capture-pr-details`: Fetch PR data via REST API
     - `capture-pr-details-graphql`: Comprehensive PR capture with GraphQL
     - `capture-pr-reviews`: Store PR review data
     - `capture-pr-comments`: Capture all PR comments
     - `capture-issue-comments`: Store issue comments
     - `capture-repository-issues`: Sync repository issues
     - `capture-repository-sync`: Full repository sync via REST
     - `update-pr-activity`: Calculate and update PR activity metrics
     - `discover-new-repository`: Discover and track new repos
     - `classify-repository-size`: Batch classify repositories

2. **Routing**: `/netlify.toml`
   - Redirects `/api/inngest` to `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod`
   - Includes `X-Forwarded-Host` header for proper host detection

3. **Removed**: `/netlify/functions/inngest-prod.mts` (renamed to `.disabled`)

### Environment Variables Required

Set these in Supabase Dashboard (Settings → Edge Functions → Secrets):

- `INNGEST_APP_ID`: Application ID (default: 'contributor-info')
- `INNGEST_PRODUCTION_EVENT_KEY`: Production event key
- `INNGEST_PRODUCTION_SIGNING_KEY`: Production signing key for webhook verification
- `GITHUB_TOKEN`: GitHub API token for repository operations
- `SUPABASE_URL`: (Auto-set by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY`: (Auto-set by Supabase)

## Deployment

### Deploy the Function

```bash
# Deploy to Supabase
./scripts/deploy-supabase-inngest.sh

# Or manually:
supabase functions deploy inngest-prod --project-ref egcxzonpmmcirmgqdrla
```

### Set Environment Variables

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla/settings/functions)
2. Add the required environment variables as secrets
3. Save changes

### Verify Deployment

```bash
# Test the endpoint
curl https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod

# View logs
supabase functions logs inngest-prod --project-ref egcxzonpmmcirmgqdrla
```

## Monitoring

### Check Function Status
```bash
# View recent logs
supabase functions logs inngest-prod --project-ref egcxzonpmmcirmgqdrla --tail

# Check function health
curl -I https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod
```

### Inngest Dashboard
Monitor job execution at: https://app.inngest.com

## Rollback Plan

If issues occur, rollback by:

1. Update `/netlify.toml` to restore original redirects:
   ```toml
   [[redirects]]
     from = "/api/inngest"
     to = "/.netlify/functions/inngest-prod"
     status = 200
     force = true
   ```

2. Rename the disabled function back:
   ```bash
   mv netlify/functions/inngest-prod.mts.disabled netlify/functions/inngest-prod.mts
   ```

3. Deploy to Netlify:
   ```bash
   git push
   ```

## Benefits

1. **No Bundling Issues**: Deno uses native ES modules, eliminating `import.meta` problems
2. **Longer Timeout**: 150s vs 26s allows for processing larger repositories
3. **Better Isolation**: Separate from main application deployment
4. **Cost Efficiency**: Only charged for actual execution time

## Future Improvements

1. **GraphQL Optimization**: The GraphQL client could be optimized for Deno runtime
2. **Monitoring**: Add structured logging and metrics collection
3. **Testing**: Add integration tests for the Edge Function endpoint
4. **Environment Variable Support**: Update Netlify redirects when environment variable support becomes available

## Related PRs

- PR #873: Initial attempt to use Supabase functions (stubbed)
- PR #881: Continued debugging of import.meta issues
- PR #895: Failed attempt to fix bundling issues in Netlify
- PR #900: Final migration to Supabase Edge Functions (this implementation)