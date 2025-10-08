#!/bin/bash

# Trigger embeddings computation via Inngest
# This will process all pending items that need embeddings

set -e

# Get the Inngest event key from environment
INNGEST_KEY="${INNGEST_EVENT_KEY:-${INNGEST_PRODUCTION_EVENT_KEY}}"

if [ -z "$INNGEST_KEY" ]; then
  echo "Error: INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY must be set"
  exit 1
fi

echo "Triggering embeddings computation for all pending items..."

curl -X POST https://inn.gs/e/contributor-info \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INNGEST_KEY" \
  -d '{
    "name": "embeddings/compute.requested",
    "data": {
      "forceRegenerate": false,
      "itemTypes": ["issues", "pull_requests", "discussions"]
    }
  }' | jq '.'

echo ""
echo "✅ Embeddings job triggered!"
echo "Check the Inngest dashboard to monitor progress:"
echo "https://app.inngest.com"
