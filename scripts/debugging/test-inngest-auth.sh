#!/bin/bash

# Test script to manually trigger Inngest function and capture detailed error logs
# This helps diagnose authorization issues by showing the actual error messages

set -e

echo "🧪 Testing Inngest Production Function Authorization"
echo "=================================================="

# Get Supabase URL and anon key
SUPABASE_URL="https://egcxzonpmmcirmgqdrla.supabase.co"
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2)

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: VITE_SUPABASE_ANON_KEY not found in .env"
  exit 1
fi

echo ""
echo "📍 Testing endpoint: ${SUPABASE_URL}/functions/v1/inngest-prod"
echo ""

# Test 1: OPTIONS request (CORS preflight)
echo "Test 1: OPTIONS request (CORS preflight)"
echo "----------------------------------------"
curl -v -X OPTIONS \
  "${SUPABASE_URL}/functions/v1/inngest-prod" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  2>&1 | grep -E "(< HTTP|< Access-Control|^{)"

echo ""
echo ""

# Test 2: GET request to introspect endpoint (what Inngest does first)
echo "Test 2: GET request (Inngest introspection)"
echo "-------------------------------------------"
curl -v -X GET \
  "${SUPABASE_URL}/functions/v1/inngest-prod" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  2>&1 | grep -E "(< HTTP|^{|error|message|hint)" | head -20

echo ""
echo ""

# Test 3: POST request with minimal payload (simulating Inngest)
echo "Test 3: POST request (simulating Inngest call)"
echo "-----------------------------------------------"
curl -v -X POST \
  "${SUPABASE_URL}/functions/v1/inngest-prod" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  2>&1 | grep -E "(< HTTP|^{|error|message|hint)" | head -30

echo ""
echo ""
echo "✅ Test complete!"
echo ""
echo "📝 Note: Check the Supabase Function Logs for detailed console output:"
echo "   https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla/logs/edge-functions"
