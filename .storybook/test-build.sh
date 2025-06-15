#!/bin/bash

# Script to test Storybook build locally before deployment

set -e

echo "🔨 Testing Storybook build..."

# Clean previous build
if [ -d "storybook-static" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf storybook-static
fi

# Build Storybook
echo "📦 Building Storybook..."
npm run build-storybook

# Check if build was successful
if [ -d "storybook-static" ] && [ -f "storybook-static/index.html" ]; then
    echo "✅ Build successful!"
    echo "📁 Build output size:"
    du -sh storybook-static
    
    echo ""
    echo "🚀 Starting local server..."
    echo "📍 Visit: http://localhost:6006"
    echo "🛑 Press Ctrl+C to stop"
    
    # Start local server
    npx http-server storybook-static -p 6006 -o
else
    echo "❌ Build failed!"
    exit 1
fi