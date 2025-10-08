#!/bin/bash

# Check if Inngest secrets are properly set in Supabase
# Does NOT expose actual secret values, only verifies they exist and are valid

set -e

echo "🔍 Checking Supabase Secrets for Inngest"
echo "========================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not installed"
  echo "   Install with: brew install supabase/tap/supabase"
  exit 1
fi

echo "✅ Supabase CLI installed"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
  echo "❌ Not logged in to Supabase"
  echo "   Login with: supabase login"
  exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

echo "📋 Checking secrets..."
echo ""

# List all secrets (this only shows names, not values)
SECRETS=$(supabase secrets list --project-ref egcxzonpmmcirmgqdrla 2>&1)

if echo "$SECRETS" | grep -q "INNGEST_SIGNING_KEY\|INNGEST_PRODUCTION_SIGNING_KEY"; then
  echo "✅ Signing key found in Supabase secrets"
else
  echo "❌ INNGEST_SIGNING_KEY or INNGEST_PRODUCTION_SIGNING_KEY not found"
  echo "   Set with: supabase secrets set INNGEST_SIGNING_KEY=signkey-prod-..."
  exit 1
fi

if echo "$SECRETS" | grep -q "INNGEST_EVENT_KEY\|INNGEST_PRODUCTION_EVENT_KEY"; then
  echo "✅ Event key found in Supabase secrets"
else
  echo "❌ INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY not found"
  echo "   Set with: supabase secrets set INNGEST_EVENT_KEY=..."
  exit 1
fi

echo ""
echo "✅ All required secrets are set!"
echo ""
echo "📝 Next steps:"
echo "1. Verify keys match in Inngest Dashboard: https://app.inngest.com"
echo "2. Sync the app in Inngest Dashboard"
echo "3. Test with: ./scripts/test-inngest-auth.sh"
echo ""
echo "To update secrets:"
echo "  supabase secrets set INNGEST_SIGNING_KEY=signkey-prod-..."
echo "  supabase secrets set INNGEST_EVENT_KEY=..."
echo "  supabase functions deploy inngest-prod"
