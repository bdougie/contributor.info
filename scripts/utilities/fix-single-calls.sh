#!/bin/bash

# Script to replace .single() with .maybeSingle() in all TypeScript files
# This fixes the 406 error issue when queries return 0 rows

echo "Starting replacement of .single() with .maybeSingle()..."

# Files to process
files=(
  "src/lib/progressive-capture/queue-manager.ts"
  "src/lib/progressive-capture/rollout-manager.ts"
  "src/lib/progressive-capture/queue-prioritization.ts"
  "src/lib/progressive-capture/ai-summary-processor.ts"
  "src/lib/progressive-capture/enhanced-hybrid-router.ts"
  "src/lib/progressive-capture/review-comment-processor.ts"
  "src/lib/progressive-capture/manual-trigger.ts"
  "src/lib/progressive-capture/job-status-reporter.ts"
  "src/lib/progressive-capture/auto-track-on-404.ts"
  "src/lib/inngest/functions/capture-pr-details-graphql.ts"
  "src/lib/inngest/functions/capture-repository-sync-graphql.ts"
  "src/lib/inngest/functions/capture-repository-sync-enhanced.ts"
  "src/lib/inngest/functions/discover-new-repository.ts"
  "src/lib/inngest/functions/capture-repository-sync.ts"
  "src/lib/inngest/functions/capture-pr-reviews.ts"
  "src/lib/inngest/functions/capture-pr-details.ts"
  "src/lib/inngest/functions/capture-pr-comments.ts"
  "src/lib/inngest/functions/update-pr-activity.ts"
  "src/lib/inngest/functions/generate-embeddings.ts"
  "src/lib/inngest/sync-logger.ts"
  "src/lib/llm-citation-tracking.ts"
  "src/lib/insights/health-metrics.ts"
  "src/lib/spam/PRTemplateService.ts"
  "src/lib/spam/PRAnalysisService.ts"
  "src/lib/dub.ts"
  "src/hooks/use-admin-auth.ts"
  "src/hooks/use-on-demand-sync.ts"
)

# Counter for replacements
total_replacements=0

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Count occurrences before replacement
    count=$(grep -c "\.single()" "$file" 2>/dev/null || echo 0)
    
    if [ "$count" -gt 0 ]; then
      echo "Processing $file - found $count occurrences..."
      
      # Create backup
      cp "$file" "$file.backup"
      
      # Replace .single() with .maybeSingle()
      sed -i '' 's/\.single()/\.maybeSingle()/g' "$file"
      
      # Verify replacement
      new_count=$(grep -c "\.single()" "$file" 2>/dev/null || echo 0)
      
      if [ "$new_count" -eq 0 ]; then
        echo "  ✅ Successfully replaced all occurrences in $file"
        total_replacements=$((total_replacements + count))
        rm "$file.backup"
      else
        echo "  ⚠️  Some occurrences may remain in $file"
        mv "$file.backup" "$file"
      fi
    fi
  fi
done

echo ""
echo "✅ Replacement complete!"
echo "Total replacements made: $total_replacements"
echo ""
echo "Now running TypeScript type check to verify changes..."
npm run typecheck

echo ""
echo "Script complete. Please review the changes and test thoroughly."