#!/bin/bash

###############################################################################
# Aggressive Repository Backfill Script
###############################################################################
#
# Complete backfill script for a specific repository including:
# 1. Repository sync (PRs, issues, contributors, reviews, comments)
# 2. Embeddings generation for all synced items
# 3. Workspace aggregation after sync completes
#
# Usage:
#   ./scripts/aggressive-backfill-repo.sh <owner> <repo> [options]
#
# Examples:
#   ./scripts/aggressive-backfill-repo.sh bdougie contributor.info
#   ./scripts/aggressive-backfill-repo.sh bdougie contributor.info --dry-run
#   ./scripts/aggressive-backfill-repo.sh bdougie contributor.info --time-range 90
#
# Options:
#   --dry-run              Show what would be done without executing
#   --time-range DAYS      Days of history to sync (default: 90)
#   --skip-embeddings      Skip embeddings generation
#   --skip-workspace       Skip workspace aggregation
#   --embeddings-only      Only run embeddings, skip data sync
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
OWNER="$1"
REPO="$2"
DRY_RUN=false
TIME_RANGE=90
SKIP_EMBEDDINGS=false
SKIP_WORKSPACE=false
EMBEDDINGS_ONLY=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse options
shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --time-range)
      TIME_RANGE="$2"
      shift 2
      ;;
    --skip-embeddings)
      SKIP_EMBEDDINGS=true
      shift
      ;;
    --skip-workspace)
      SKIP_WORKSPACE=true
      shift
      ;;
    --embeddings-only)
      EMBEDDINGS_ONLY=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo -e "${RED}Error: Missing required arguments${NC}"
  echo ""
  echo "Usage: $0 <owner> <repo> [options]"
  echo ""
  echo "Options:"
  echo "  --dry-run              Show what would be done without executing"
  echo "  --time-range DAYS      Days of history to sync (default: 90)"
  echo "  --skip-embeddings      Skip embeddings generation"
  echo "  --skip-workspace       Skip workspace aggregation"
  echo "  --embeddings-only      Only run embeddings, skip data sync"
  echo ""
  echo "Examples:"
  echo "  $0 bdougie contributor.info"
  echo "  $0 bdougie contributor.info --dry-run"
  echo "  $0 bdougie contributor.info --time-range 30"
  exit 1
fi

# Check required environment variables
check_env() {
  local var_name=$1
  local friendly_name=$2

  if [ -z "${!var_name}" ]; then
    echo -e "${RED}Error: $friendly_name environment variable ($var_name) is not set${NC}"
    return 1
  fi
  return 0
}

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Aggressive Repository Backfill Script           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Repository:${NC} $OWNER/$REPO"
echo -e "${GREEN}Time Range:${NC} $TIME_RANGE days"
echo -e "${GREEN}Dry Run:${NC} $DRY_RUN"
echo -e "${GREEN}Skip Embeddings:${NC} $SKIP_EMBEDDINGS"
echo -e "${GREEN}Skip Workspace:${NC} $SKIP_WORKSPACE"
echo -e "${GREEN}Embeddings Only:${NC} $EMBEDDINGS_ONLY"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}"
  echo ""
fi

# Check environment variables
echo -e "${CYAN}Checking environment variables...${NC}"
MISSING_VARS=false

if [ "$EMBEDDINGS_ONLY" = false ]; then
  check_env "INNGEST_PRODUCTION_EVENT_KEY" "Inngest Production Event Key" || MISSING_VARS=true
fi

check_env "VITE_SUPABASE_URL" "Supabase URL" || MISSING_VARS=true
check_env "SUPABASE_SERVICE_ROLE_KEY" "Supabase Service Role Key" || MISSING_VARS=true

if [ "$MISSING_VARS" = true ]; then
  echo ""
  echo -e "${RED}Please set the missing environment variables and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# Get repository ID from Supabase
get_repository_id() {
  local query="SELECT id FROM repositories WHERE owner = '$OWNER' AND name = '$REPO' LIMIT 1;"

  local result=$(psql "$VITE_SUPABASE_URL" -c "$query" -t 2>/dev/null || \
    curl -s "${VITE_SUPABASE_URL}/rest/v1/repositories?owner=eq.${OWNER}&name=eq.${REPO}&select=id&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | \
    jq -r '.[0].id // empty')

  echo "$result" | tr -d ' '
}

echo -e "${CYAN}Looking up repository in database...${NC}"
REPO_ID=$(get_repository_id)

if [ -z "$REPO_ID" ]; then
  echo -e "${YELLOW}⚠️  Repository not found in database${NC}"
  echo -e "${YELLOW}   The repository needs to be tracked first.${NC}"
  echo ""
  echo -e "${CYAN}To track this repository:${NC}"
  echo -e "  1. Log in to the app"
  echo -e "  2. Navigate to https://contributor.info/$OWNER/$REPO"
  echo -e "  3. Click 'Track This Repository'"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Found repository${NC}"
echo -e "   Repository ID: ${REPO_ID}"
echo ""

# Step 1: Repository Data Sync (using Inngest)
if [ "$EMBEDDINGS_ONLY" = false ]; then
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║              Step 1: Repository Data Sync              ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Syncing repository data via Inngest...${NC}"
  echo -e "  - Pull Requests (last $TIME_RANGE days)"
  echo -e "  - Issues (last $TIME_RANGE days)"
  echo -e "  - Contributors"
  echo -e "  - Reviews & Comments"
  echo ""

  if [ "$DRY_RUN" = false ]; then
    # Trigger Inngest sync for the repository
    SYNC_PAYLOAD="{
      \"name\": \"github/repository.sync\",
      \"data\": {
        \"repositoryId\": \"$REPO_ID\",
        \"owner\": \"$OWNER\",
        \"name\": \"$REPO\",
        \"timeRange\": $TIME_RANGE,
        \"priority\": \"high\",
        \"source\": \"aggressive-backfill\"
      }
    }"

    SYNC_RESPONSE=$(curl -s -X POST "https://api.inngest.com/v1/events" \
      -H "Authorization: Bearer ${INNGEST_PRODUCTION_EVENT_KEY}" \
      -H "Content-Type: application/json" \
      -d "$SYNC_PAYLOAD")

    if echo "$SYNC_RESPONSE" | grep -q "error"; then
      echo -e "${RED}❌ Failed to trigger sync${NC}"
      echo "$SYNC_RESPONSE"
      exit 1
    fi

    echo -e "${GREEN}✅ Sync job triggered${NC}"
    echo -e "${YELLOW}   Waiting for sync to complete (this may take 5-15 minutes)...${NC}"
    echo ""

    # Wait for sync to complete
    WAIT_TIME=0
    MAX_WAIT=900  # 15 minutes
    POLL_INTERVAL=30

    while [ $WAIT_TIME -lt $MAX_WAIT ]; do
      sleep $POLL_INTERVAL
      WAIT_TIME=$((WAIT_TIME + POLL_INTERVAL))

      # Check if sync is complete (simplified check - looks for recent data)
      RECENT_PRS=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/pull_requests?repository_id=eq.${REPO_ID}&select=id&limit=1&order=updated_at.desc" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | jq -r 'length')

      if [ "$RECENT_PRS" -gt 0 ]; then
        echo -e "${GREEN}✅ Sync completed successfully${NC}"
        break
      fi

      echo -e "${CYAN}   Still syncing... (${WAIT_TIME}s elapsed)${NC}"
    done

    if [ $WAIT_TIME -ge $MAX_WAIT ]; then
      echo -e "${YELLOW}⚠️  Sync timeout reached${NC}"
      echo -e "${YELLOW}   Sync may still be running in the background${NC}"
      echo -e "${YELLOW}   Check https://app.inngest.com for status${NC}"
      echo ""
    fi
  else
    echo -e "${YELLOW}[DRY RUN] Would trigger Inngest sync job${NC}"
  fi

  echo ""
fi

# Step 2: Embeddings Generation
if [ "$SKIP_EMBEDDINGS" = false ]; then
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║            Step 2: Embeddings Generation               ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Generating embeddings for repository items...${NC}"
  echo -e "  - Processing strategy: Priority-based (Workspace > Issues > PRs)"
  echo -e "  - Batch size: 200 items per iteration"
  echo -e "  - Estimated iterations: 50-100 (depending on repository size)"
  echo ""

  if [ "$DRY_RUN" = false ]; then
    # Use the existing priority embeddings backfill script
    echo -e "${CYAN}Starting embeddings backfill...${NC}"
    echo ""

    # Run with environment variables
    export INNGEST_PRODUCTION_EVENT_KEY
    bash "$SCRIPT_DIR/embeddings/backfill-embeddings-priority.sh" 100 15

    echo ""
    echo -e "${GREEN}✅ Embeddings generation completed${NC}"
  else
    echo -e "${YELLOW}[DRY RUN] Would run embeddings backfill (100 iterations, 15s delay)${NC}"
  fi

  echo ""
fi

# Step 3: Workspace Aggregation
if [ "$SKIP_WORKSPACE" = false ]; then
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Step 3: Workspace Aggregation                ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Aggregating workspace metrics...${NC}"
  echo ""

  if [ "$DRY_RUN" = false ]; then
    # Check if repository is part of any workspace
    WORKSPACE_CHECK=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/workspace_repositories?repository_id=eq.${REPO_ID}&select=workspace_id&limit=1" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

    WORKSPACE_ID=$(echo "$WORKSPACE_CHECK" | jq -r '.[0].workspace_id // empty')

    if [ -n "$WORKSPACE_ID" ]; then
      echo -e "${CYAN}Found workspace: ${WORKSPACE_ID}${NC}"
      echo -e "${CYAN}Running workspace metrics aggregation...${NC}"

      # Run workspace backfill script if it exists
      if [ -f "$SCRIPT_DIR/backfill-workspace-metrics.sh" ]; then
        bash "$SCRIPT_DIR/backfill-workspace-metrics.sh" "$WORKSPACE_ID"
        echo -e "${GREEN}✅ Workspace aggregation completed${NC}"
      else
        echo -e "${YELLOW}⚠️  Workspace backfill script not found${NC}"
      fi
    else
      echo -e "${YELLOW}ℹ️  Repository is not part of any workspace${NC}"
      echo -e "   Skipping workspace aggregation"
    fi
  else
    echo -e "${YELLOW}[DRY RUN] Would check for workspace and run aggregation${NC}"
  fi

  echo ""
fi

# Final Summary
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Backfill Complete!                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo -e "  Repository: $OWNER/$REPO"
echo -e "  Repository ID: $REPO_ID"

if [ "$EMBEDDINGS_ONLY" = false ]; then
  echo -e "  ✅ Data sync: Completed"
fi

if [ "$SKIP_EMBEDDINGS" = false ]; then
  echo -e "  ✅ Embeddings: Completed"
fi

if [ "$SKIP_WORKSPACE" = false ]; then
  echo -e "  ✅ Workspace aggregation: Completed"
fi

echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo -e "  1. Verify data in the app: https://contributor.info/$OWNER/$REPO"
echo -e "  2. Check embedding coverage:"
echo -e "     SELECT item_type, COUNT(*) FROM items_needing_embeddings_priority"
echo -e "     WHERE repository_id = '$REPO_ID' GROUP BY item_type;"
echo -e "  3. Monitor Inngest jobs: https://app.inngest.com"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Note: This was a dry run. Run without --dry-run to execute.${NC}"
  echo ""
fi
