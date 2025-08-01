#!/bin/bash

# Script to label closed PRs with tier labels
# Run with --apply flag to actually apply labels (dry run by default)
# This version processes the last 100 closed PRs

# Repository (will use current repo if not specified)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "bdougie/contributor.info")

# Check if --apply flag is provided
DRY_RUN=true
if [[ "$1" == "--apply" ]]; then
    DRY_RUN=false
    echo "Running in APPLY mode - labels will be added"
else
    echo "Running in DRY RUN mode - no labels will be added"
    echo "Use --apply flag to actually apply labels"
fi

echo ""
echo "Repository: $REPO"
echo "Fetching last 100 closed PRs..."

# Get the last 100 closed PRs
# Note: We'll fetch comments separately for each PR to avoid timeout
CLOSED_PRS=$(gh pr list \
    --repo "$REPO" \
    --state closed \
    --limit 100 \
    --json number,title,author,body,additions,deletions,files,labels \
    --jq '.[] | @base64')

if [ -z "$CLOSED_PRS" ]; then
    echo "No closed PRs found"
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
    
    # Tier 1: High impact (30+ comments, or 3000+ impact score, or major keywords)
    if [[ $comment_count -gt 30 ]] || [[ $impact_score -gt 3000 ]] || \
       [[ $files -gt 20 ]] || \
       ([[ "$prefix" == "feat" ]] && [[ $comment_count -gt 20 ]]) || \
       [[ "$title" =~ (major|milestone|launch) ]]; then
        echo "tier 1"
    # Tier 2: Medium impact (15+ comments, or 1500+ impact score, or standard feat)
    elif [[ $comment_count -gt 15 ]] || [[ $impact_score -gt 1500 ]] || \
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
    echo "  ./scripts/tier-100.sh --apply"
fi