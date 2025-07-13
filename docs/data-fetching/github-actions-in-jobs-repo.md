# GitHub Actions Data Fetching Workflows - Jobs Repository

## Overview

All data fetching GitHub Actions workflows are stored in a separate `jobs` repository, not in the main `contributor.info` repository. This separation provides better security isolation and cleaner organization.

## Workflow Location

The workflows are located at: `../jobs/.github/workflows/`

## Available Workflows

### Data Fetching Workflows
- `historical-pr-sync.yml` - Syncs historical PR data
- `historical-comments-sync.yml` - Syncs historical PR comments  
- `historical-reviews-sync.yml` - Syncs historical PR reviews
- `bulk-file-changes.yml` - Syncs bulk file changes
- `capture-pr-details.yml` - Captures PR details in real-time
- `capture-pr-details-graphql.yml` - Captures PR details using GraphQL
- `capture-pr-comments.yml` - Captures PR comments
- `capture-pr-reviews.yml` - Captures PR reviews
- `bulk-capture.yml` - Bulk data capture workflow
- `historical-pr-sync-graphql.yml` - Historical PR sync using GraphQL

## Why Separate Repository?

1. **Security Isolation**: Keeps data processing workflows separate from the main application code
2. **Access Control**: Different permissions can be applied to the jobs repository
3. **Cleaner Organization**: Separates operational workflows from application workflows
4. **Independent Deployment**: Jobs can be updated without affecting the main application

## Triggering Workflows

The workflows in the jobs repository are triggered via:
1. Manual dispatch from GitHub UI
2. API calls from the main application (via GitHub Actions API)
3. Scheduled runs (if configured)

## Required Secrets

The jobs repository needs access to these secrets:
- `GITHUB_TOKEN` - For accessing GitHub API
- `VITE_SUPABASE_URL` - Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_TOKEN` - Supabase service role key (for admin operations)

## Integration with Main App

The main application integrates with these workflows through:
1. `HybridQueueManager` - Dispatches workflows based on repository size and priority
2. `GitHubActionsQueueManager` - Manages the GitHub Actions queue
3. Job status tracking in the database

## Debugging

To debug workflow issues:
1. Check the GitHub Actions tab in the jobs repository
2. Look for failed workflow runs
3. Check the job_status table in the database for tracking information
4. Use the monitoring dashboard at `/dev/capture-monitor`

## Important Notes

- Never trigger workflows with invalid repository names (e.g., route paths like "dev/capture-monitor")
- Always validate repository exists in database before triggering workflows
- Monitor the job_status table for workflow health