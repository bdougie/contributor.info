# GitHub Webhook Update Guide

## Overview

This guide explains how to update GitHub webhooks to use the new hybrid routing system for workspace repository events.

## Current Setup

- **OLD URL**: `https://contributor.info/.netlify/functions/api-workspaces-webhook`
- **NEW URL**: `https://contributor.info/.netlify/functions/api-workspaces-webhook-hybrid`

## Update Steps

### 1. Identify Affected Repositories

Repositories that send webhooks to contributor.info need to be updated. These are typically:
- Repositories tracked in workspaces
- Organizations with workspace integrations

### 2. Update Repository Webhooks

For each repository:

1. Go to repository Settings → Webhooks
2. Find the webhook pointing to:
   ```
   https://contributor.info/.netlify/functions/api-workspaces-webhook
   ```
3. Click "Edit"
4. Update the Payload URL to:
   ```
   https://contributor.info/.netlify/functions/api-workspaces-webhook-hybrid
   ```
5. Keep all other settings the same:
   - Content type: `application/json`
   - Secret: Keep existing secret
   - Events: Keep existing event selections

### 3. Bulk Update via GitHub API

For organizations with many repositories:

```bash
# List webhooks for a repo
gh api repos/OWNER/REPO/hooks

# Update webhook URL
gh api repos/OWNER/REPO/hooks/HOOK_ID \
  --method PATCH \
  --field config[url]="https://contributor.info/.netlify/functions/api-workspaces-webhook-hybrid"
```

### 4. Test Webhooks

After updating, test each webhook:

1. Click "Recent Deliveries" in webhook settings
2. Select a recent delivery
3. Click "Redeliver"
4. Verify you receive a 202 Accepted response

## Expected Response

The new hybrid endpoint returns:
```json
{
  "status": "accepted",
  "message": "Webhook queued for processing",
  "jobId": "uuid-here",
  "processingMode": "background"
}
```

For high-volume events (>10 workspaces):
```json
{
  "status": "accepted",
  "message": "High-volume webhook queued for processing",
  "jobId": "uuid-here",
  "affectedWorkspaces": 25,
  "processingMode": "background"
}
```

## Monitoring Webhook Processing

### Check Webhook Job Status
```sql
-- Recent webhook jobs
SELECT
  type,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration
FROM background_jobs
WHERE type LIKE 'webhook/%'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY type, status
ORDER BY type;
```

### High-Volume Repository Detection
```sql
-- Find repos affecting many workspaces
SELECT
  (payload->>'data'->>'repository'->>'full_name') as repository,
  COUNT(*) as webhook_count,
  COUNT(DISTINCT payload->>'data'->>'action') as unique_actions
FROM background_jobs
WHERE type LIKE 'webhook/%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY webhook_count DESC
LIMIT 10;
```

## Supported Events

The hybrid webhook handler supports:
- `repository` - Repository created, deleted, archived, etc.
- `pull_request` - PR opened, closed, merged, etc.
- `issues` - Issue opened, closed, labeled, etc.
- `push` - Commits pushed to repository

## Benefits

1. **No Timeouts**: Webhooks affecting 50+ workspaces won't timeout
2. **Immediate Response**: GitHub receives acknowledgment in <1s
3. **Background Processing**: Complex operations happen asynchronously
4. **Automatic Retries**: Failed webhook processing retries automatically
5. **Full Visibility**: Track all webhook jobs in database

## Rollback Plan

If issues occur, webhooks can be reverted to:
```
https://contributor.info/.netlify/functions/api-workspaces-webhook
```

However, this will restore timeout risks for high-volume repositories.

## Gradual Migration

Recommended approach:
1. Start with low-traffic repositories
2. Monitor job processing for 24 hours
3. Update medium-traffic repositories
4. Finally update high-traffic repositories

## Troubleshooting

### Webhook Not Processing
1. Verify webhook secret matches
2. Check `background_jobs` table for queued jobs
3. Review Supabase function logs

### Slow Processing
1. Check workspace count for repository
2. Review job duration metrics
3. Consider increasing `WORKSPACE_THRESHOLD`

### Failed Jobs
```sql
-- Find failed webhook jobs
SELECT
  id,
  type,
  payload->>'event' as github_event,
  error,
  retry_count
FROM background_jobs
WHERE type LIKE 'webhook/%'
  AND status = 'failed'
  AND failed_at > NOW() - INTERVAL '1 hour';
```