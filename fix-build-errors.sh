#!/bin/bash

echo "🔧 Fixing TypeScript parsing errors that block the build..."

# Fix unescaped forward slashes in regex patterns
echo "Fixing regex patterns..."

# Fix src/lib/utils.ts
sed -i '' "s|const trimmedPath = path.trim().replace(/^/+\|/+\$/g, '');|const trimmedPath = path.trim().replace(/^\/+\|\/+\$/g, '');|" src/lib/utils.ts
sed -i '' "s|const repoPathRegex = /^\\[a-zA-Z0-9._-\\]+/\\[a-zA-Z0-9._-\\]+\$/;|const repoPathRegex = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\$/;|" src/lib/utils.ts

# Fix numeric separators
echo "Fixing numeric separators..."
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i '' 's/1_000_000/1000000/g' "$file"
  sed -i '' 's/100_000/100000/g' "$file"
  sed -i '' 's/10_000/10000/g' "$file"
  sed -i '' 's/1_000/1000/g' "$file"
done

# Fix template literal issues
echo "Fixing template literals..."
# Fix patterns like ${error} in console statements
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix malformed template literals in console statements
  sed -i '' 's/console.error(`[^`]*\${error}/console.error(`Error: ${error instanceof Error ? error.message : String(error)}/g' "$file"
done

echo "✅ Fixed critical build errors"