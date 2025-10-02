#!/bin/bash

# Set environment variables for Inngest on Supabase
# This script helps configure the required environment variables

set -e

PROJECT_ID="egcxzonpmmcirmgqdrla"

echo "🔐 Setting Environment Variables for Inngest on Supabase"
echo ""
echo "This script will help you set the required environment variables."
echo "You'll need to provide the following values:"
echo ""
echo "1. INNGEST_PRODUCTION_EVENT_KEY - Your Inngest production event key"
echo "2. INNGEST_PRODUCTION_SIGNING_KEY - Your Inngest production signing key"
echo "3. GITHUB_TOKEN - GitHub API token for repository operations"
echo "4. INNGEST_APP_ID - Application ID (default: contributor-info)"
echo ""

# Function to set a secret
set_secret() {
  local key=$1
  local value=$2
  echo "Setting $key..."
  echo "$value" | supabase secrets set $key --project-ref $PROJECT_ID
}

# Check if logged in
if ! supabase projects list &> /dev/null; then
  echo "❌ Not logged in to Supabase"
  echo "   Run: supabase login"
  exit 1
fi

echo "📝 Please enter the following values:"
echo ""

# Get INNGEST_PRODUCTION_EVENT_KEY
read -p "INNGEST_PRODUCTION_EVENT_KEY: " INNGEST_EVENT_KEY
if [ -z "$INNGEST_EVENT_KEY" ]; then
  echo "⚠️  Warning: INNGEST_PRODUCTION_EVENT_KEY is required for production"
fi

# Get INNGEST_PRODUCTION_SIGNING_KEY
read -p "INNGEST_PRODUCTION_SIGNING_KEY: " INNGEST_SIGNING_KEY
if [ -z "$INNGEST_SIGNING_KEY" ]; then
  echo "⚠️  Warning: INNGEST_PRODUCTION_SIGNING_KEY is required for production"
fi

# Get GITHUB_TOKEN
read -p "GITHUB_TOKEN: " GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
  echo "⚠️  Warning: GITHUB_TOKEN is required for GitHub operations"
fi

# Get INNGEST_APP_ID (optional, has default)
read -p "INNGEST_APP_ID (default: contributor-info): " INNGEST_APP_ID
INNGEST_APP_ID=${INNGEST_APP_ID:-contributor-info}

echo ""
echo "🚀 Setting environment variables..."

# Set the secrets
if [ ! -z "$INNGEST_EVENT_KEY" ]; then
  set_secret "INNGEST_PRODUCTION_EVENT_KEY" "$INNGEST_EVENT_KEY"
  set_secret "INNGEST_EVENT_KEY" "$INNGEST_EVENT_KEY"
fi

if [ ! -z "$INNGEST_SIGNING_KEY" ]; then
  set_secret "INNGEST_PRODUCTION_SIGNING_KEY" "$INNGEST_SIGNING_KEY"
  set_secret "INNGEST_SIGNING_KEY" "$INNGEST_SIGNING_KEY"
fi

if [ ! -z "$GITHUB_TOKEN" ]; then
  set_secret "GITHUB_TOKEN" "$GITHUB_TOKEN"
  set_secret "VITE_GITHUB_TOKEN" "$GITHUB_TOKEN"
fi

set_secret "INNGEST_APP_ID" "$INNGEST_APP_ID"

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "🔍 To verify the deployment:"
echo "   ./scripts/test-supabase-inngest.sh"
echo ""
echo "📊 To view function logs:"
echo "   supabase functions logs inngest-prod --project-ref $PROJECT_ID --tail"
echo ""
echo "🔄 To redeploy the function (if needed):"
echo "   ./scripts/deploy-supabase-inngest.sh"