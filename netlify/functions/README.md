# Netlify Functions

This directory contains all Netlify serverless functions for the contributor.info application.

## Directory Structure

```
netlify/functions/
├── __tests__/              # Test files for functions
├── _shared/                # Shared utilities and helpers
├── lib/                    # Function-specific libraries
├── backfill-*.ts          # Manual backfill endpoints
├── api-*.mts              # API endpoints
├── health-*.mts           # Health check endpoints
├── inngest-*.mts          # Inngest integration endpoints
└── workspace-*.ts         # Workspace-related endpoints
```

## Manual Backfill Functions

The manual backfill service consists of several endpoints:

- `backfill-trigger.mts` - Create a `datapipe_jobs` row and a one-off Fly machine that runs the backfill
- `backfill-status.mts` - Read the job row (the machine writes progress into it)
- `backfill-cancel.mts` - Mark the row cancelled and destroy the machine

Shared code: `lib/datapipe-jobs.mts` (job rows) and `lib/fly-machines.mts` (Fly Machines API).

### Configuration

These functions require environment variables to be set:
- `FLY_DATAPIPE_TOKEN` - Fly deploy token scoped to `gh-datapipe-sync`
- `FLY_DATAPIPE_IMAGE` - image tag printed by `gh-datapipe/scripts/deploy-to-fly.sh`
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - to read and write `datapipe_jobs`

See [gh-datapipe scale-to-zero](../../docs/infrastructure/datapipe-scale-to-zero.md) for the full setup.

## Important: File Path Convention

⚠️ **Files must be placed directly in `netlify/functions/` directory**

Netlify functions must follow this structure:
- ✅ `netlify/functions/function-name.ts`
- ❌ `netlify/functions/subfolder/function-name.ts` (won't be recognized as a function)
- ❌ `netlify/functions/netlify/functions/function-name.ts` (duplicate path - causes 404)

If you encounter 404 errors, check that:
1. Functions are in the correct directory
2. No duplicate `netlify/functions` paths exist
3. Function files are at the root level of `netlify/functions/`

## Configuration Checks

The backfill functions never throw at import time. Each handler calls
`isConfigured()` / `getSupabaseAdmin()` first and returns `503 SERVICE_UNAVAILABLE`
when the Fly or Supabase variables are missing, so a misconfigured deploy fails
with a readable JSON body instead of a 500.

## Debugging 404 Errors

If you encounter 404 errors:

1. **Check function logs** in Netlify dashboard
2. **Verify environment variables** are set in Netlify
3. **Test locally** with Netlify CLI:
   ```bash
   netlify dev
   ```
4. **Check file paths** - ensure no duplicate directories
5. **Verify redirects** in `netlify.toml` match your endpoints

## Common Issues and Solutions

### Issue: 404 Not Found on function endpoints
**Solution**: Check that environment variables are set and functions are in the correct directory

### Issue: 503 Service Unavailable
**Solution**: This is expected when `FLY_DATAPIPE_TOKEN`, `FLY_DATAPIPE_IMAGE` or `SUPABASE_SERVICE_ROLE_KEY` is not configured. Add the required environment variables.

### Issue: Function doesn't load
**Solution**: Ensure the function uses lazy initialization and doesn't throw errors in the constructor

### Issue: CORS errors
**Solution**: Add proper CORS headers in function responses