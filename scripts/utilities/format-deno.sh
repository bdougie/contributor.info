#!/bin/bash
#
# Format Deno files using Docker or local Deno
# Usage: ./scripts/utilities/format-deno.sh

set -e

echo "🦕 Formatting Deno files..."

# Check if Docker is running
if docker info &> /dev/null; then
    # Run Deno fmt in Docker
    # Note: __tests__/ contains vitest tests (Node.js) and is excluded from Deno formatting
    docker run --rm \
        -v "$(pwd)/supabase/functions:/functions" \
        -w /functions \
        denoland/deno:latest \
        fmt _shared/ tests/ spam-detection/ health/index.ts slack-list-channels/
elif command -v deno &> /dev/null; then
    # Fallback to local Deno if Docker is not available
    echo "⚠️  Docker not running, using local Deno..."
    cd supabase/functions
    deno fmt _shared/ tests/ spam-detection/ health/index.ts slack-list-channels/
    cd ../..
else
    echo "❌ Neither Docker nor Deno is available. Please install one of them."
    exit 1
fi

echo "✅ Deno formatting complete!"
