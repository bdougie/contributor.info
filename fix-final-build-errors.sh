#!/bin/bash

echo "🔧 Fixing final TypeScript parsing errors blocking build..."

# Fix regex patterns with unescaped forward slashes
echo "Fixing regex patterns..."

# 1. Fix meta-tags-provider.tsx
if [ -f "src/components/common/layout/meta-tags-provider.tsx" ]; then
  echo "Fixing meta-tags-provider.tsx..."
  sed -i '' 's|/\^\\/\[|\\/\\^\\\\\\\/\\[|g' "src/components/common/layout/meta-tags-provider.tsx"
  sed -i '' 's|/\^\\/\\([^/]*\\)/\\([^/]*\\)/|/\\^\\\\\\\/\\([^\\\\/]*\\)\\\\\\\/\\([^\\\\/]*\\)/|g' "src/components/common/layout/meta-tags-provider.tsx"
fi

# 2. Fix not-found.tsx
if [ -f "src/components/common/layout/not-found.tsx" ]; then
  echo "Fixing not-found.tsx..."
  sed -i '' 's|/\[^\\/\]+/\[^\\/\]+/|/\\[^\\\\\\/\\]+\\\\\\/\\[^\\\\\\/\\]+/|g' "src/components/common/layout/not-found.tsx"
fi

# 3. Fix spam-test-tool.tsx
if [ -f "src/components/features/admin/spam-test-tool.tsx" ]; then
  echo "Fixing spam-test-tool.tsx..."
  sed -i '' 's|github\\.com/\\([^)]*\\)|github\\.com\\\\/\\1|g' "src/components/features/admin/spam-test-tool.tsx"
  sed -i '' 's|\\w+/\\w+|\\\\w+\\\\/\\\\w+|g' "src/components/features/admin/spam-test-tool.tsx"
fi

# 4. Fix distribution-treemap-enhanced.tsx
if [ -f "src/components/features/distribution/distribution-treemap-enhanced.tsx" ]; then
  echo "Fixing distribution-treemap-enhanced.tsx..."
  sed -i '' 's|/\\w+\$/|/\\\\w+\$/|g' "src/components/features/distribution/distribution-treemap-enhanced.tsx"
fi

# 5. Fix repo-view.tsx
if [ -f "src/components/features/repository/repo-view.tsx" ]; then
  echo "Fixing repo-view.tsx..."
  sed -i '' 's|/\^\\/\\([^/]*\\)/\\([^/]*\\)\$/|/\\^\\\\\\\/\\([^\\\\/]*\\)\\\\\\\/\\([^\\\\/]*\\)\$/|g' "src/components/features/repository/repo-view.tsx"
fi

# 6. Fix svg-sprite-loader.tsx
if [ -f "src/components/ui/svg-sprite-loader.tsx" ]; then
  echo "Fixing svg-sprite-loader.tsx..."
  sed -i '' 's|/#icon-/|/#icon-/|g' "src/components/ui/svg-sprite-loader.tsx"
fi

# 7. Fix use-repo-search.ts
if [ -f "src/hooks/use-repo-search.ts" ]; then
  echo "Fixing use-repo-search.ts..."
  sed -i '' 's|github\\.com/\\([^)]*\\)|github\\.com\\\\/\\1|g' "src/hooks/use-repo-search.ts"
  sed -i '' 's|/\[^/\]+/\[^/\]+/|/\\[^\\\\/\\]+\\\\/\\[^\\\\/\\]+/|g' "src/hooks/use-repo-search.ts"
fi

# 8. Fix use-repository-parser.ts
if [ -f "src/hooks/use-repository-parser.ts" ]; then
  echo "Fixing use-repository-parser.ts..."
  sed -i '' 's|github\\.com/\\([^)]*\\)|github\\.com\\\\/\\1|g' "src/hooks/use-repository-parser.ts"
  sed -i '' 's|/\[^/\]+/\[^/\]+/|/\\[^\\\\/\\]+\\\\/\\[^\\\\/\\]+/|g' "src/hooks/use-repository-parser.ts"
fi

# 9. Fix use-repository-validation.ts
if [ -f "src/hooks/use-repository-validation.ts" ]; then
  echo "Fixing use-repository-validation.ts..."
  sed -i '' 's|/\[^/\]+/\[^/\]+/|/\\[^\\\\/\\]+\\\\/\\[^\\\\/\\]+/|g' "src/hooks/use-repository-validation.ts"
fi

# 10. Fix dub.ts
if [ -f "src/lib/dub.ts" ]; then
  echo "Fixing dub.ts..."
  sed -i '' 's|github\\.com/\\([^)]*\\)|github\\.com\\\\/\\1|g' "src/lib/dub.ts"
  sed -i '' 's|\\w+/\\w+|\\\\w+\\\\/\\\\w+|g' "src/lib/dub.ts"
fi

# 11. Fix llm-citation-tracking.ts
if [ -f "src/lib/llm-citation-tracking.ts" ]; then
  echo "Fixing llm-citation-tracking.ts..."
  sed -i '' 's|/\[^/\]+/\[^/\]+/|/\\[^\\\\/\\]+\\\\/\\[^\\\\/\\]+/|g' "src/lib/llm-citation-tracking.ts"
fi

# 12. Fix smart-notifications.ts
if [ -f "src/lib/progressive-capture/smart-notifications.ts" ]; then
  echo "Fixing smart-notifications.ts..."
  sed -i '' 's|/\^\\/\\([^/]*\\)/\\([^/]*\\)/|/\\^\\\\\\\/\\([^\\\\/]*\\)\\\\\\\/\\([^\\\\/]*\\)/|g' "src/lib/progressive-capture/smart-notifications.ts"
fi

# 13. Fix route-prefetch.ts
if [ -f "src/lib/route-prefetch.ts" ]; then
  echo "Fixing route-prefetch.ts..."
  sed -i '' 's|/\^\\/\\w+/|/\\^\\\\\\\/\\\\w+/|g' "src/lib/route-prefetch.ts"
  sed -i '' 's|/\^\\/i/|/\\^\\\\\\\/i/|g' "src/lib/route-prefetch.ts"
fi

# 14. Fix service-worker-client.ts
if [ -f "src/lib/service-worker-client.ts" ]; then
  echo "Fixing service-worker-client.ts..."
  sed -i '' 's|/\^\\/\\w+/|/\\^\\\\\\\/\\\\w+/|g' "src/lib/service-worker-client.ts"
fi

# 15. Fix utils.ts
if [ -f "src/lib/utils.ts" ]; then
  echo "Fixing utils.ts..."
  sed -i '' 's|/\[^/\]+/\[^/\]+|/\\[^\\\\/\\]+\\\\/\\[^\\\\/\\]+|g' "src/lib/utils.ts"
  # Fix numeric separators
  sed -i '' 's|1_000|1000|g' "src/lib/utils.ts"
fi

# 16. Fix database-schemas.ts - remove numeric separators
if [ -f "src/lib/validation/database-schemas.ts" ]; then
  echo "Fixing database-schemas.ts..."
  sed -i '' 's|1_000|1000|g' "src/lib/validation/database-schemas.ts"
  sed -i '' 's|10_000|10000|g' "src/lib/validation/database-schemas.ts"
  sed -i '' 's|100_000|100000|g' "src/lib/validation/database-schemas.ts"
fi

echo "✅ Fixed parsing errors"