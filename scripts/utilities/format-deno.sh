#!/bin/bash
#
# Format Deno files using Docker
# Usage: ./scripts/utilities/format-deno.sh

set -e

echo "🦕 Formatting Deno files..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker or use Deno directly."
    exit 1
fi

# Run Deno fmt in Docker
docker run --rm \
    -v "$(pwd)/supabase/functions:/functions" \
    -w /functions \
    denoland/deno:latest \
    fmt _shared/ tests/ __tests__/ spam-detection/ health/index.ts

echo "✅ Deno formatting complete!"
