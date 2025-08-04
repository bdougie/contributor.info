#!/bin/bash

echo "🚀 Starting Inngest Local Development Setup"
echo ""

# Check if netlify dev is running
if ! curl -s http://localhost:8888 > /dev/null 2>&1; then
    echo "❌ Netlify dev is not running!"
    echo "Please run in another terminal: netlify dev --port 8888"
    echo ""
    exit 1
else
    echo "✅ Netlify dev is running on port 8888"
fi

echo ""
echo "📦 Starting Inngest Dev Server..."
echo "Using endpoint: http://localhost:8888/.netlify/functions/inngest-local-full"
echo ""

# Start Inngest dev server with the full function endpoint
npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local-full

echo ""
echo "💡 Tips:"
echo "1. Visit http://localhost:8288 to see the Inngest Dev UI"
echo "2. Check http://localhost:8288/functions to see registered functions"
echo "3. Send test events from http://localhost:8288/test"
echo ""