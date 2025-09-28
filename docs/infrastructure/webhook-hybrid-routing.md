# Webhook Hybrid Routing System

## Overview

The webhook hybrid routing system addresses timeout issues with GitHub webhooks that affect multiple workspaces. By intelligently routing high-volume webhook events to background processing with 150s timeout capability, we prevent the 10s Netlify timeout from causing webhook failures.

## Problem Statement

- GitHub webhooks processing affecting many workspaces (50+) can timeout
- Each workspace requires multiple operations (cache invalidation, Inngest events)
- Popular repositories in many workspaces create cascading operations
- Network latency with external APIs (Inngest) adds 100-200ms per call
- 10s Netlify timeout is insufficient for high-volume operations

## Solution Architecture

```
GitHub Webhook → api-workspaces-webhook-hybrid (Netlify)
                            ↓
                  [Routing Decision Logic]
                     /              \
            Quick Events       High-Volume Events
                 ↓                     ↓
         Process Inline        Queue to background_jobs
              (< 1s)                    ↓
                            process-webhook (Supabase)
                                  (150s timeout)
```

## Components

### 1. api-workspaces-webhook-hybrid (Netlify Function)

**Location**: `/netlify/functions/api-workspaces-webhook-hybrid.mts`

**Responsibilities**:
- Verify GitHub webhook signatures
- Count affected workspaces
- Route to appropriate processing path
- Return immediate acknowledgment to GitHub

**Routing Logic**:
```typescript
if (workspaceCount > WORKSPACE_THRESHOLD) {
  // Route to background processing
  routeToBackground(githubEvent, payload);
} else if (QUICK_EVENTS.includes(githubEvent)) {
  // Process inline
  processQuickWebhook(githubEvent, payload);
} else {
  // Default to background for consistency
  routeToBackground(githubEvent, payload);
}
```

### 2. process-webhook (Supabase Edge Function)

**Location**: `/supabase/functions/process-webhook/index.ts`

**Responsibilities**:
- Process webhook jobs with 150s timeout
- Handle all workspace operations
- Send Inngest events
- Update job status in database

**Supported Events**:
- `pull_request`: Cache invalidation + metrics aggregation
- `issues`: Cache invalidation
- `push`: Debounced metrics aggregation
- `repository`: Workspace change notifications

### 3. Background Jobs Table

**Schema**: `/supabase/migrations/20250121000000_background_jobs.sql`

Webhook jobs are stored with type prefix `webhook/*`:
- `webhook/pull_request`
- `webhook/issues`
- `webhook/push`
- `webhook/repository`

## Configuration

### Environment Variables

```bash
# Netlify Function
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Supabase Function
INNGEST_EVENT_KEY=your-inngest-event-key
```

### Thresholds

```typescript
const WORKSPACE_THRESHOLD = 10; // Route to background if > 10 workspaces
const QUICK_EVENTS = ['ping', 'repository']; // Always process inline
```

## Deployment

### 1. Deploy Supabase Function

```bash
supabase functions deploy process-webhook --no-verify-jwt
```

### 2. Update GitHub Webhook URL

Point GitHub webhooks to:
```
https://your-site.netlify.app/.netlify/functions/api-workspaces-webhook-hybrid
```

### 3. Monitor Job Processing

```sql
-- Check webhook job status
SELECT
  type,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration
FROM background_jobs
WHERE type LIKE 'webhook/%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY type, status
ORDER BY type, status;
```

## Benefits

1. **No More Timeouts**: 150s processing time for complex operations
2. **Better Scalability**: Can handle repositories in 100+ workspaces
3. **Improved Reliability**: Automatic retries for failed jobs
4. **Visibility**: Full job tracking and monitoring
5. **Graceful Degradation**: Quick events still process immediately

## Migration Path

1. Keep original `api-workspaces-webhook` function as fallback
2. Deploy `api-workspaces-webhook-hybrid` alongside
3. Test with low-traffic webhooks first
4. Gradually migrate high-traffic webhooks
5. Monitor job completion rates

## Monitoring Queries

### Webhook Processing Performance

```sql
-- Webhook job performance by event type
SELECT * FROM get_job_statistics_summary()
WHERE type LIKE 'webhook/%';

-- High-volume webhook detection
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

### Failed Webhook Jobs

```sql
-- Failed webhook jobs requiring attention
SELECT
  id,
  type,
  payload->>'event' as github_event,
  payload->>'action' as action,
  error,
  retry_count,
  failed_at
FROM background_jobs
WHERE type LIKE 'webhook/%'
  AND status = 'failed'
  AND failed_at > NOW() - INTERVAL '1 hour'
ORDER BY failed_at DESC;
```

## Troubleshooting

### Common Issues

1. **Webhook Not Processing**
   - Check GitHub webhook secret configuration
   - Verify Supabase function is deployed
   - Check background_jobs table for queued jobs

2. **Inngest Events Not Sending**
   - Verify INNGEST_EVENT_KEY is set
   - Check Inngest dashboard for received events
   - Review process-webhook function logs

3. **High Latency**
   - Monitor workspace count per repository
   - Consider increasing WORKSPACE_THRESHOLD
   - Review Inngest event batching strategy

## Future Improvements

1. **Batch Processing**: Group multiple webhook events for same repository
2. **Priority Queues**: Separate queues for different event types
3. **Circuit Breakers**: Temporarily bypass failing external services
4. **Event Deduplication**: Prevent duplicate processing of rapid events
5. **Webhook Replay**: Admin tool to replay failed webhooks