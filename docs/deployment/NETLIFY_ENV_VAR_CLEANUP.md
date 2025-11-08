# Netlify Environment Variable Cleanup Guide

## Problem

Netlify Functions deployment is failing with error:
```
Your environment variables exceed the 4KB limit imposed by AWS Lambda
```

## Root Cause

The **cumulative size of ALL environment variables** exceeds AWS Lambda's 4KB limit. This is NOT caused by any single variable, but by the total of all variables passed to Netlify Functions.

## Solution

**Key Insight**: `VITE_*` variables are baked into the client bundle at **build time** and should NOT be passed to Lambda functions at runtime.

## Step 1: Remove VITE_* Variables from Netlify Functions

Go to Netlify Dashboard → Site Settings → Build & deploy → Environment variables

**Delete these variables** (they're only needed at build time, not runtime):

```bash
# Client-side only (baked into bundle at build time)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_DATABASE_URL
VITE_ENV
VITE_INNGEST_APP_ID
VITE_OPENAI_API_KEY
VITE_POSTHOG_KEY
VITE_POSTHOG_HOST
VITE_SENTRY_DSN
VITE_DUB_CO_KEY
VITE_DUB_DOMAIN_DEV
VITE_DUB_DOMAIN_PROD
VITE_POLAR_ACCESS_TOKEN
VITE_POLAR_PRODUCT_ID_PRO
VITE_POLAR_PRODUCT_ID_TEAM
VITE_POLAR_ENVIRONMENT
VITE_SLACK_WEBHOOK_ENCRYPTION_KEY
VITE_SLACK_CLIENT_ID
VITE_SLACK_REDIRECT_URI
VITE_POLAR_WEBHOOK_SECRET
VITE_RESEND_API_KEY
```

**Why?** These variables are processed by Vite during the build step and embedded into the client JavaScript bundle. Netlify Functions (AWS Lambda) don't need them because they run server-side.

## Step 2: Remove Unused/Placeholder Variables

**Delete these variables** (they have no value or are not used):

```bash
# Unused placeholders from .env file
SUPABASE_URL (duplicate - keep the one with value)
SUPABASE_MCP_TOKEN
SUPABASE_DB_PASSWORD
INNGEST_SERVE_HOST
INNGEST_SERVE_PATH
INNGEST_LOCAL_SIGNING_KEY
INNGEST_DEV
POSTHOG_PROJECT_ID
DUB_API_KEY (duplicate - DUB_CO_KEY is used)
GITHUB_APP_PRIVATE_KEY (if not using GitHub App)
GITHUB_APP_WEBHOOK_URL (if not using GitHub App)
GITHUB_APP_CALLBACK_URL (if not using GitHub App)
RESEND_API_KEY (if not using Resend)
FLY_API_TOKEN
CHROMATIC_PROJECT_TOKEN (only needed in CI/CD)
STORYBOOK_NETLIFY_SITE_ID (only needed in CI/CD)
MAIN_NETLIFY_SITE_ID (only needed in CI/CD)
```

## Step 3: Keep Only Server-Side Variables Actually Used by Functions

**Keep these variables** (needed by Netlify Functions):

```bash
# Supabase (server-side)
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_TOKEN
SUPABASE_ANON_KEY
SUPABASE_DATABASE_URL
SUPABASE_JWT_SECRET

# Inngest (server-side event handling)
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
INNGEST_PRODUCTION_EVENT_KEY
INNGEST_PRODUCTION_SIGNING_KEY

# GitHub (server-side API calls)
GITHUB_TOKEN
GITHUB_APP_ID (if using GitHub App)
GITHUB_APP_CLIENT_ID (if using GitHub App)
GITHUB_APP_CLIENT_SECRET (if using GitHub App)
GITHUB_APP_WEBHOOK_SECRET (if using GitHub App)
GITHUB_WEBHOOK_SECRET

# Polar Billing (server-side)
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET
POLAR_ENVIRONMENT

# Other server-side services
DUB_CO_KEY (URL shortening)
GH_DATPIPE_KEY
GH_DATPIPE_API_URL
ADMIN_KEY

# Slack (server-side, for OAuth callback)
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI
SLACK_WEBHOOK_ENCRYPTION_KEY

# Application config
BASE_URL
NODE_ENV
NODE_VERSION
NPM_VERSION
```

## Step 4: Verify Configuration

After cleaning up:

1. **Estimated Savings**: Removing ~20 VITE_* variables should save 2-3KB easily
2. **Deploy**: Trigger a new Netlify deployment
3. **Test**: Verify functions work correctly with reduced env vars

## Important Notes

- **Build process still has access to VITE_* variables** via the `.env` file in the repository
- **Netlify Functions only need server-side secrets**, not client-side configuration
- **This won't break the application** - VITE_* variables are already in the built bundle

## Alternative: Configure Netlify to Auto-Exclude VITE_* Variables

If Netlify supports it, add this to `netlify.toml`:

```toml
[functions]
  # Only include non-VITE environment variables
  included_files = []
  # Unfortunately, Netlify doesn't have a native way to exclude env vars by prefix
  # Manual cleanup in dashboard is required
```

## Verification

After cleanup, check the size:

```bash
# List all env vars and their approximate sizes
netlify env:list --json | jq 'to_entries | map({key: .key, size: (.value | length)}) | sort_by(.size) | reverse'
```

Expected result: Total size should be under 3KB after removing VITE_* variables.
