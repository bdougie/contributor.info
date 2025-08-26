#!/bin/bash

echo "🔧 Fixing remaining parsing errors..."

# Fix unescaped forward slashes in regex patterns
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix regex patterns that start with /^/ but have unescaped slashes
  sed -i '' 's|/\^/\[|/\^\\\/\[|g' "$file"
  
  # Fix template literals with malformed syntax
  sed -i '' 's/console.error(`[^`]*: \${error}/console.error(`Error: ${error instanceof Error ? error.message : String(error)}/g' "$file"
  
  # Fix numeric separators (underscores in numbers)
  sed -i '' 's/1_000_000/1000000/g' "$file"
  sed -i '' 's/10_000/10000/g' "$file"
  sed -i '' 's/1_000/1000/g' "$file"
done

echo "✅ Fixed parsing errors"