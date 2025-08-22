#!/bin/bash

# Simple Storybook Test Runner Wrapper
# Builds Storybook and runs tests with proper cleanup

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Storybook Test Runner ===${NC}"

# Build Storybook if needed
if [ ! -d "storybook-static" ] || [ "$1" == "--rebuild" ]; then
    echo -e "${YELLOW}Building Storybook...${NC}"
    npm run build-storybook --quiet
fi

# Run tests using npm script
echo -e "${GREEN}Running Storybook tests...${NC}"
npm run test-storybook

echo -e "${GREEN}=== Tests complete! ===${NC}"