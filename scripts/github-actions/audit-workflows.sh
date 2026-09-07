#!/bin/bash

# Workflow Security Audit Script
# This script checks GitHub Actions workflows for security best practices

echo "🔍 GitHub Actions Workflow Security Audit"
echo "========================================="

WORKFLOWS_DIR=".github/workflows"
ISSUES_FOUND=0

# Check if workflows directory exists
if [ ! -d "$WORKFLOWS_DIR" ]; then
    echo "❌ No workflows directory found at $WORKFLOWS_DIR"
    exit 1
fi

echo ""
echo "Checking for security issues in workflows..."
echo ""

# Check for unpinned actions
echo "📌 Checking for unpinned actions..."
for file in $WORKFLOWS_DIR/*.yml; do
    filename=$(basename "$file")
    
    # Check for unpinned actions (not using SHA)
    unpinned=$(grep -E "uses: [^#]*@(v[0-9]+|main|master)" "$file" | grep -v "#" || true)
    
    if [ ! -z "$unpinned" ]; then
        echo "⚠️  $filename has unpinned actions:"
        echo "$unpinned" | sed 's/^/    /'
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""
echo "🔑 Checking for exposed secrets..."
for file in $WORKFLOWS_DIR/*.yml; do
    filename=$(basename "$file")
    
    # Check for hardcoded secrets (basic check)
    if grep -qE "(api[_-]?key|token|secret|password|pwd|pass).*[:=].*['\"][^'\"$]" "$file"; then
        echo "⚠️  $filename may contain hardcoded secrets"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""
echo "🛡️ Checking for missing permissions..."
for file in $WORKFLOWS_DIR/*.yml; do
    filename=$(basename "$file")
    
    # Check if workflow has permissions defined
    if ! grep -q "permissions:" "$file"; then
        echo "⚠️  $filename missing explicit permissions"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""
echo "📦 Checking third-party actions..."
for file in $WORKFLOWS_DIR/*.yml; do
    filename=$(basename "$file")
    
    # List third-party actions (not from actions/ or github/)
    third_party=$(grep -E "uses: (?!(actions/|github/))" "$file" | grep -oE "uses: [^@#]*" | sed 's/uses: //' | sort -u || true)
    
    if [ ! -z "$third_party" ]; then
        echo "ℹ️  $filename uses third-party actions:"
        echo "$third_party" | sed 's/^/    /'
    fi
done

echo ""
echo "========================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo "✅ No security issues found!"
else
    echo "⚠️  Found $ISSUES_FOUND potential security issues"
    echo ""
    echo "Recommendations:"
    echo "1. Pin all actions to specific SHA commits"
    echo "2. Add explicit permissions to all workflows"
    echo "3. Never hardcode secrets in workflows"
    echo "4. Review third-party actions before use"
fi

echo ""
echo "SHA Pinning Examples:"
echo "  actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1"
echo "  actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0"

exit $ISSUES_FOUND