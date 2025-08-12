#!/bin/bash

# Fly.io deployment script for GitHub Webhook Handler
set -euo pipefail

echo "🚀 Deploying GitHub Webhook Handler to Fly.io"

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI is not installed. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if logged in to Fly.io
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Please run: fly auth login"
    exit 1
fi

# Function to check if app exists
app_exists() {
    fly apps list | grep -q "contributor-info-webhooks"
}

# Create app if it doesn't exist
if ! app_exists; then
    echo "📱 Creating new Fly app..."
    fly apps create contributor-info-webhooks --org personal
    
    echo "🔐 Setting up secrets..."
    echo "Please provide the following secrets:"
    
    read -p "GitHub App ID: " github_app_id
    fly secrets set GITHUB_APP_ID="$github_app_id" -a contributor-info-webhooks
    
    echo "GitHub App Private Key (paste the entire key, then press Ctrl+D):"
    fly secrets set GITHUB_APP_PRIVATE_KEY --stdin -a contributor-info-webhooks < /dev/stdin
    
    read -p "GitHub Webhook Secret: " webhook_secret
    fly secrets set GITHUB_APP_WEBHOOK_SECRET="$webhook_secret" -a contributor-info-webhooks
    
    read -p "Supabase URL: " supabase_url
    fly secrets set SUPABASE_URL="$supabase_url" -a contributor-info-webhooks
    
    read -p "Supabase Anon Key: " supabase_key
    fly secrets set SUPABASE_ANON_KEY="$supabase_key" -a contributor-info-webhooks
else
    echo "✅ App already exists"
fi

# Deploy the app
echo "🚀 Deploying to Fly.io..."
fly deploy -a contributor-info-webhooks

# Show deployment status
echo "📊 Checking deployment status..."
fly status -a contributor-info-webhooks

# Get the app URL using fly info
app_hostname=$(fly info -a contributor-info-webhooks --json | grep -o '"hostname":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "✅ Deployment complete!"
echo "🌐 Webhook URL: https://${app_hostname}/webhook"
echo ""
echo "📝 Next steps:"
echo "1. Update your GitHub App webhook URL to: https://${app_hostname}/webhook"
echo "2. Verify webhook delivery in GitHub App settings"
echo "3. Monitor logs with: fly logs -a contributor-info-webhooks"
echo "4. View metrics at: https://${app_hostname}/metrics"