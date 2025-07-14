#!/bin/bash

# Script to prepare GitHub App private key for Netlify environment variable
# This creates a properly formatted single-line key that fits within limits

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-private-key.pem>"
    echo "Example: $0 ~/Downloads/contributor-info.2025-07-13.private-key.pem"
    exit 1
fi

KEY_FILE="$1"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: File '$KEY_FILE' not found!"
    exit 1
fi

echo "Processing private key..."

# Create a properly formatted single-line version
# This removes the header/footer and joins lines
KEY_CONTENT=$(cat "$KEY_FILE" | grep -v "BEGIN RSA PRIVATE KEY" | grep -v "END RSA PRIVATE KEY" | tr -d '\n')

echo ""
echo "Add this to Netlify environment variables:"
echo ""
echo "Key: GITHUB_APP_PRIVATE_KEY_BASE64"
echo "Value: $KEY_CONTENT"
echo ""
echo "The key has been prepared as a single line without headers."
echo "This format works better with Netlify's environment variable system."