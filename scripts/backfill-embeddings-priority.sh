#!/bin/bash

###############################################################################
# Priority Embeddings Backfill Script
###############################################################################
#
# This script continuously triggers embedding generation using the priority
# view which automatically prioritizes:
# 1. Workspace items (highest)
# 2. Issues over PRs
# 3. Recently updated items
#
# Usage:
#   ./scripts/backfill-embeddings-priority.sh [iterations] [delay_seconds]
#
# Examples:
#   ./scripts/backfill-embeddings-priority.sh 50 30   # Run 50 times, 30s delay
#   ./scripts/backfill-embeddings-priority.sh         # Default: 100 times, 15s delay
#
###############################################################################

set -e

# Configuration
ITERATIONS=${1:-100}
DELAY_SECONDS=${2:-15}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Priority Embeddings Backfill Script            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo -e "  Iterations: ${ITERATIONS}"
echo -e "  Delay between iterations: ${DELAY_SECONDS} seconds"
echo -e "  Priority order: Workspace items > Issues > PRs > Discussions"
echo -e "  Batch size: 200 items per iteration"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop at any time${NC}"
echo ""
sleep 2

# Counter for tracking
SUCCESS_COUNT=0
FAIL_COUNT=0

# Main loop
for i in $(seq 1 "$ITERATIONS"); do
  echo -e "${BLUE}[Iteration $i/$ITERATIONS]${NC} Triggering embeddings job..."

  if node "$SCRIPT_DIR/trigger-embeddings.mjs"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "${GREEN}✅ Successfully triggered job $i${NC}"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo -e "${YELLOW}⚠️  Failed to trigger job $i${NC}"
  fi

  # Progress summary every 10 iterations
  if [ $((i % 10)) -eq 0 ]; then
    ESTIMATED_ITEMS=$((i * 200))
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Progress Summary:${NC}"
    echo -e "  Jobs triggered: $i / $ITERATIONS"
    echo -e "  Success: $SUCCESS_COUNT"
    echo -e "  Failed: $FAIL_COUNT"
    echo -e "  Est. items processed: ~$ESTIMATED_ITEMS"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
  fi

  # Don't delay after the last iteration
  if [ "$i" -lt "$ITERATIONS" ]; then
    echo -e "  Waiting ${DELAY_SECONDS}s before next iteration..."
    sleep "$DELAY_SECONDS"
    echo ""
  fi
done

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Backfill Complete!                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Final Summary:${NC}"
echo -e "  Total iterations: $ITERATIONS"
echo -e "  Successful: $SUCCESS_COUNT"
echo -e "  Failed: $FAIL_COUNT"
echo -e "  Est. items processed: ~$((ITERATIONS * 200))"
echo ""
echo -e "${YELLOW}📊 Check progress:${NC}"
echo -e "  Monitor at: https://app.inngest.com"
echo -e "  Check coverage with SQL:"
echo -e "    SELECT item_type, COUNT(*) FROM items_needing_embeddings_priority GROUP BY item_type;"
echo ""
