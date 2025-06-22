#!/bin/bash

# Kill any existing servers
pkill -f "http-server.*6006" 2>/dev/null || true

# Start server in background
echo "Starting HTTP server..."
npx http-server storybook-static --port 6006 --silent &
SERVER_PID=$!

# Wait for server
echo "Waiting for server..."
npx wait-on http://127.0.0.1:6006

# Run tests using the exact working command
echo "Running tests..."
./node_modules/.bin/test-storybook

# Capture exit code
EXIT_CODE=$?

# Clean up
kill $SERVER_PID 2>/dev/null || true

exit $EXIT_CODE