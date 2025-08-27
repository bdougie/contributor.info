#!/bin/bash

# Fix console.log security issues by replacing template literals with safer formatting

# Files to fix based on the grep results
declare -a files=(
  "app/services/file-embeddings.ts"
  "app/services/embeddings.ts"
  "app/services/logger.ts"
  "app/services/github-api.ts"
  "app/services/reviewers.ts"
  "app/webhooks/issues.ts"
  "app/webhooks/pull-request.ts"
  "app/webhooks/pull-request-improved.ts"
  "actions/continue-triage/index.ts"
  "supabase/functions/github-backfill/index.ts"
  "supabase/functions/purge-old-file-data/index.ts"
  "supabase/functions/repository-summary/index.ts"
  "supabase/functions/spam-detection/index.ts"
  "supabase/functions/workspace-issues-sync/index.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Fix simple template literal console.logs with single variable
    sed -i '' 's/console\.log(`\([^$]*\)\${\([^}]*\)}\([^`]*\)`)/console.log("\1%s\3", \2)/g' "$file"
    
    # Fix template literals with multiple variables (more complex, handled case by case)
    # These will need manual review
  fi
done

echo "Security fixes applied. Please review the changes."