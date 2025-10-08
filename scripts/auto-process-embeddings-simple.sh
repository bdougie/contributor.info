#!/bin/bash

# Simplified automated embeddings processor
# Uses node script to trigger Inngest repeatedly

set -e

echo "🤖 Automated Embeddings Processor (Simplified)"
echo "==============================================="
echo ""

# Check if SUPABASE_SERVICE_ROLE_KEY is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required"
  echo "   Run: export SUPABASE_SERVICE_ROLE_KEY='your-key'"
  exit 1
fi

# Configuration
DELAY_BETWEEN_BATCHES=${1:-15}
MAX_ITERATIONS=${2:-100}

echo "⚙️  Configuration:"
echo "   Delay between batches: ${DELAY_BETWEEN_BATCHES}s"
echo "   Max iterations: ${MAX_ITERATIONS}"
echo ""

ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))

  echo "🔄 Batch $ITERATION/$MAX_ITERATIONS"

  # Trigger embeddings
  node scripts/trigger-embeddings.mjs

  if [ $? -eq 0 ]; then
    echo "   ✅ Batch triggered successfully"
  else
    echo "   ❌ Batch failed - continuing..."
  fi

  # Wait before next trigger
  if [ $ITERATION -lt $MAX_ITERATIONS ]; then
    echo "   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}s before next batch..."
    sleep $DELAY_BETWEEN_BATCHES
    echo ""
  fi
done

echo ""
echo "✅ Completed $ITERATION batches"
echo ""
echo "📊 Check remaining backlog:"
echo "   SELECT COUNT(*) FROM items_needing_embeddings;"
echo ""
echo "🔍 Monitor at: https://app.inngest.com"
