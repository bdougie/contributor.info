#!/bin/bash

# Robust Storybook Test Runner with Retry Logic
# This script handles port conflicts, retries flaky tests, and provides proper cleanup

set -e

# Configuration
MAX_RETRIES=3
PORT_START=6006
MAX_PORT_ATTEMPTS=10
WAIT_TIMEOUT=30000
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to find an available port
find_available_port() {
    local port=$PORT_START
    local attempts=0
    
    while [ $attempts -lt $MAX_PORT_ATTEMPTS ]; do
        if ! lsof -i:$port > /dev/null 2>&1; then
            echo $port
            return 0
        fi
        echo -e "${YELLOW}Port $port is in use, trying next...${NC}" >&2
        port=$((port + 1))
        attempts=$((attempts + 1))
    done
    
    echo -e "${RED}Could not find an available port after $MAX_PORT_ATTEMPTS attempts${NC}" >&2
    return 1
}

# Function to cleanup processes
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    # Kill any running Storybook servers
    if [ -f storybook.pid ]; then
        local pid=$(cat storybook.pid)
        if kill -0 $pid 2>/dev/null; then
            kill $pid || true
            echo "Killed Storybook server (PID: $pid)"
        fi
        rm storybook.pid
    fi
    
    # Kill any processes on our port
    if [ ! -z "$STORYBOOK_PORT" ]; then
        lsof -ti:$STORYBOOK_PORT | xargs -r kill -9 2>/dev/null || true
    fi
    
    # Kill any orphaned http-server processes
    pkill -f "http-server.*storybook-static" || true
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# Function to start Storybook server
start_storybook_server() {
    local port=$1
    
    echo -e "${GREEN}Starting Storybook server on port $port...${NC}"
    
    # Start the server in the background
    npx http-server storybook-static --port $port --silent &
    local server_pid=$!
    echo $server_pid > storybook.pid
    
    # Wait for the server to be ready
    local wait_attempts=0
    local max_wait=30
    
    while [ $wait_attempts -lt $max_wait ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200\|301"; then
            echo -e "${GREEN}Storybook server is ready on port $port${NC}"
            return 0
        fi
        sleep 1
        wait_attempts=$((wait_attempts + 1))
    done
    
    echo -e "${RED}Storybook server failed to start after ${max_wait} seconds${NC}"
    return 1
}

# Function to run tests with retry logic
run_tests_with_retry() {
    local test_command=$1
    local test_name=$2
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo -e "${GREEN}Running $test_name (attempt $attempt/$MAX_RETRIES)...${NC}"
        
        if eval "$test_command"; then
            echo -e "${GREEN}$test_name passed successfully!${NC}"
            return 0
        else
            if [ $attempt -lt $MAX_RETRIES ]; then
                echo -e "${YELLOW}$test_name failed, retrying in $RETRY_DELAY seconds...${NC}"
                sleep $RETRY_DELAY
            else
                echo -e "${RED}$test_name failed after $MAX_RETRIES attempts${NC}"
                return 1
            fi
        fi
        
        attempt=$((attempt + 1))
    done
}

# Main execution
main() {
    echo -e "${GREEN}=== Robust Storybook Test Runner ===${NC}"
    
    # Check if storybook-static exists
    if [ ! -d "storybook-static" ]; then
        echo -e "${YELLOW}Building Storybook...${NC}"
        npm run build-storybook --quiet
    fi
    
    # Find an available port
    STORYBOOK_PORT=$(find_available_port)
    if [ $? -ne 0 ]; then
        exit 1
    fi
    
    echo -e "${GREEN}Using port $STORYBOOK_PORT for testing${NC}"
    
    # Start the Storybook server
    if ! start_storybook_server $STORYBOOK_PORT; then
        echo -e "${RED}Failed to start Storybook server${NC}"
        exit 1
    fi
    
    # Set the target URL
    export TARGET_URL="http://localhost:$STORYBOOK_PORT"
    echo -e "${GREEN}Target URL: $TARGET_URL${NC}"
    
    # Run interaction tests with retry
    if [ "$1" != "--accessibility-only" ]; then
        run_tests_with_retry "npx test-storybook --url $TARGET_URL" "Interaction tests"
        INTERACTION_RESULT=$?
    fi
    
    # Run accessibility tests with retry if requested
    if [ "$1" == "--accessibility" ] || [ "$1" == "--accessibility-only" ]; then
        run_tests_with_retry "npx test-storybook --url $TARGET_URL --includeTags accessibility" "Accessibility tests"
        ACCESSIBILITY_RESULT=$?
    fi
    
    # Determine exit code
    EXIT_CODE=0
    if [ ! -z "$INTERACTION_RESULT" ] && [ "$INTERACTION_RESULT" -ne 0 ]; then
        EXIT_CODE=1
    fi
    if [ ! -z "$ACCESSIBILITY_RESULT" ] && [ "$ACCESSIBILITY_RESULT" -ne 0 ]; then
        EXIT_CODE=1
    fi
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}=== All tests passed! ===${NC}"
    else
        echo -e "${RED}=== Some tests failed ===${NC}"
    fi
    
    exit $EXIT_CODE
}

# Run main function
main "$@"