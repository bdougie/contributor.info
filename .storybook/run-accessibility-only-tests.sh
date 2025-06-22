#!/bin/bash

# Get the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the Node.js test runner with accessibility flag
node "$SCRIPT_DIR/run-tests.cjs" --accessibility