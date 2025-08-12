#!/bin/bash
set -e

# Script to handle manual release type triggering
# This creates appropriate commits on main to trigger semantic-release

RELEASE_TYPE="${1:-auto}"

echo "Release type: $RELEASE_TYPE"

if [ "$RELEASE_TYPE" = "auto" ]; then
  echo "Using automatic version detection from existing commits"
  exit 0
fi

# Configure git
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# If we're on a detached HEAD (GitHub Actions), create a temporary branch
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
  git checkout -b temp-release-branch
fi

# Create appropriate commit based on release type
case "$RELEASE_TYPE" in
  major)
    # Create a breaking change commit
    cat > .release-notes.md << EOF
# Breaking Change Release

BREAKING CHANGE: This is a manually triggered major version release.

Triggered via GitHub Actions workflow_dispatch with release_type=major
EOF
    git add .release-notes.md || true
    git commit --allow-empty -m "feat!: trigger major release

BREAKING CHANGE: Manually triggered major version bump via GitHub Actions workflow."
    ;;
  
  minor)
    git commit --allow-empty -m "feat: trigger minor release via workflow"
    ;;
  
  patch)
    git commit --allow-empty -m "fix: trigger patch release via workflow"
    ;;
  
  *)
    echo "Unknown release type: $RELEASE_TYPE"
    exit 1
    ;;
esac

echo "Release trigger commit created successfully"