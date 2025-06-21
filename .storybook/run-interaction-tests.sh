#!/bin/bash

# Simple script to run Storybook interaction tests
echo "Starting Storybook interaction tests..."

# Kill any existing servers on port 6006
pkill -f "http-server.*6006" 2>/dev/null || true

# Start HTTP server in background
echo "Starting HTTP server..."
npx http-server storybook-static --port 6006 --silent &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Run interaction tests (includes accessibility)
echo "Running interaction tests..."
npx test-storybook --includeTags interaction --url http://127.0.0.1:6006

# Store exit code
TEST_EXIT_CODE=$?

# Clean up
echo "Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

# Exit with test result
exit $TEST_EXIT_CODE