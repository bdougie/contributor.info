# GitHub Actions Workflows Guide

This guide explains the two main GitHub Actions workflows that keep contributor data fresh and accurate.

## Overview

The project uses two automated workflows to maintain up-to-date contributor statistics:

1. **Sync Contributor Stats** - Updates monthly contributor rankings using GitHub's GraphQL API
2. **Update PR Activity** - Triggers background processing of recent pull request activity

Both workflows run automatically on schedule and can be manually triggered when needed.

---

## Sync Contributor Stats

**Purpose**: Updates the monthly contributor rankings by fetching PR, review, and comment counts from GitHub's GraphQL API.

### When it runs
- **Automatically**: Every day at 2:30 AM UTC
- **Manually**: Can be triggered for specific repositories

### What it does
1. Fetches contributor data from the last 30 days using GitHub's GraphQL API
2. Counts pull requests, reviews, and comments for each contributor
3. Updates the `monthly_rankings` table in Supabase
4. Provides detailed logging of the sync process

### Manual trigger options
- **All repositories**: Run without parameters to sync all tracked repositories
- **Specific repository**: Enter `owner/repo` format (e.g., `facebook/react`) to sync just one repository

### Required permissions
- Needs `SUPABASE_SERVICE_ROLE_KEY` for database write access
- Uses `VITE_GITHUB_TOKEN` for GitHub API authentication

---

## Update PR Activity 

**Purpose**: Triggers Inngest events to process and update pull request activity data in the background.

### When it runs
- **Automatically**: Every 6 hours at 18 minutes past the hour (12:18 AM, 6:18 AM, 12:18 PM, 6:18 PM UTC)
- **Manually**: Can be triggered with custom parameters

### What it does
1. Triggers Inngest events for background PR activity processing
2. Looks back 7 days by default to capture recent changes
3. Uses event-driven architecture for scalable processing
4. Updates PR activity data across all tracked repositories

### Manual trigger options
- **All repositories**: Run without parameters (default behavior)
- **Specific repository**: Enter a Repository ID to focus on one repository
- **Custom timeframe**: Set number of days to look back (default: 7 days)

### Required permissions
- Uses `INNGEST_EVENT_KEY` and `INNGEST_PRODUCTION_EVENT_KEY` for event triggers
- Connects to API endpoint for queue management

---

## How to manually trigger workflows

### Using GitHub's web interface:
1. Go to the **Actions** tab in the repository
2. Select the workflow you want to run
3. Click **Run workflow**
4. Enter any required parameters
5. Click **Run workflow** to start

### Using GitHub CLI:
```bash
# Sync contributor stats for all repositories
gh workflow run sync-contributor-stats.yml

# Sync specific repository
gh workflow run sync-contributor-stats.yml -f repository="facebook/react"

# Update PR activity with custom parameters
gh workflow run update-pr-activity.yml -f repository_id="12345" -f days="14"
```

---

## Monitoring and troubleshooting

### Check workflow status
- View real-time logs in the **Actions** tab
- Each step shows detailed output and timing
- Failed runs include error messages and stack traces

### Common issues
- **Rate limits**: GitHub API rate limits may cause delays or failures
- **Authentication errors**: Check that required secrets are configured
- **Database connection**: Verify Supabase credentials and network access

### Success indicators
- Workflows complete with exit code 0
- Database tables show updated timestamps
- Logs show successful API calls and data updates

---

## Configuration details

### Environment variables used:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public Supabase key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access for database writes
- `VITE_GITHUB_TOKEN` - GitHub API authentication
- `INNGEST_EVENT_KEY` / `INNGEST_PRODUCTION_EVENT_KEY` - Event system access

### Timing and delays:
- `SYNC_DELAY_MS` - Controls rate limiting between API calls (default: 2000ms)
- `UPDATE_DELAY_MS` - Controls delays in PR activity updates (default: 1000ms)

### Workflow files:
- `.github/workflows/sync-contributor-stats.yml`
- `.github/workflows/update-pr-activity.yml`

---

## Integration with the broader system

These workflows are part of a larger data synchronization system:

- **Sync Contributor Stats** provides the foundation data for monthly rankings and contributor profiles
- **Update PR Activity** feeds the activity feed and keeps recent changes visible
- Both workflows integrate with the hybrid queue system for efficient data processing
- Data flows into the same Supabase database used by the web application

For more technical details about the data processing architecture, see the [Progressive Data Capture Implementation](progressive-data-capture-implementation.md) documentation.