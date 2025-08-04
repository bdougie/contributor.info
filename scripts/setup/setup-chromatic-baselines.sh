#!/bin/bash

# Script to create initial Chromatic baselines
# This should be run after setting up the Chromatic project token

echo "🎨 Creating initial Chromatic baselines..."
echo "Make sure you have set CHROMATIC_PROJECT_TOKEN in your environment"

# Check if project token is set
if [ -z "$CHROMATIC_PROJECT_TOKEN" ]; then
    echo "❌ Error: CHROMATIC_PROJECT_TOKEN environment variable is not set"
    echo "Please set it with: export CHROMATIC_PROJECT_TOKEN=your_token_here"
    exit 1
fi

# Build Storybook first
echo "📚 Building Storybook..."
npm run build-storybook

if [ $? -ne 0 ]; then
    echo "❌ Error: Storybook build failed"
    exit 1
fi

# Run Chromatic to create baselines
echo "🔄 Running Chromatic to create initial baselines..."
npx chromatic --project-token=$CHROMATIC_PROJECT_TOKEN --auto-accept-changes --force-rebuild

if [ $? -eq 0 ]; then
    echo "✅ Initial baselines created successfully!"
    echo "🌐 View your project at: https://www.chromatic.com/"
    echo ""
    echo "Next steps:"
    echo "1. Add CHROMATIC_PROJECT_TOKEN to your GitHub repository secrets"
    echo "2. Push changes to trigger automated visual testing"
    echo "3. Review and accept any visual changes in the Chromatic web interface"
else
    echo "❌ Error: Failed to create baselines"
    exit 1
fi
