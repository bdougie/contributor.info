#!/bin/bash
# Prevent the use of --no-verify flag in git commands
# This ensures pre-commit hooks always run

# Check if this script is being run as part of a git command with --no-verify
if [ -n "$GIT_NO_VERIFY" ]; then
    echo "❌ ERROR: --no-verify flag detected!"
    echo ""
    echo "Using --no-verify bypasses important pre-commit checks including:"
    echo "  • TypeScript type checking"
    echo "  • ESLint validation"
    echo "  • Code formatting"
    echo "  • CSP hash verification"
    echo ""
    echo "These checks are essential for code quality and security."
    echo "Please commit without --no-verify and fix any errors that arise."
    echo ""
    exit 1
fi
