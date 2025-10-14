#!/bin/bash

# Deploy workspace-sync function without JWT verification
echo "Deploying workspace-sync function without JWT verification..."

# First, check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    npm install -g supabase
fi

# Deploy the function with --no-verify-jwt flag
echo "Deploying workspace-sync function..."
supabase functions deploy workspace-sync --no-verify-jwt --project-ref egcxzonpmmcirmgqdrla

# Check deployment status
echo "Checking deployment status..."
supabase functions list --project-ref egcxzonpmmcirmgqdrla | grep workspace-sync

echo "Deployment complete!"
echo ""
echo "To test the function, run:"
echo "curl -X POST https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/workspace-sync \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"repositoryIds\": [], \"workspaceId\": \"test\"}'"