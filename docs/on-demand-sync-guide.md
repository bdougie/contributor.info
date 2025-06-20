# On-Demand GitHub Sync Implementation

## Overview

The on-demand sync system automatically triggers GitHub data collection when users visit repositories that haven't been analyzed yet. This provides a seamless experience where data is populated in real-time.

## How It Works

### 1. Automatic Detection
When a user navigates to a repository health page (e.g., `http://localhost:5173/continuedev/continue/health`), the system:

1. **Checks for existing data** in the `contributor_roles` table
2. **Auto-tracks the repository** by adding it to `tracked_repositories` 
3. **Triggers GitHub sync** automatically if no data exists
4. **Shows loading states** while data is being collected
5. **Updates the UI** when sync completes

### 2. User Experience Flow

#### For New Repositories (No Data)
```
User visits /owner/repo/health
     ↓
System detects no contributor role data
     ↓
Auto-triggers GitHub Events sync
     ↓
Shows "Analyzing repository events..." with spinner
     ↓
Displays self-selection rate when complete
```

#### For Existing Repositories (Has Data)
```
User visits /owner/repo/health
     ↓
System finds existing contributor role data
     ↓
Immediately displays self-selection rate
     ↓
User can manually refresh if needed
```

### 3. Component States

The `SelfSelectionRate` component now handles multiple states:

- **Loading**: Standard skeleton loader
- **Syncing**: Shows "Analyzing repository events..." with database icon
- **No Data**: Shows "Analyze Repository" button for manual trigger
- **Error**: Shows error message with "Retry Analysis" button
- **Data Available**: Shows normal self-selection rate with refresh button

## Implementation Details

### Key Components

1. **`useOnDemandSync` Hook**: Manages sync lifecycle and status
   - Detects when repositories need data collection
   - Triggers GitHub sync Edge Function
   - Polls for completion status
   - Handles errors and retries

2. **`useAutoTrackRepository` Hook**: Automatically adds repositories to tracking
   - Ensures visited repositories are added to `tracked_repositories`
   - Prevents duplicate entries
   - Enables future automated syncing

3. **Enhanced SelfSelectionRate Component**: Shows appropriate states
   - Sync progress with real-time status
   - Manual trigger buttons for user control
   - Error handling with retry options

### Database Integration

The system uses the GitHub Events Classification infrastructure:

- **`contributor_roles`**: Stores detected maintainer/owner status
- **`github_events_cache`**: Caches GitHub events for analysis
- **`github_sync_status`**: Tracks sync progress and completion
- **`tracked_repositories`**: Lists repositories being monitored

### Edge Functions

- **`github-sync`**: Fetches GitHub events and analyzes contributor roles
- **`github-webhook`**: Handles real-time updates via GitHub webhooks

## Testing the Implementation

### 1. Visit a New Repository
Navigate to a repository that hasn't been analyzed:
```
http://localhost:5173/continuedev/continue/health
```

You should see:
1. Initial loading skeleton
2. "Analyzing repository events..." message
3. Self-selection rate once complete

### 2. Manual Refresh
On any repository with data, click the refresh button in the self-selection card to trigger a new sync.

### 3. Error Handling
If the GitHub token isn't configured, you'll see an error message with a "Retry Analysis" button.

## Configuration Requirements

For full functionality, the GitHub sync needs:

1. **GitHub API Token** (set as Supabase Edge Function secret):
   ```bash
   supabase secrets set GITHUB_TOKEN=your_github_personal_access_token
   ```

2. **Webhook Secret** (optional, for real-time updates):
   ```bash
   supabase secrets set GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```

## Benefits

- **Seamless UX**: Data appears automatically when users need it
- **Scalable**: Works for any public GitHub repository
- **Real-time**: Shows progress and updates live
- **Fault-tolerant**: Handles errors gracefully with retry options
- **Efficient**: Only syncs when needed, avoiding unnecessary API calls

## Future Enhancements

- **Background sync scheduling**: Regular updates for tracked repositories
- **Webhook integration**: Real-time updates via GitHub webhooks
- **Rate limit management**: Intelligent queuing and backoff
- **Data archival**: Cleanup old events to manage storage