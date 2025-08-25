#!/bin/bash

# Script to publish the Continue Review action with embedded App credentials
# This should be run by the action maintainer, not by users

set -e

echo "Building Continue Review action with embedded App credentials..."

# Check for required environment variables
if [[ -z "$CONTINUE_REVIEW_APP_ID" || -z "$CONTINUE_REVIEW_APP_PRIVATE_KEY" ]]; then
    echo "Error: CONTINUE_REVIEW_APP_ID and CONTINUE_REVIEW_APP_PRIVATE_KEY must be set"
    exit 1
fi

# Create the embedded config
cat > .app-config.json <<EOF
{
  "appId": $CONTINUE_REVIEW_APP_ID,
  "privateKey": $(echo "$CONTINUE_REVIEW_APP_PRIVATE_KEY" | jq -Rs .)
}
EOF

echo "Created .app-config.json with App ID: $CONTINUE_REVIEW_APP_ID"

# Install dependencies
npm install

# Compile TypeScript
npx tsc index.ts github-app-auth.ts --module esnext --target es2020 --moduleResolution node

echo "Action built successfully with embedded App credentials"
echo ""
echo "Next steps:"
echo "1. Commit the compiled files (but NOT .app-config.json to public repo)"
echo "2. Tag and release the action"
echo "3. Users can now use the action without providing credentials"