# Netlify Environment Variables Cleanup

## Problem

Netlify Functions deploy failed with:
```
Deploy did not succeed with HTTP Error 400:
Your environment variables exceed the 4KB limit imposed by AWS Lambda
```

## Root Cause

AWS Lambda (which powers Netlify Functions) has a hard limit of 4KB for all environment variables combined. With 44 environment variables, including many JWT tokens and API keys, we exceeded this limit.

## Analysis Performed

### Variables Checked

All `VITE_*` prefixed variables were analyzed to determine:
1. Are they used in the frontend (Vite build)?
2. Are they used in Netlify Functions?
3. Are there duplicate non-VITE versions?

### Results

#### ✅ Safe to Remove (Not Used in Netlify Functions)

**5 variables** can be safely removed from Netlify:

- `VITE_SUPABASE_DATABASE_URL` - Not referenced anywhere in codebase
- `GITHUB_APP_CLIENT_ID` - GitHub App OAuth not used in Netlify functions
- `GITHUB_APP_CLIENT_SECRET` - GitHub App OAuth not used in Netlify functions
- `GITHUB_APP_WEBHOOK_SECRET` - Webhooks migrated to Fly.io (see netlify.toml:96)
- `GITHUB_WEBHOOK_SECRET` - Only used in Supabase Edge Functions (supabase/functions/github-webhook/)

#### ❌ Must Keep (Actively Used in Frontend)

All other VITE_ variables are actively used:

| Variable | Usage |
|----------|-------|
| `VITE_DUB_CO_KEY` | src/lib/dub.ts - Short link generation |
| `VITE_DUB_DOMAIN_DEV` | src/lib/env.ts - Development domain |
| `VITE_DUB_DOMAIN_PROD` | src/lib/env.ts - Production domain |
| `VITE_POLAR_ACCESS_TOKEN` | src/services/polar/subscription.service.ts |
| `VITE_POLAR_PRODUCT_ID_PRO` | src/components/billing/UpgradeModal.tsx |
| `VITE_POLAR_PRODUCT_ID_TEAM` | src/components/billing/UpgradeModal.tsx |
| `VITE_POLAR_WEBHOOK_SECRET` | Polar webhook validation |
| `VITE_POLAR_ENVIRONMENT` | Polar API environment |
| `VITE_POSTHOG_HOST` | src/lib/llm/posthog-openai-service.ts |
| `VITE_POSTHOG_KEY` | src/lib/env.ts - Analytics |
| `VITE_SENTRY_DSN` | src/lib/env.ts - Error tracking |
| `VITE_OPENAI_API_KEY` | src/lib/llm/openai-service.ts, faq-service.ts |
| `VITE_GITHUB_TOKEN` | src/lib/github.ts - API calls |
| `VITE_SUPABASE_URL` | Frontend database access |
| `VITE_SUPABASE_ANON_KEY` | Frontend database access |
| `VITE_INNGEST_APP_ID` | Inngest client configuration |

## Solution

### Two-Part Strategy

#### Part 1: Remove Unused Variables

Run the cleanup script:
```bash
./scripts/cleanup-netlify-env-vars.sh
```

This removes 5 unused variables from all deployment contexts.

#### Part 2: Optimize Variable Scopes (RECOMMENDED)

**Better approach**: Scope function-only variables to exclude the build step:

```bash
./scripts/optimize-netlify-env-scopes.sh
```

This script:
1. Removes unused variables (same as Part 1)
2. Provides instructions to re-scope function-only vars in Netlify UI

**Variables to re-scope** (exclude from "Builds" scope):
- `SUPABASE_SERVICE_ROLE_KEY` - Only used in functions (~500 bytes)
- `INNGEST_EVENT_KEY` - Only used in functions
- `INNGEST_PRODUCTION_EVENT_KEY` - Only used in functions
- `INNGEST_SIGNING_KEY` - Only used in functions
- `ADMIN_KEY` - Only used in functions
- `GH_DATAPIPE_API_URL` - Only used in functions

**Why this works**: Netlify's 4KB limit applies to variables available in each scope. By excluding these from the "Builds" scope, they won't count toward the function deployment limit.

**Important**: VITE_ prefixed variables CANNOT be scoped because Vite needs them during build time for inlining.

### Alternative Solutions Considered

1. **Remove more VITE_ vars**: ❌ All are actively used in the frontend
2. **Migrate functions to Supabase Edge Functions**: ✅ Already in progress (see docs/infrastructure/inngest-supabase-migration.md)
3. **Split functions by env var requirements**: ⚠️ Complex, maintenance burden
4. **Move secrets to external service**: ⚠️ Adds latency and complexity

### Long-term Strategy

Continue migrating functions to Supabase Edge Functions where environment variables can be managed through Supabase's secrets manager, which doesn't have the same 4KB limit.

## Impact

### Part 1 Only (Remove Unused)
- **Size Reduction**: ~500-800 bytes
- **Risk**: Zero - variables not used anywhere
- **Breaking Changes**: None

### Part 2 (Remove + Re-scope)
- **Size Reduction**: ~1.5-2KB total
  - 500-800 bytes from removing unused vars
  - 1KB+ from scoping function-only vars
- **Risk**: Very low - variables still available where needed
- **Breaking Changes**: None (functions still have access)

## Verification

After running the cleanup script:

```bash
# Check remaining variables
netlify env:list

# Verify builds succeed
git push origin main
```

## Related Documentation

- [Inngest Supabase Migration](./inngest-supabase-migration.md)
- [Netlify Functions Configuration](../netlify.toml)
- [Environment Variables Reference](../CONTRIBUTING.md#environment-variables)

## Date

2025-10-09
