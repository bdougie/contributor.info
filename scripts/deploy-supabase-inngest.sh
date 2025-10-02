#!/bin/bash

# Deploy Inngest to Supabase Edge Functions
# This script deploys the Inngest handler to Supabase to avoid CommonJS bundling issues

set -e

echo "🚀 Deploying Inngest to Supabase Edge Functions"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo "   Install it with: brew install supabase/tap/supabase"
    exit 1
fi

# Check if we're logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase"
    echo "   Run: supabase login"
    exit 1
fi

PROJECT_ID="egcxzonpmmcirmgqdrla"

echo "📦 Deploying inngest-prod function..."
supabase functions deploy inngest-prod --project-ref $PROJECT_ID

echo ""
echo "🔐 Setting environment variables..."
echo "   Note: Make sure the following are set in Supabase Dashboard:"
echo "   - INNGEST_APP_ID"
echo "   - INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY"
echo "   - INNGEST_SIGNING_KEY or INNGEST_PRODUCTION_SIGNING_KEY"
echo "   - GITHUB_TOKEN"
echo "   - SUPABASE_URL (automatically set)"
echo "   - SUPABASE_SERVICE_ROLE_KEY (automatically set)"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Inngest endpoint: https://$PROJECT_ID.supabase.co/functions/v1/inngest-prod"
echo ""
echo "🔍 To test the deployment:"
echo "   curl https://$PROJECT_ID.supabase.co/functions/v1/inngest-prod"
echo ""
echo "📊 To view logs:"
echo "   supabase functions logs inngest-prod --project-ref $PROJECT_ID"