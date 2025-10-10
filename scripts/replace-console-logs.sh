#!/bin/bash

# Script to replace console.log with logger in production code
# This script will:
# 1. Add logger import to files that use console.log
# 2. Replace console.log with logger.log
# 3. Keep console.error as is (errors should always be logged)
# 4. Skip test files, story files, and documentation

set -e

echo "🔍 Finding files with console.log statements..."

# Find all TypeScript/TSX files with console.log, excluding:
# - node_modules
# - .test.ts(x) files
# - .stories.tsx files  
# - docs/
# - dist/
# - .storybook/
files=$(rg -l "console\.log" src/ --type ts --type tsx 2>/dev/null || echo "")

if [ -z "$files" ]; then
  echo "✅ No console.log statements found in source files!"
  exit 0
fi

count=$(echo "$files" | wc -l)
echo "📝 Found $count files with console.log"

# Process each file
for file in $files; do
  # Skip test files
  if [[ "$file" == *".test."* ]] || [[ "$file" == *".stories."* ]]; then
    echo "⏭️  Skipping $file (test/story file)"
    continue
  fi
  
  echo "🔧 Processing $file"
  
  # Check if file already imports logger
  if grep -q "import.*logger.*from.*@/lib/logger" "$file" || grep -q "import.*logger.*from.*'@/lib/logger'" "$file"; then
    echo "   ✓ Logger already imported"
  else
    # Find the last import statement line
    last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
    
    if [ -n "$last_import_line" ]; then
      # Add logger import after last import
      sed -i "${last_import_line}a import { logger } from '@/lib/logger';" "$file"
      echo "   ✓ Added logger import"
    else
      # No imports found, add at top
      sed -i "1i import { logger } from '@/lib/logger';" "$file"
      echo "   ✓ Added logger import at top"
    fi
  fi
  
  # Replace console.log with logger.log (but not console.error, console.warn, etc)
  # Use perl for better regex support
  perl -i -pe 's/console\.log\(/logger.log(/g' "$file"
  echo "   ✓ Replaced console.log with logger.log"
done

echo ""
echo "✅ Migration complete!"
echo "📊 Processed $count files"
echo ""
echo "🧪 Next steps:"
echo "1. Run 'npm run lint' to check for issues"
echo "2. Run 'npm test' to ensure tests pass"
echo "3. Review changes with 'git diff'"
