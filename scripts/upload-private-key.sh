#!/bin/bash

# Script to upload GitHub App private key to Netlify Blobs
# Usage: ./scripts/upload-private-key.sh path/to/private-key.pem

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-private-key.pem> [site-url]"
    echo "Example: $0 ~/Downloads/key.pem https://deploy-preview-212--contributor-info.netlify.app"
    exit 1
fi

KEY_FILE="$1"
SITE_URL="${2:-https://contributor.info}"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: File '$KEY_FILE' not found!"
    exit 1
fi

# Check for ADMIN_KEY
if [ -z "$ADMIN_KEY" ]; then
    echo "Error: ADMIN_KEY environment variable not set!"
    echo "Set it with: export ADMIN_KEY=your-secret-key"
    exit 1
fi

echo "Encoding private key..."
ENCODED_KEY=$(base64 -i "$KEY_FILE" | tr -d '\n')

echo "Uploading to $SITE_URL/api/github/setup-private-key"

# Upload using curl
RESPONSE=$(curl -s -X POST \
  "$SITE_URL/api/github/setup-private-key" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_KEY" \
  -d "{\"privateKey\": \"$ENCODED_KEY\"}")

# Check response
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Success! Private key has been uploaded to Netlify Blobs"
    echo "$RESPONSE" | jq .
else
    echo "❌ Failed to upload private key"
    echo "$RESPONSE" | jq .
    exit 1
fi