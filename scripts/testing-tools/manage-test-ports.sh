#!/bin/bash

# Robust port management for Storybook testing
# This script handles port conflicts gracefully

PORT=${1:-6006}
MAX_RETRIES=5
RETRY_COUNT=0

# Function to check if port is in use
is_port_in_use() {
    lsof -i:$1 > /dev/null 2>&1
}

# Function to kill processes on port
kill_port_processes() {
    local port=$1
    echo "Checking for processes on port $port..."
    
    # Try graceful kill first
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "Found processes on port $port, attempting graceful shutdown..."
        lsof -ti:$port | xargs kill 2>/dev/null || true
        sleep 2
    fi
    
    # Force kill if still running
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "Processes still running, force killing..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Function to find available port
find_available_port() {
    local base_port=$1
    local port=$base_port
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if ! is_port_in_use $port; then
            echo $port
            return 0
        fi
        
        echo "Port $port is in use, trying next port..." >&2
        port=$((port + 1))
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done
    
    echo "Could not find available port after $MAX_RETRIES attempts" >&2
    return 1
}

# Main execution
echo "=== Storybook Port Management ==="

# Clean up any existing processes
kill_port_processes $PORT

# Find available port
AVAILABLE_PORT=$(find_available_port $PORT)

if [ $? -eq 0 ]; then
    echo "✅ Port $AVAILABLE_PORT is available for use"
    echo $AVAILABLE_PORT
    exit 0
else
    echo "❌ Failed to find available port"
    exit 1
fi