#!/bin/bash

# Fly.io deployment script for social cards service

set -eo pipefail

echo "🚀 Deploying social cards service to Fly.io..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if already logged in
if ! fly auth whoami &> /dev/null; then
    echo "📝 Please log in to Fly.io:"
    fly auth login
fi

# Create app if it doesn't exist
if ! fly apps list | grep -q "contributor-info-social-cards"; then
    echo "📱 Creating new Fly.io app..."
    fly apps create contributor-info-social-cards --org personal
else
    echo "✅ App already exists"
fi

# Set secrets (only if not already set)
echo "🔐 Setting environment secrets..."

# Check if secrets are set
if ! fly secrets list | grep -q "SUPABASE_URL"; then
    read -p "Enter SUPABASE_URL: " SUPABASE_URL
    fly secrets set SUPABASE_URL="$SUPABASE_URL"
fi

if ! fly secrets list | grep -q "SUPABASE_ANON_KEY"; then
    read -s -p "Enter SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
    echo  # Add newline after hidden input
    fly secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
fi

# Deploy the application
echo "🚢 Deploying application..."
fly deploy

# Show deployment status
echo "✨ Deployment complete!"
echo ""
echo "📊 Application status:"
fly status

echo ""
echo "🌐 Your social cards service is available at:"
echo "   https://contributor-info-social-cards.fly.dev"
echo ""
echo "🧪 Test endpoints:"
echo "   https://contributor-info-social-cards.fly.dev/health"
echo "   https://contributor-info-social-cards.fly.dev/social-cards/home"
echo "   https://contributor-info-social-cards.fly.dev/social-cards/repo?owner=facebook&repo=react"