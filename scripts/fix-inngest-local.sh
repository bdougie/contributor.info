#!/bin/bash

echo "Fixing Inngest local development setup..."

# Check current setup
echo "Current Inngest processes:"
ps aux | grep -i inngest | grep -v grep || echo "No Inngest process found"

echo -e "\nTo fix the issue, you need to:"
echo "1. Stop the current dev server (Ctrl+C in the terminal running npm run dev)"
echo "2. Update your package.json to use the correct endpoint"
echo ""
echo "The dev command should be:"
echo 'npx inngest-cli@latest dev -u http://127.0.0.1:8888/.netlify/functions/inngest-local'
echo ""
echo "Or if you want to use the production functions locally:"
echo 'npx inngest-cli@latest dev -u http://127.0.0.1:8888/.netlify/functions/inngest'
echo ""
echo "3. Restart with: npm run dev"
echo ""
echo "4. Test with this command:"
echo 'curl -X POST http://localhost:8888/.netlify/functions/queue-event -H "Content-Type: application/json" -d '"'"'{"eventName":"test/local.hello","data":{"message":"Test from curl"}}'"'"''