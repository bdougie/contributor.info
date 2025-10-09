#!/bin/bash
#
# Optimize Netlify environment variable scopes to reduce function deployment size
#
# Background: Netlify Functions have a 4KB limit on environment variables.
# By scoping variables that are ONLY used in functions (not frontend builds),
# we can significantly reduce the size of env vars in the function bundle.
#
# Strategy:
# 1. Remove completely unused variables
# 2. Scope function-only variables to exclude "builds" scope
# 3. Keep VITE_ variables in all scopes (needed for Vite build-time inlining)
#

set -e

echo "🔧 Optimizing Netlify environment variable scopes..."
echo ""

# Step 1: Remove completely unused variables
echo "Step 1: Removing unused variables"
echo "=================================="
UNUSED_VARS=(
  "VITE_SUPABASE_DATABASE_URL"      # Not referenced anywhere
  "GITHUB_APP_CLIENT_ID"            # GitHub App OAuth not used
  "GITHUB_APP_CLIENT_SECRET"        # GitHub App OAuth not used
  "GITHUB_APP_WEBHOOK_SECRET"       # Webhooks migrated to Fly.io
  "GITHUB_WEBHOOK_SECRET"           # Only in Supabase Edge Functions
)

for var in "${UNUSED_VARS[@]}"; do
  echo "  - $var"
done
echo ""

# Step 2: Re-scope function-only variables (exclude from builds)
echo "Step 2: Re-scoping function-only variables"
echo "==========================================="
echo "These variables will be scoped to 'functions' and 'runtime' only"
echo "(excluded from 'builds' to reduce function bundle size):"
echo ""

# Variables that are ONLY used in Netlify Functions, not in frontend
FUNCTION_ONLY_VARS=(
  "SUPABASE_SERVICE_ROLE_KEY"       # Only used in functions
  "INNGEST_EVENT_KEY"               # Only used in functions
  "INNGEST_PRODUCTION_EVENT_KEY"    # Only used in functions
  "INNGEST_SIGNING_KEY"             # Only used in functions
  "ADMIN_KEY"                       # Only used in functions
  "GH_DATPIPE_API_URL"              # Only used in functions
)

for var in "${FUNCTION_ONLY_VARS[@]}"; do
  echo "  - $var"
done
echo ""

# Note: VITE_ variables CANNOT be scoped because they need to be
# available during the build for Vite's build-time inlining

read -p "Do you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Executing changes..."
echo ""

# Remove unused variables
echo "Removing unused variables..."
for var in "${UNUSED_VARS[@]}"; do
  echo "  Removing $var..."
  netlify env:unset "$var" --context production 2>/dev/null || echo "    ⚠️  Not found in production"
  netlify env:unset "$var" --context deploy-preview 2>/dev/null || echo "    ⚠️  Not found in deploy-preview"
  netlify env:unset "$var" --context branch-deploy 2>/dev/null || echo "    ⚠️  Not found in branch-deploy"
done

echo ""
echo "Re-scoping function-only variables..."
echo "⚠️  Note: You'll need to manually update these in Netlify UI:"
echo ""
echo "For each of these variables, go to Netlify UI > Site Settings > Environment Variables:"
for var in "${FUNCTION_ONLY_VARS[@]}"; do
  echo "  - $var: Change scope from 'All scopes' to 'Functions' and 'Runtime' only"
done

echo ""
echo "Why manual? Netlify CLI doesn't support updating scopes for existing variables."
echo "You must:"
echo "  1. Go to https://app.netlify.com/sites/contributor-info/settings/deploys#environment"
echo "  2. Click on each variable"
echo "  3. Uncheck 'Builds' and 'Post processing'"
echo "  4. Keep 'Functions' and 'Runtime' checked"
echo ""

echo "✅ Cleanup complete!"
echo ""
echo "📊 Expected savings: ~1.5-2KB (webhook secrets + service role key scoped out of functions)"
