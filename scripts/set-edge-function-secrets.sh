#!/bin/bash

# Script to set Edge Function secrets in Supabase
# This sets the required INNGEST environment variables for the queue-event Edge Function

echo "Setting Edge Function secrets in Supabase..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed"
    exit 1
fi

# Source the .env file to get the values
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

# Use the production INNGEST keys for the Edge Function
INNGEST_API_URL="https://api.inngest.com"
INNGEST_EVENT_KEY="${INNGEST_PRODUCTION_EVENT_KEY}"

if [ -z "$INNGEST_EVENT_KEY" ]; then
    echo "Error: INNGEST_PRODUCTION_EVENT_KEY not found in .env"
    exit 1
fi

# Set the secrets using supabase CLI
echo "Setting INNGEST_API_URL..."
supabase secrets set INNGEST_API_URL="$INNGEST_API_URL"

echo "Setting INNGEST_EVENT_KEY..."
supabase secrets set INNGEST_EVENT_KEY="$INNGEST_EVENT_KEY"

echo "Edge Function secrets have been set successfully!"
echo ""
echo "To verify, run: supabase secrets list"
echo ""
echo "Note: The Edge Function will use these secrets immediately without needing a redeploy."