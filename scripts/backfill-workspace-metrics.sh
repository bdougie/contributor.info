#!/bin/bash

# Backfill workspace metrics by triggering aggregation for all active workspaces
# This is useful after fixing workspace metrics aggregation bugs

set -e

ITERATIONS=${1:-10}
DELAY=${2:-5}

echo "🔄 Starting workspace metrics backfill"
echo "📊 Iterations: $ITERATIONS"
echo "⏱️  Delay: ${DELAY}s between batches"
echo ""

if [ -z "$INNGEST_EVENT_KEY" ]; then
  echo "❌ Error: INNGEST_EVENT_KEY environment variable not set"
  echo "Set it with: export INNGEST_EVENT_KEY='your-key-here'"
  exit 1
fi

TOTAL_TRIGGERED=0

for i in $(seq 1 $ITERATIONS); do
  echo "[$i/$ITERATIONS] Triggering workspace metrics aggregation..."

  # Call Inngest to trigger aggregation for stale workspaces
  # Note: Event key is part of the URL path, not an auth header
  RESPONSE=$(curl -s -X POST "https://inn.gs/e/$INNGEST_EVENT_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "workspace.metrics.aggregate.scheduled",
      "data": {}
    }')

  if echo "$RESPONSE" | grep -q "ids"; then
    COUNT=$(echo "$RESPONSE" | jq -r '.ids | length' 2>/dev/null || echo "1")
    TOTAL_TRIGGERED=$((TOTAL_TRIGGERED + COUNT))
    echo "   ✅ Triggered batch $i (Events: $COUNT, Total: $TOTAL_TRIGGERED)"
  else
    echo "   ⚠️  Response: $RESPONSE"
  fi

  if [ $i -lt $ITERATIONS ]; then
    echo "   ⏳ Waiting ${DELAY}s..."
    sleep $DELAY
  fi
done

echo ""
echo "✨ Backfill complete!"
echo "📊 Total events triggered: $TOTAL_TRIGGERED"
echo ""
echo "💡 Check Inngest dashboard to monitor progress:"
echo "   https://app.inngest.com/env/production/functions/scheduled-workspace-aggregation"
