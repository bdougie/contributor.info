#!/bin/bash
#
# Cleanup unused Netlify environment variables to reduce function deployment size
#
# Background: Netlify Functions have a 4KB limit on environment variables for AWS Lambda.
# This script removes unused variables that are causing deployment failures.
#

set -e

echo "🧹 Cleaning up unused Netlify environment variables..."
echo ""

# Variables that are NOT used in the codebase and can be safely removed
UNUSED_VARS=(
  "VITE_SUPABASE_DATABASE_URL"  # Not referenced anywhere in src/ or netlify/functions/
)

echo "The following variables will be removed:"
for var in "${UNUSED_VARS[@]}"; do
  echo "  - $var"
done
echo ""

read -p "Do you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Removing unused variables..."
for var in "${UNUSED_VARS[@]}"; do
  echo "Removing $var..."
  netlify env:unset "$var" --context production || echo "  ⚠️  Variable not found or already removed"
  netlify env:unset "$var" --context deploy-preview || echo "  ⚠️  Variable not found or already removed"
  netlify env:unset "$var" --context branch-deploy || echo "  ⚠️  Variable not found or already removed"
done

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 To check remaining environment variable size:"
echo "   netlify env:list"
