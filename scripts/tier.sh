#!/bin/bash

# Script to label closed PRs with tier labels
# Usage: ./tier.sh [options]
# Options:
#   --apply                 Apply labels (dry run by default)
#   --limit <number>        Number of PRs to process (default: 100)
#   --repo <owner/repo>     Repository to process (default: current repo)
#   --users <user1,user2>   Comma-separated list of users to filter (optional)

# Default values
DRY_RUN=true
LIMIT=100
REPO=""
USERS=()

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --apply)
            DRY_RUN=false
            shift
            ;;
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --repo)
            REPO="$2"
            shift 2
            ;;
        --users)
            IFS=',' read -r -a USERS <<< "$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--apply] [--limit <number>] [--repo <owner/repo>] [--users <user1,user2>]"
            exit 1
            ;;
    esac
done

# If no repo specified, try to use current repo
if [ -z "$REPO" ]; then
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
    if [ -z "$REPO" ]; then
        echo "Error: Could not determine repository. Please specify with --repo"
        exit 1
    fi
fi

# Display run mode
if [ "$DRY_RUN" = false ]; then
    echo "Running in APPLY mode - labels will be added"
else
    echo "Running in DRY RUN mode - no labels will be added"
    echo "Use --apply flag to actually apply labels"
fi

echo ""
echo "Repository: $REPO"
echo "Limit: $LIMIT PRs"

# Build author filter if users specified
AUTHOR_FILTER=""
if [ ${#USERS[@]} -gt 0 ]; then
    echo "Filtering by users: ${USERS[*]}"
    for user in "${USERS[@]}"; do
        if [ -z "$AUTHOR_FILTER" ]; then
            AUTHOR_FILTER="author:$user"
        else
            AUTHOR_FILTER="$AUTHOR_FILTER author:$user"
        fi
    done
fi

echo ""
echo "Fetching last $LIMIT closed PRs..."

# Get closed PRs
if [ -n "$AUTHOR_FILTER" ]; then
    CLOSED_PRS=$(gh pr list \
        --repo "$REPO" \
        --state closed \
        --limit "$LIMIT" \
        --search "$AUTHOR_FILTER" \
        --json number,title,author,body,additions,deletions,files,labels \
        --jq '.[] | @base64')
else
    CLOSED_PRS=$(gh pr list \
        --repo "$REPO" \
        --state closed \
        --limit "$LIMIT" \
        --json number,title,author,body,additions,deletions,files,labels \
        --jq '.[] | @base64')
fi

if [ -z "$CLOSED_PRS" ]; then
    echo "No closed PRs found from the specified users"
    exit 0
fi

echo ""
echo "Analyzing PRs and assigning tier labels..."
echo ""

# Function to extract conventional commit prefix
get_conventional_prefix() {
    local title="$1"
    # Extract prefix before colon (if exists)
    if [[ "$title" =~ ^([a-z]+)([[:space:]]|$|:).* ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Function to determine tier based on PR characteristics
determine_tier() {
    local additions=$1
    local deletions=$2
    local files=$3
    local title="$4"
    local body="$5"
    local comment_count=$6
    
    # Get conventional commit prefix
    local prefix=$(get_conventional_prefix "$title")
    
    # If no conventional commit prefix, return empty (skip)
    if [ -z "$prefix" ]; then
        echo ""
        return
    fi
    
    # Tier 4 (unlabeled): fix, test, docs, style, refactor, perf, build, ci, revert, improve
    if [[ "$prefix" =~ ^(fix|test|docs|style|refactor|perf|build|ci|revert|chore|improve)$ ]]; then
        echo "tier 4"
        return
    fi
    
    # Calculate total changes
    local total_changes=$((additions + deletions))
    
    # Calculate impact score with comments weighted much higher
    # Comments are weighted 100x more than lines of code
    local impact_score=$((comment_count * 100 + total_changes))
    
    # Tier 1: High impact (15+ comments, or major keywords)
    if [[ $comment_count -ge 15 ]] || \
       [[ "$title" =~ (major|milestone|launch) ]]; then
        echo "tier 1"
    # Tier 2: Medium impact (less than 15 comments but other significant factors)
    elif [[ $impact_score -gt 1500 ]] || \
         [[ $files -gt 10 ]] || \
         [[ "$prefix" == "feat" ]]; then
        echo "tier 2"
    # Tier 3: Lower impact
    else
        echo "tier 3"
    fi
}

# Counters
processed=0
labeled=0
skipped_existing=0
skipped_no_prefix=0
tier4_count=0

# Process each PR
while IFS= read -r pr_data; do
    # Decode the JSON data
    pr_json=$(echo "$pr_data" | base64 --decode)
    
    # Extract PR details
    pr_number=$(echo "$pr_json" | jq -r '.number')
    pr_title=$(echo "$pr_json" | jq -r '.title')
    pr_author=$(echo "$pr_json" | jq -r '.author.login')
    pr_body=$(echo "$pr_json" | jq -r '.body // ""')
    pr_additions=$(echo "$pr_json" | jq -r '.additions')
    pr_deletions=$(echo "$pr_json" | jq -r '.deletions')
    pr_files=$(echo "$pr_json" | jq -r '.files | length')
    pr_labels=$(echo "$pr_json" | jq -r '.labels[].name' | tr '\n' ' ')
    
    # Fetch comment count separately to avoid timeout
    pr_comments=$(gh pr view "$pr_number" --repo "$REPO" --json comments --jq '.comments | length' 2>/dev/null || echo "0")
    
    processed=$((processed + 1))
    
    # Check if PR already has a tier label
    if [[ "$pr_labels" =~ tier\ [1-3] ]]; then
        echo "PR #$pr_number by @$pr_author"
        echo "  Title: $pr_title"
        echo "  ⏭️  Skipping - already has tier label"
        echo ""
        skipped_existing=$((skipped_existing + 1))
        continue
    fi
    
    # Determine tier
    tier=$(determine_tier "$pr_additions" "$pr_deletions" "$pr_files" "$pr_title" "$pr_body" "$pr_comments")
    
    # Skip if no conventional commit format
    if [ -z "$tier" ]; then
        echo "PR #$pr_number by @$pr_author"
        echo "  Title: $pr_title"
        echo "  ⏭️  Skipping - no conventional commit format"
        echo ""
        skipped_no_prefix=$((skipped_no_prefix + 1))
        continue
    fi
    
    echo "PR #$pr_number by @$pr_author"
    echo "  Title: $pr_title"
    echo "  Changes: +$pr_additions -$pr_deletions (${pr_files} files)"
    echo "  Comments: $pr_comments"
    
    if [ "$tier" = "tier 4" ]; then
        echo "  Assigned tier: tier 4 (will remain unlabeled)"
        if [ "$DRY_RUN" = true ]; then
            echo "  [DRY RUN] Would leave unlabeled (tier 4)"
        fi
        tier4_count=$((tier4_count + 1))
    else
        echo "  Assigned tier: $tier"
        if [ "$DRY_RUN" = false ]; then
            echo "  Adding label..."
            gh pr edit "$pr_number" --repo "$REPO" --add-label "$tier"
            echo "  ✓ Label added"
            labeled=$((labeled + 1))
        else
            echo "  [DRY RUN] Would add label: $tier"
            labeled=$((labeled + 1))
        fi
    fi
    echo ""
done <<< "$CLOSED_PRS"

echo "Summary:"
echo "- Total PRs processed: $processed"
echo "- PRs labeled: $labeled"
echo "- PRs skipped (already labeled): $skipped_existing"
echo "- PRs skipped (no conventional commit): $skipped_no_prefix"
echo "- PRs marked as tier 4 (unlabeled): $tier4_count"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "This was a dry run. To apply labels, run:"
    echo "  $0 --apply"
    if [ -n "$AUTHOR_FILTER" ]; then
        echo "  (with the same user filter)"
    fi
fi