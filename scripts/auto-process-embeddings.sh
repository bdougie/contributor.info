#!/bin/bash

# Automated embeddings backlog processor
# Continuously processes embeddings until backlog is clear
# Prioritizes discussions first (already configured in view)

set -e

echo "🤖 Automated Embeddings Processor"
echo "==================================="
echo ""

# Check if SUPABASE_SERVICE_ROLE_KEY is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required"
  echo "   Export it: export SUPABASE_SERVICE_ROLE_KEY='your-key'"
  exit 1
fi

# Configuration
DELAY_BETWEEN_BATCHES=${1:-15}  # Default 15 seconds between batches
MAX_ITERATIONS=${2:-100}        # Safety limit to prevent infinite loops
PROJECT_REF="egcxzonpmmcirmgqdrla"

echo "⚙️  Configuration:"
echo "   Delay between batches: ${DELAY_BETWEEN_BATCHES}s"
echo "   Max iterations: ${MAX_ITERATIONS}"
echo ""

# Function to get backlog count
get_backlog_count() {
  local count=$(psql "postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
    -t -c "SELECT COUNT(*) FROM items_needing_embeddings;" 2>/dev/null | xargs)
  echo "${count:-0}"
}

# Function to get breakdown by type
get_backlog_breakdown() {
  psql "postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
    -c "SELECT item_type, COUNT(*) as count FROM items_needing_embeddings GROUP BY item_type ORDER BY count DESC;" 2>/dev/null || echo "Failed to get breakdown"
}

# Initial status
echo "📊 Initial Backlog Status:"
get_backlog_breakdown
echo ""

ITERATION=0
TOTAL_PROCESSED=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))

  # Get current backlog count
  BACKLOG_COUNT=$(get_backlog_count)

  if [ "$BACKLOG_COUNT" -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Backlog is clear!"
    echo "   Total batches processed: $ITERATION"
    echo "   Total items processed: $TOTAL_PROCESSED"
    echo ""
    exit 0
  fi

  echo "🔄 Batch $ITERATION"
  echo "   Current backlog: $BACKLOG_COUNT items"

  # Trigger embeddings
  node scripts/trigger-embeddings.mjs

  if [ $? -eq 0 ]; then
    echo "   ✅ Batch triggered successfully"
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + 200))  # Assuming 200 items per batch
  else
    echo "   ❌ Batch failed - retrying in ${DELAY_BETWEEN_BATCHES}s..."
  fi

  # Wait before checking again
  echo "   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}s for processing..."
  sleep $DELAY_BETWEEN_BATCHES
  echo ""
done

echo ""
echo "⚠️  Reached maximum iterations ($MAX_ITERATIONS)"
echo "   Total batches processed: $ITERATION"
echo "   Remaining backlog: $(get_backlog_count) items"
echo ""
echo "💡 Run again to continue processing or increase MAX_ITERATIONS"
