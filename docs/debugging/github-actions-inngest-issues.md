# GitHub Actions and Inngest Job Processing Issues - Investigation Report

## Issues Found and Fixed

### 1. Smart Notifications Repository Detection Issue
**Problem**: The smart notifications system was incorrectly parsing the route `/dev/capture-monitor` as a repository path, treating "dev" as the owner and "capture-monitor" as the repository name.

**Root Cause**: The regex pattern in `smart-notifications.ts` was matching any path with two segments, without proper exclusions for non-repository routes.

**Fix Applied**: Updated the excluded prefixes to include 'dev', 'api', 'auth', 'oauth' in addition to existing exclusions.

```typescript
// Added 'dev' to excluded prefixes
const excludedPrefixes = ['login', 'debug', 'admin', 'dev', 'api', 'auth', 'oauth'];
```

### 2. GitHub Actions Repository Configuration Error
**Problem**: GitHub Actions workflows were not being triggered properly.

**Root Cause**: The `GitHubActionsQueueManager` was configured to dispatch workflows to the main `contributor.info` repository instead of the separate `jobs` repository where the workflows actually exist.

**Fix Applied**: Updated the repository name from 'contributor.info' to 'jobs':

```typescript
private readonly JOBS_REPO_NAME = 'jobs'; // Changed from 'contributor.info'
```

## How the System Works

### Repository Structure
- **Main Repository**: `bdougie/contributor.info` - Contains the application code
- **Jobs Repository**: `bdougie/jobs` - Contains GitHub Actions workflows for data fetching

### Processing Flow
1. **Inngest**: Handles real-time, smaller jobs (< 500 items)
2. **GitHub Actions**: Handles bulk processing and large repositories (> 500 items)
3. **Hybrid Queue Manager**: Intelligently routes jobs based on size and priority

### Key Components
- `/dev/capture-monitor`: Monitoring dashboard for queue health
- `HybridQueueManager`: Routes jobs between Inngest and GitHub Actions
- `GitHubActionsQueueManager`: Dispatches workflows to the jobs repository
- `InngestQueueManager`: Handles Inngest event dispatching

## Environment Requirements

### For Inngest
- `INNGEST_EVENT_KEY`: Event key for sending events
- `INNGEST_SIGNING_KEY`: Signing key for webhook verification
- `INNGEST_PRODUCTION_EVENT_KEY`: Production event key
- `INNGEST_PRODUCTION_SIGNING_KEY`: Production signing key

### For GitHub Actions
- `GITHUB_TOKEN`: Personal access token with workflow dispatch permissions
- The token must have access to the `bdougie/jobs` repository

## Verification Steps

1. **Check Smart Notifications**: Navigate to `/dev/capture-monitor` - it should no longer trigger repository detection errors
2. **Check Inngest**: Visit `/.netlify/functions/inngest` to verify the endpoint is active
3. **Check GitHub Actions**: Verify workflows can be dispatched to `bdougie/jobs` repository

## Common Issues and Solutions

### "Repository not found in database" Error
- **Cause**: Route being incorrectly parsed as repository path
- **Solution**: Fixed by updating excluded route prefixes

### Jobs Not Being Triggered
- **Cause**: Incorrect repository configuration for GitHub Actions
- **Solution**: Fixed by updating to correct jobs repository name

### Inngest Events Not Processing
- **Check**: Environment variables are properly set
- **Check**: Inngest endpoint is registered in dashboard
- **Check**: Using correct app ID and keys for environment

## Next Steps

1. **Deploy Changes**: The fixes need to be deployed to take effect
2. **Verify Jobs Repository**: Ensure `bdougie/jobs` repository exists and has the workflows
3. **Test Processing**: Trigger a test job to verify both Inngest and GitHub Actions are working
4. **Monitor**: Use `/dev/capture-monitor` to track job processing health