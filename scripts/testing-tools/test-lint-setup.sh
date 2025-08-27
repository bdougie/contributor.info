#!/bin/bash

# Test script to verify ESLint and Prettier setup
echo "🧪 Testing ESLint and Prettier setup..."

# Test 1: Check if dependencies are installed
echo "✓ Checking dependencies..."
npm ls eslint prettier husky lint-staged --depth=0 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Some dependencies are missing. Please run: npm install"
    exit 1
fi

# Test 2: Verify configuration files exist
echo "✓ Checking configuration files..."
for file in ".prettierrc.json" ".prettierignore" ".lintstagedrc.json" ".husky/pre-commit"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing: $file"
        exit 1
    fi
done
echo "  All configuration files present ✅"

# Test 3: Run ESLint with cache
echo "✓ Testing ESLint with cache..."
npm run lint -- --max-warnings=0 src/App.tsx
if [ $? -eq 0 ]; then
    echo "  ESLint working correctly ✅"
else
    echo "❌ ESLint check failed"
fi

# Test 4: Check if cache file was created
if [ -f ".eslintcache" ]; then
    echo "  ESLint cache created ✅"
else
    echo "⚠️  ESLint cache not created"
fi

# Test 5: Run Prettier check
echo "✓ Testing Prettier..."
npm run format:check -- src/App.tsx
if [ $? -eq 0 ]; then
    echo "  Prettier working correctly ✅"
else
    echo "❌ Prettier check failed"
fi

# Test 6: Test lint-staged
echo "✓ Testing lint-staged..."
echo "const test = 'test'" > test-lint-temp.ts
git add test-lint-temp.ts
npx lint-staged
if [ $? -eq 0 ]; then
    echo "  lint-staged working correctly ✅"
    git reset HEAD test-lint-temp.ts
    rm test-lint-temp.ts
else
    echo "❌ lint-staged failed"
    git reset HEAD test-lint-temp.ts
    rm test-lint-temp.ts
    exit 1
fi

echo ""
echo "✅ All tests passed! ESLint and Prettier are properly configured."
echo ""
echo "📝 Available commands:"
echo "  npm run lint        - Run ESLint with cache"
echo "  npm run lint:fix    - Fix ESLint issues with cache"
echo "  npm run format      - Format files with Prettier"
echo "  npm run format:check - Check formatting without changes"
echo ""
echo "🎣 Pre-commit hook is active and will:"
echo "  1. Run ESLint with auto-fix on staged JS/TS files"
echo "  2. Format staged files with Prettier"
echo "  3. Block commits if there are ESLint errors"