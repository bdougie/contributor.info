# Hybrid Job Processing System

## Overview

This system solves the 60% Inngest timeout failure rate by implementing a hybrid approach that intelligently routes jobs based on their expected execution time.

- **Fast jobs (<10s)**: Processed directly on Netlify Functions
- **Long jobs (>10s)**: Delegated to Supabase Edge Functions (150s timeout)
- **All jobs**: Tracked in Supabase database for monitoring

## Architecture

```
Inngest Webhook
    ↓
Netlify Function (inngest-hybrid)
    ↓
Job Router
    ├── Quick Jobs → Process immediately → Return to Inngest
    └── Long Jobs → Queue in Database → Trigger Supabase → Return to Inngest
                           ↓
                  Supabase Edge Function
                      (process-job)
                           ↓
                    Process & Update DB
```

## Components

### 1. Database Schema (`background_jobs` table)

Tracks all long-running jobs with:
- Job metadata (type, payload, status)
- Timing information (created, started, completed)
- Retry logic (retry_count, max_retries)
- Performance metrics (duration_ms)
- Correlation IDs (inngest_event_id, repository_id)

### 2. Netlify Handler (`inngest-hybrid.ts`)

**Endpoint**: `/api/inngest` or `/.netlify/functions/inngest-hybrid`

Responsibilities:
- Receives Inngest webhooks
- Routes jobs based on type
- Creates job records for long-running tasks
- Triggers Supabase function asynchronously
- Returns immediately to Inngest (prevents timeout)

### 3. Supabase Edge Function (`process-job`)

**Endpoint**: `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/process-job`

Capabilities:
- 150-second timeout (vs 10s on Netlify)
- Processes queued jobs
- Updates job status in real-time
- Implements retry logic
- Handles GitHub API rate limiting

### 4. Monitoring Queries

Located in `/supabase/queries/job-monitoring.sql`:
- Queue status
- Failed job analysis
- Performance metrics by job type
- Long-running job detection
- Success rate trends

## Configuration

### Environment Variables

```env
# Netlify Function
VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Supabase Edge Function
GITHUB_TOKEN=your-github-token
```

### Long-Running Job Types

Currently configured in `inngest-hybrid.ts`:
```typescript
const LONG_RUNNING_JOBS = [
  'capture/repository.sync.graphql',
  'capture/repository.sync',
  'capture/pr.details.graphql',
  'capture/pr.reviews',
  'capture/pr.comments',
  'capture/issue.comments',
  'capture/repository.issues',
  'classify/repository.single',
  'classify/repository.size',
  'discover/repository.new'
];
```

## Usage

### 1. Deploy the System

```bash
# Deploy Supabase function
npx supabase functions deploy process-job --project-ref egcxzonpmmcirmgqdrla --no-verify-jwt

# Deploy Netlify function
netlify deploy --prod
```

### 2. Configure Inngest

Point your Inngest webhook to:
```
https://contributor.info/.netlify/functions/inngest-hybrid
```

### 3. Monitor Jobs

```sql
-- Check job queue status
SELECT * FROM get_job_statistics_summary();

-- View failed jobs
SELECT * FROM background_jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '1 hour';

-- Check processing times
SELECT * FROM job_statistics;
```

### 4. Retry Failed Jobs

```sql
-- Retry specific job
SELECT retry_failed_job('job-uuid-here');

-- Retry all recent failures
SELECT retry_failed_job(id)
FROM background_jobs
WHERE status = 'failed'
  AND retry_count < max_retries
  AND failed_at > NOW() - INTERVAL '1 hour';
```

## Benefits

1. **Immediate Fix**: Solves 60% timeout failures
2. **Full Visibility**: Database tracking of all jobs
3. **Gradual Migration**: Move jobs as needed
4. **No Inngest Changes**: Works with existing webhooks
5. **Cost Effective**: Only long jobs use Supabase functions
6. **Retry Logic**: Automatic retry with backoff
7. **Performance Metrics**: Built-in monitoring

## Monitoring Dashboard Queries

### Real-time Queue Status
```sql
SELECT * FROM get_job_statistics_summary();
```

### Job Performance by Type
```sql
SELECT
  type,
  COUNT(*) as total,
  ROUND(AVG(duration_ms)/1000, 1) as avg_seconds,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) as success_rate
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY total DESC;
```

### Currently Processing
```sql
SELECT
  id,
  type,
  ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))) as seconds_running
FROM background_jobs
WHERE status = 'processing'
ORDER BY started_at;
```

## Troubleshooting

### Jobs Stuck in Processing

```sql
-- Find stuck jobs (running > 5 minutes)
UPDATE background_jobs
SET status = 'failed',
    error = 'Job timeout - stuck in processing',
    failed_at = NOW()
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes';
```

### High Failure Rate

Check:
1. GitHub token validity
2. API rate limits
3. Supabase function logs
4. Network connectivity

### Manual Job Trigger

```bash
# Process next queued job
curl -X POST https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/process-job \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Process specific job
curl -X POST https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/process-job \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "uuid-here", "immediate": true}'
```

## Future Improvements

1. **Job Prioritization**: Add priority field for queue ordering
2. **Scheduled Jobs**: Cron-like scheduling for regular tasks
3. **Job Dependencies**: Chain jobs with dependencies
4. **Webhook Callbacks**: Notify external systems on completion
5. **Dashboard UI**: Build React component for job monitoring
6. **Auto-scaling**: Multiple workers for parallel processing
7. **Dead Letter Queue**: Separate handling for permanently failed jobs