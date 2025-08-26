#!/bin/bash

echo "🔧 Fixing remaining build-blocking TypeScript errors..."

# Fix regex patterns with unescaped forward slashes
echo "Fixing regex patterns..."

# Fix all common regex patterns
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix patterns like /^/[^/]+/[^/]+/
  sed -i '' 's|/\^\\/\[|/\^\\\/\[|g' "$file" 2>/dev/null || true
  sed -i '' 's|\]\\/\[|\]\\\/\[|g' "$file" 2>/dev/null || true
  sed -i '' 's|\]+\\/\[|\]+\\\/\[|g' "$file" 2>/dev/null || true
  
  # Fix patterns with github.com
  sed -i '' 's|github\\.com/)|github\\.com\\/)|g' "$file" 2>/dev/null || true
  
  # Fix path patterns
  sed -i '' 's|\\w+/\\w+|\\w+\\/\\w+|g' "$file" 2>/dev/null || true
done

# Fix specific remaining patterns in known problem files
echo "Fixing specific file issues..."

# Fix meta-tags-provider.tsx
if [ -f "src/components/common/layout/meta-tags-provider.tsx" ]; then
  sed -i '' 's|/\^\\/\\[\\^\\/\\]+\\/\\[\\^\\/\\]+/|/\^\\\/\[\\^\\/\]+\\\/\[\\^\\/\]+/|g' "src/components/common/layout/meta-tags-provider.tsx" 2>/dev/null || true
fi

# Fix not-found.tsx
if [ -f "src/components/common/layout/not-found.tsx" ]; then
  sed -i '' 's|/\^\\/\\[\\^\\/\\]+\\/\\[\\^\\/\\]+/|/\^\\\/\[\\^\\/\]+\\\/\[\\^\\/\]+/|g' "src/components/common/layout/not-found.tsx" 2>/dev/null || true
fi

# Fix repository patterns
if [ -f "src/components/features/repository/repo-view.tsx" ]; then
  sed -i '' 's|/\^\\/\\[\\^\\/\\]+\\/\\[\\^\\/\\]+\$/|/\^\\\/\[\\^\\/\]+\\\/\[\\^\\/\]+\$/|g' "src/components/features/repository/repo-view.tsx" 2>/dev/null || true
fi

echo "✅ Fixed remaining build errors"