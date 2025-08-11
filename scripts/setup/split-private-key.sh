#!/bin/bash

# Script to split GitHub App private key for Netlify environment variables
# Usage: ./scripts/split-private-key.sh path/to/private-key.pem

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-private-key.pem>"
    exit 1
fi

KEY_FILE="$1"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: File '$KEY_FILE' not found!"
    exit 1
fi

echo "Processing private key..."

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Convert to base64 and remove newlines
base64 -i "$KEY_FILE" | tr -d '\n' > key.b64

# Get the size
KEY_SIZE=$(wc -c < key.b64)
echo "Base64 key size: $KEY_SIZE bytes"

# Force splitting for Netlify (even if key is small)
echo "Splitting key into parts for Netlify..."

# Split into 600-byte chunks (more conservative for Netlify)
split -b 600 key.b64 keypart-

echo ""
echo "Add these to Netlify environment variables:"
echo ""

# Display each part
PART_NUM=1
for file in keypart-*; do
    echo "GITHUB_PEM_PART$PART_NUM=$(cat $file)"
    echo ""
    PART_NUM=$((PART_NUM + 1))
done

echo "Total parts: $((PART_NUM - 1))"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "Done! Copy the environment variable(s) above to your Netlify dashboard."
echo "Go to: Site settings → Environment variables → Add a variable"