# Inngest Queue Integration

## Overview

We've integrated Inngest for improved queue observability and management. Inngest provides:
- Real-time job monitoring dashboard
- Automatic retries with exponential backoff
- Built-in rate limiting and concurrency controls
- Detailed execution logs and debugging tools
- Zero infrastructure management

## Architecture

### Components

1. **Inngest Client** (`/src/lib/inngest/client.ts`)
   - Configures the Inngest SDK
   - Defines event schemas for type safety

2. **Inngest Functions** (`/src/lib/inngest/functions/`)
   - `capture-pr-details.ts` - Fetches PR file changes and metadata
   - `capture-pr-reviews.ts` - Fetches PR review data
   - `capture-pr-comments.ts` - Fetches PR comments (review + issue)
   - `capture-repository-sync.ts` - Syncs recent PRs for a repository

3. **Queue Manager** (`/src/lib/inngest/queue-manager.ts`)
   - Drop-in replacement for the old database queue
   - Sends events to Inngest instead of database inserts

4. **Netlify Function** (`/netlify/functions/inngest.ts`)
   - Serves the Inngest endpoint for event processing

## Local Development

### Setup

1. Install dependencies (already done):
   ```bash
   npm install inngest
   ```

2. Start all services together (recommended):
   ```bash
   npm start
   ```

   Or start services individually:
   ```bash
   # Terminal 1: Start Vite dev server
   npm run dev
   
   # Terminal 2: Start Netlify dev server
   netlify dev
   
   # Terminal 3: Start Inngest dev server (with function registration)
   npm run dev:inngest
   ```

4. Visit http://localhost:8288 to see the Inngest dashboard

### Testing Queue Operations

In the browser console:
```javascript
// Analyze data gaps
ProgressiveCapture.analyze()

// Queue jobs for a specific repository
ProgressiveCapture.quickFix('owner', 'repo')

// Check queue status (requires Inngest dashboard)
// Visit http://localhost:8288
```

## Production Deployment

### Environment Variables

Add to your Netlify environment:
```
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
```

### Monitoring

1. Visit https://app.inngest.com to access the production dashboard
2. View real-time job execution
3. Monitor failure rates and retry attempts
4. Set up alerts for failed jobs

## Benefits Over Previous Implementation

### Before (Database Queue)
- No visibility into job execution
- Manual retry implementation
- Basic console logging only
- Required custom monitoring
- Database polling every 30 seconds

### After (Inngest)
- Real-time execution dashboard
- Automatic retries with backoff
- Detailed execution logs
- Built-in alerting
- Event-driven architecture

## Common Operations

### Viewing Job Status
1. Open Inngest dashboard (dev: http://localhost:8288, prod: https://app.inngest.com)
2. Navigate to Functions tab
3. Click on a function to see execution history
4. Click on individual runs for detailed logs

### Debugging Failed Jobs
1. Find the failed execution in the dashboard
2. View the error message and stack trace
3. Check the step that failed
4. Use the replay feature to retry

### Rate Limit Management
Inngest automatically handles rate limiting through:
- Concurrency limits per function
- Throttling based on priority
- Automatic backoff on errors

## Migration Notes

The integration maintains backward compatibility:
- All existing code using `queueManager` works with `inngestQueueManager`
- UI notifications remain unchanged
- Progressive capture features work as before

## Troubleshooting

### Jobs Not Processing
1. Check Inngest Dev Server is running (`npm run dev:inngest`)
2. Verify Netlify function is accessible at http://localhost:8888/.netlify/functions/inngest
3. Ensure Inngest dev server is connected to the function endpoint (should show "Syncing with 1 app" in logs)
4. Check for errors in Inngest dashboard

### "No Functions Detected" Error
This happens when the Inngest dev server can't find your functions:
1. Ensure the Inngest dev server includes the `-u` flag: `npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest`
2. Check that both Netlify Dev and Inngest Dev servers are running
3. Verify the Netlify function responds at http://localhost:8888/.netlify/functions/inngest
4. Look for "Syncing" messages in the Inngest dev server logs

### Rate Limiting Issues
1. Adjust concurrency limits in function definitions
2. Implement priority-based throttling
3. Use step.sleep() for manual delays

### Local Development Issues
1. Ensure both dev servers are running
2. Check localhost:8288 for Inngest dashboard
3. Verify events are being sent (check Network tab)