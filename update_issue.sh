#!/bin/bash

# Update GitHub issue #402 with new Fly.io-focused description
gh issue edit 402 --body-file temp_issue_update.md

echo "Issue #402 updated successfully with Fly.io migration details"