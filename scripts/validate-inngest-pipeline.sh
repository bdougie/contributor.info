#!/bin/bash

# Inngest Pipeline Validation Script
# Tests the Inngest integration endpoints and configuration

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URLs
PROD_URL="https://contributor.info"
LOCAL_URL="http://localhost:8888"

echo "========================================"
echo "Inngest Pipeline Validation"
echo "========================================"
echo ""

# Determine which environment to test
ENV="${1:-prod}"
if [ "$ENV" = "local" ]; then
    BASE_URL="$LOCAL_URL"
    echo "Testing LOCAL environment: $BASE_URL"
else
    BASE_URL="$PROD_URL"
    echo "Testing PRODUCTION environment: $BASE_URL"
fi

echo ""

# Test 1: Health Check Endpoint
echo "Test 1: Inngest Health Check"
echo "--------------------------------"
HEALTH_URL="${BASE_URL}/.netlify/functions/inngest-health"
echo "URL: $HEALTH_URL"

if HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>&1); then
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
    BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Health check passed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

        # Check for required keys
        HAS_EVENT_KEY=$(echo "$BODY" | jq -r '.env.hasEventKey' 2>/dev/null)
        HAS_SIGNING_KEY=$(echo "$BODY" | jq -r '.env.hasSigningKey' 2>/dev/null)

        if [ "$HAS_EVENT_KEY" = "true" ]; then
            echo -e "${GREEN}  ✓ INNGEST_EVENT_KEY configured${NC}"
        else
            echo -e "${RED}  ✗ INNGEST_EVENT_KEY missing${NC}"
        fi

        if [ "$HAS_SIGNING_KEY" = "true" ]; then
            echo -e "${GREEN}  ✓ INNGEST_SIGNING_KEY configured${NC}"
        else
            echo -e "${RED}  ✗ INNGEST_SIGNING_KEY missing${NC}"
        fi
    else
        echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY"
    fi
else
    echo -e "${RED}✗ Failed to connect to health endpoint${NC}"
    echo "$HEALTH_RESPONSE"
fi

echo ""

# Test 2: Inngest Introspection (GET request)
echo "Test 2: Inngest Function Introspection"
echo "--------------------------------"
INNGEST_URL="${BASE_URL}/.netlify/functions/inngest-prod"
echo "URL: $INNGEST_URL"

if INNGEST_RESPONSE=$(curl -s -w "\n%{http_code}" "$INNGEST_URL" 2>&1); then
    HTTP_CODE=$(echo "$INNGEST_RESPONSE" | tail -n 1)
    BODY=$(echo "$INNGEST_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Inngest introspection passed (HTTP $HTTP_CODE)${NC}"

        # Count registered functions
        FUNCTION_COUNT=$(echo "$BODY" | jq '.functions | length' 2>/dev/null || echo "0")
        echo -e "${GREEN}  ✓ Registered functions: $FUNCTION_COUNT${NC}"

        # List function names
        if command -v jq &> /dev/null; then
            echo ""
            echo "  Registered Functions:"
            echo "$BODY" | jq -r '.functions[]?.name // empty' 2>/dev/null | while read -r func; do
                echo "    - $func"
            done
        fi
    else
        echo -e "${RED}✗ Inngest introspection failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY"
    fi
else
    echo -e "${RED}✗ Failed to connect to Inngest endpoint${NC}"
    echo "$INNGEST_RESPONSE"
fi

echo ""

# Test 3: Check Environment Variables (local only)
if [ "$ENV" = "local" ]; then
    echo "Test 3: Environment Variables"
    echo "--------------------------------"

    if [ -f .env.local ]; then
        echo -e "${GREEN}✓ .env.local file exists${NC}"

        # Check for required variables (without revealing values)
        REQUIRED_VARS=("INNGEST_EVENT_KEY" "INNGEST_SIGNING_KEY" "SUPABASE_URL" "GITHUB_TOKEN")

        for VAR in "${REQUIRED_VARS[@]}"; do
            if grep -q "^${VAR}=" .env.local; then
                echo -e "${GREEN}  ✓ $VAR configured${NC}"
            else
                echo -e "${YELLOW}  ⚠ $VAR not found in .env.local${NC}"
            fi
        done
    else
        echo -e "${YELLOW}⚠ .env.local file not found${NC}"
    fi
    echo ""
fi

# Test 4: Database Connection Check (requires psql or supabase CLI)
echo "Test 4: Database Health"
echo "--------------------------------"

# Check if we can query the progressive_capture_jobs table
if command -v npx &> /dev/null; then
    echo "Checking for stuck jobs in database..."

    # This would require supabase CLI to be configured
    # For now, just check if we can build the query
    echo -e "${YELLOW}⚠ Skipping database check (requires Supabase CLI)${NC}"
    echo "  To check manually:"
    echo "  SELECT COUNT(*) FROM progressive_capture_jobs WHERE status = 'processing' AND started_at < NOW() - INTERVAL '10 minutes';"
else
    echo -e "${YELLOW}⚠ Skipping database check (npx not available)${NC}"
fi

echo ""

# Summary
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo ""
echo "✓ = Test passed"
echo "✗ = Test failed"
echo "⚠ = Test skipped or warning"
echo ""
echo "For stuck jobs, check:"
echo "  https://supabase.com/dashboard/project/<project-id>/editor"
echo ""
echo "For Inngest dashboard:"
echo "  https://app.inngest.com"
echo ""
echo "Webhook URL should be:"
echo "  $INNGEST_URL"
echo ""
