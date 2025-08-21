#!/bin/bash

# Build script for CDN optimization
# This script builds the app with CDN enabled and reports bundle sizes

echo "🚀 Building with CDN optimization..."
echo "================================================"

# Clean previous build
rm -rf dist

# Build with CDN enabled
echo "📦 Building production bundle with CDN..."
VITE_USE_CDN=true NODE_ENV=production npm run build

echo ""
echo "📊 Bundle Analysis:"
echo "================================================"

# Check if build succeeded
if [ ! -d "dist" ]; then
  echo "❌ Build failed - dist directory not found"
  exit 1
fi

# Analyze bundle sizes
echo "📦 JavaScript bundles:"
echo "----------------------------------------------"
find dist/js -name "*.js" -exec du -h {} \; | sort -hr | head -20

echo ""
echo "📦 Largest bundles:"
echo "----------------------------------------------"
ls -lh dist/js/*.js | sort -k5 -hr | head -10

echo ""
echo "📊 Total bundle size:"
echo "----------------------------------------------"
total_size=$(du -sh dist/js | cut -f1)
echo "Total JS: $total_size"

echo ""
echo "🔍 Checking for CDN externals in HTML..."
echo "----------------------------------------------"
if grep -q "importmap" dist/index.html; then
  echo "✅ Import map found in index.html"
  echo "✅ CDN optimization is active"
  
  # Count CDN libraries
  cdn_count=$(grep -o "https://esm.sh" dist/index.html | wc -l)
  echo "📚 Libraries loaded from CDN: $cdn_count"
else
  echo "⚠️  Import map not found - CDN may not be configured"
fi

echo ""
echo "💡 Compare with regular build:"
echo "   Run: npm run build (without CDN)"
echo "   Then check dist/js sizes"

echo ""
echo "🌐 To test locally with CDN:"
echo "   npx serve dist"
echo "   Then check Network tab for CDN requests"