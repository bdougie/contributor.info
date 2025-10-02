#!/bin/bash

# Test the Supabase Inngest endpoint

ENDPOINT="https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod"

echo "🧪 Testing Supabase Inngest Endpoint"
echo "   Endpoint: $ENDPOINT"
echo ""

# Test 1: Basic connectivity
echo "1️⃣  Testing basic connectivity..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)
if [ "$RESPONSE" == "200" ]; then
    echo "   ✅ Endpoint is reachable (HTTP $RESPONSE)"
else
    echo "   ❌ Endpoint returned HTTP $RESPONSE"
fi

# Test 2: GET request (Inngest introspection)
echo ""
echo "2️⃣  Testing GET request (introspection)..."
RESPONSE=$(curl -s $ENDPOINT)
echo "   Response preview:"
echo "$RESPONSE" | head -3 | sed 's/^/   /'

# Test 3: Check for required headers
echo ""
echo "3️⃣  Testing CORS headers..."
HEADERS=$(curl -sI $ENDPOINT)
if echo "$HEADERS" | grep -q "Access-Control-Allow-Origin"; then
    echo "   ✅ CORS headers present"
else
    echo "   ⚠️  CORS headers may be missing"
fi

# Test 4: OPTIONS preflight
echo ""
echo "4️⃣  Testing OPTIONS preflight..."
RESPONSE=$(curl -s -X OPTIONS -o /dev/null -w "%{http_code}" $ENDPOINT)
if [ "$RESPONSE" == "200" ]; then
    echo "   ✅ OPTIONS request successful (HTTP $RESPONSE)"
else
    echo "   ❌ OPTIONS request failed (HTTP $RESPONSE)"
fi

echo ""
echo "📊 Test Summary:"
echo "   - Endpoint is configured at: $ENDPOINT"
echo "   - This replaces the Netlify function at /api/inngest"
echo "   - Timeout increased from 26s to 150s"
echo ""
echo "🔍 To view live logs:"
echo "   supabase functions logs inngest-prod --project-ref egcxzonpmmcirmgqdrla --tail"