#!/bin/bash

# Storybook Interaction Tests Runner
# This script runs interaction tests for Storybook components

set -e

echo "🚀 Starting Storybook Interaction Tests..."

# Check if Storybook is built
if [ ! -d "storybook-static" ]; then
    echo "📦 Building Storybook..."
    npm run build-storybook
fi

# Install playwright if not already installed
echo "🎭 Setting up Playwright..."
npx playwright install --with-deps

# Start Storybook server in background and run tests
echo "🧪 Running interaction tests..."
npx concurrently -k -s first -n "SB,TEST" -c "magenta,blue" \
    "npx http-server storybook-static --port 6006 --silent" \
    "wait-on tcp:6006 && npm run test-storybook"

echo "✅ Interaction tests completed!"

# Run accessibility tests if axe-storybook is available
if command -v axe-storybook &> /dev/null; then
    echo "♿ Running accessibility tests..."
    npx concurrently -k -s first -n "SB,A11Y" -c "magenta,green" \
        "npx http-server storybook-static --port 6007 --silent" \
        "wait-on tcp:6007 && axe-storybook --port 6007"
    echo "✅ Accessibility tests completed!"
else
    echo "ℹ️  Accessibility tests skipped (axe-storybook not installed)"
fi

echo "🎉 All tests completed successfully!"
