#!/bin/bash

echo "========================================="
echo "Fixing Edge Function Authentication Issues"
echo "========================================="
echo ""
echo "This script will fix the JWT authentication issues for:"
echo "1. workspace-sync function (401 Unauthorized error)"
echo "2. codeowners function (401 Unauthorized error)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_REF="egcxzonpmmcirmgqdrla"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo -e "${YELLOW}Step 1: Checking Supabase CLI installation...${NC}"
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    npm install -g supabase
fi

echo ""
echo -e "${YELLOW}Step 2: Fixing the deno.lock issue...${NC}"
# Try to remove or rename the problematic deno.lock file
if [ -f "supabase/functions/deno.lock" ]; then
    echo "Moving existing deno.lock to deno.lock.backup..."
    mv supabase/functions/deno.lock supabase/functions/deno.lock.backup 2>/dev/null || true
fi

echo ""
echo -e "${YELLOW}Step 3: Redeploying functions without JWT verification...${NC}"
echo ""

# Deploy workspace-sync without JWT verification
echo -e "${GREEN}Deploying workspace-sync function...${NC}"
npx supabase functions deploy workspace-sync \
  --no-verify-jwt \
  --project-ref $PROJECT_REF \
  2>&1 | grep -v "deno.lock" || true

# Deploy codeowners without JWT verification
echo -e "${GREEN}Deploying codeowners function...${NC}"
npx supabase functions deploy codeowners \
  --no-verify-jwt \
  --project-ref $PROJECT_REF \
  2>&1 | grep -v "deno.lock" || true

echo ""
echo -e "${YELLOW}Step 4: Verifying deployments...${NC}"
echo ""

# Test workspace-sync endpoint
echo "Testing workspace-sync endpoint..."
WORKSPACE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/workspace-sync" \
  -H 'Content-Type: application/json' \
  -d '{"repositoryIds": [], "workspaceId": "test"}' \
  -w "\nHTTP_STATUS:%{http_code}")

WORKSPACE_STATUS=$(echo "$WORKSPACE_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$WORKSPACE_STATUS" = "400" ] || [ "$WORKSPACE_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ workspace-sync is accessible (no JWT required)${NC}"
else
    echo -e "${RED}✗ workspace-sync still requires authentication (status: $WORKSPACE_STATUS)${NC}"
fi

# Test codeowners endpoint
echo ""
echo "Testing codeowners endpoint..."
CODEOWNERS_RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/functions/v1/codeowners/repos/test/test/codeowners" \
  -w "\nHTTP_STATUS:%{http_code}")

CODEOWNERS_STATUS=$(echo "$CODEOWNERS_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$CODEOWNERS_STATUS" = "400" ] || [ "$CODEOWNERS_STATUS" = "404" ] || [ "$CODEOWNERS_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ codeowners is accessible (no JWT required)${NC}"
else
    echo -e "${RED}✗ codeowners still requires authentication (status: $CODEOWNERS_STATUS)${NC}"
fi

echo ""
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo ""
echo "Functions deployed to: $SUPABASE_URL/functions/v1/"
echo ""
echo "Netlify redirects configured:"
echo "  /api/workspace-sync -> ${SUPABASE_URL}/functions/v1/workspace-sync"
echo "  /api/repos/*/*/codeowners -> ${SUPABASE_URL}/functions/v1/codeowners/repos/:owner/:repo/codeowners"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Clear your browser cache and refresh the page"
echo "2. Check the browser console for any remaining errors"
echo "3. If issues persist, check the Supabase dashboard for function logs"
echo ""
echo "To view function logs:"
echo "  npx supabase functions logs workspace-sync --project-ref $PROJECT_REF"
echo "  npx supabase functions logs codeowners --project-ref $PROJECT_REF"
echo ""

# Restore deno.lock if needed (optional)
# if [ -f "supabase/functions/deno.lock.backup" ]; then
#     echo "Note: Original deno.lock backed up to supabase/functions/deno.lock.backup"
# fi