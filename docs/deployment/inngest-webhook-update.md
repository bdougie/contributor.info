# Inngest Webhook URL Update Guide

## Overview

This guide explains how to update the Inngest webhook URL to use the new hybrid routing system that prevents timeout issues.

## Current Setup

- **OLD URL**: `https://contributor.info/.netlify/functions/api-inngest`
- **NEW URL**: `https://contributor.info/.netlify/functions/inngest-hybrid`

## Update Steps

### 1. Access Inngest Dashboard

1. Go to [Inngest Dashboard](https://app.inngest.com)
2. Log in with your credentials
3. Navigate to your app settings

### 2. Update Webhook Endpoint

1. Find the webhook configuration section
2. Update the endpoint URL from:
   ```
   https://contributor.info/.netlify/functions/api-inngest
   ```
   To:
   ```
   https://contributor.info/.netlify/functions/inngest-hybrid
   ```

### 3. Test the Connection

1. Use Inngest's "Test Webhook" feature
2. Verify you receive a 200 OK response
3. Check that the introspection endpoint works

### 4. Verify Job Processing

After updating, monitor job processing:

```sql
-- Check recent Inngest jobs
SELECT
  type,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration
FROM background_jobs
WHERE type LIKE 'capture/%'
   OR type LIKE 'classify/%'
   OR type LIKE 'discover/%'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY type, status
ORDER BY type;
```

## Benefits of the Hybrid System

1. **Automatic Routing**: Long-running jobs automatically go to Supabase (150s timeout)
2. **Fast Processing**: Quick jobs still process on Netlify (< 1s)
3. **No More Timeouts**: 60% failure rate should drop to near 0%
4. **Better Monitoring**: All jobs tracked in `background_jobs` table

## Rollback Plan

If issues occur, you can rollback to the original endpoint:
```
https://contributor.info/.netlify/functions/api-inngest
```

However, this will restore the 60% timeout failure rate.

## Long-Running Job Types

These job types are automatically routed to Supabase:
- `capture/repository.sync.graphql`
- `capture/repository.sync`
- `capture/pr.details.graphql`
- `capture/pr.reviews`
- `capture/pr.comments`
- `capture/issue.comments`
- `capture/repository.issues`
- `classify/repository.single`
- `classify/repository.size`
- `discover/repository.new`

## Monitoring

### Check Job Queue
```sql
SELECT * FROM get_job_statistics_summary();
```

### Failed Jobs
```sql
SELECT
  id,
  type,
  error,
  retry_count,
  failed_at
FROM background_jobs
WHERE status = 'failed'
  AND failed_at > NOW() - INTERVAL '1 hour'
ORDER BY failed_at DESC;
```

## Support

If you encounter issues:
1. Check the Netlify function logs
2. Check Supabase Edge Function logs
3. Review the `background_jobs` table for error messages