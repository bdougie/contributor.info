#!/bin/bash

# Process embeddings backlog by triggering Inngest multiple times
# Each run processes up to 100 items from items_needing_embeddings view

set -e

echo "🔄 Processing Embeddings Backlog"
echo "=================================="
echo ""

# Check if SUPABASE_SERVICE_ROLE_KEY is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required"
  echo "   Set it in your .env file or export it"
  exit 1
fi

# Number of times to trigger (each processes 100 items)
ITERATIONS=${1:-5}
DELAY=${2:-10}

echo "📊 Configuration:"
echo "   Iterations: $ITERATIONS"
echo "   Delay between triggers: ${DELAY}s"
echo ""

for i in $(seq 1 $ITERATIONS); do
  echo "🚀 Trigger $i/$ITERATIONS..."

  # Trigger embeddings
  node scripts/trigger-embeddings.mjs

  if [ $? -eq 0 ]; then
    echo "✅ Trigger $i completed"
  else
    echo "❌ Trigger $i failed"
    exit 1
  fi

  # Wait before next trigger (except on last iteration)
  if [ $i -lt $ITERATIONS ]; then
    echo "⏳ Waiting ${DELAY}s before next trigger..."
    sleep $DELAY
    echo ""
  fi
done

echo ""
echo "✅ All triggers completed!"
echo ""
echo "📊 Check progress with:"
echo "   psql -h egcxzonpmmcirmgqdrla.supabase.co -U postgres -d postgres -c \"SELECT COUNT(*) FROM items_needing_embeddings;\""
echo ""
echo "🔍 Monitor Inngest jobs at: https://app.inngest.com"
