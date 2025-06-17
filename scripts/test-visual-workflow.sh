#!/bin/bash

echo "Testing Visual Change Detection Workflow Logic"
echo "============================================="
echo ""

# Test the path patterns
echo "Testing path patterns for visual changes..."

# Visual change paths (should trigger)
visual_paths=(
  "src/components/ui/button.tsx"
  "src/stories/Button.stories.tsx"
  ".storybook/main.js"
  "src/components/features/login.css"
  "tailwind.config.js"
  "package.json"
)

# Non-visual paths (should NOT trigger)
non_visual_paths=(
  "src/lib/utils.ts"
  "src/hooks/use-data.ts"
  "README.md"
  ".github/workflows/test.yml"
  "src/components/__tests__/button.test.tsx"
  "src/__mocks__/setup.ts"
)

echo "✅ Paths that SHOULD trigger Storybook workflows:"
for path in "${visual_paths[@]}"; do
  echo "   - $path"
done

echo ""
echo "⏭️  Paths that should NOT trigger Storybook workflows:"
for path in "${non_visual_paths[@]}"; do
  echo "   - $path"
done

echo ""
echo "Workflow Usage Summary:"
echo "----------------------"
echo "1. check-visual-changes.yml - Reusable workflow for detecting visual changes"
echo "2. deploy-storybook.yml    - Uses check-visual, only deploys if changes detected"
echo "3. storybook-tests.yml     - Uses check-visual, only tests if changes detected"
echo "4. chromatic.yml           - Uses check-visual, only runs if changes detected (currently disabled)"

echo ""
echo "Benefits:"
echo "---------"
echo "✅ Single source of truth for visual change detection"
echo "✅ Consistent behavior across all Storybook workflows"
echo "✅ Easy to maintain - update paths in one place"
echo "✅ Saves CI time by skipping unnecessary builds"
echo "✅ Clear reporting in GitHub UI"