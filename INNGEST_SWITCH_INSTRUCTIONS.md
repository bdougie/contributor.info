# Switch Inngest Back to Netlify Functions

## Problem
- Supabase Edge Functions are stubs (not fully migrated)
- Jobs stuck in "processing" for hours
- No PR data fetched in 5+ days

## Solution: Revert to Working Netlify Functions

### Step 1: Update Inngest Webhook URL

1. **Go to Inngest Dashboard**: https://app.inngest.com
2. **Navigate to**: Settings > Webhooks (or Apps > contributor-info > Settings)
3. **Update the webhook URL from**:
   ```
   https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod
   ```
   **to**:
   ```
   https://contributor.info/.netlify/functions/inngest-prod
   ```

### Step 2: Clean Up Stuck Jobs

Run this SQL in Supabase SQL Editor:

```sql
-- Mark all stuck jobs as failed (processing > 10 minutes)
UPDATE progressive_capture_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error = 'Job stuck in processing - Inngest endpoint was misconfigured'
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

### Step 3: Verify Netlify Function Works

Test the endpoint:
```bash
curl -X GET https://contributor.info/.netlify/functions/inngest-prod
```

Should return Inngest introspection data (list of functions).

### Step 4: Trigger Test Sync

After updating webhook, test with a small repo:
1. Go to https://contributor.info/continuedev/continue
2. Watch for new PR data to appear
3. Check console for any 403 errors (should be gone)

### Step 5: Monitor for Issues

**Watch for:**
- ✅ Jobs completing successfully (not stuck)
- ✅ New PR data appearing
- ⚠️ Timeout errors on large repos (>1000 PRs)
- ⚠️ Rate limit warnings

**Check logs:**
- Inngest Dashboard: Events & Function Runs
- Netlify Dashboard: Functions > Logs
- Supabase: progressive_capture_jobs table

### Known Limitations

**Netlify Functions have 10s timeout** (vs Supabase 150s):
- May timeout on very large repos
- Consider using GitHub Actions for bulk processing
- See hybrid-queue-manager.ts routing logic

### Next Steps (Future)

1. Complete Supabase Edge Function migration
2. Implement progressive backfill for large repos
3. Add circuit breaker for failing syncs
4. Monitor and optimize for large repo performance

---

## Automated Monitoring (Added Oct 1, 2025)

To prevent future webhook misconfiguration issues:

**Automated Stuck Job Cleanup:**
- Runs every 15 minutes via pg_cron
- Automatically marks jobs stuck >10 minutes as failed
- Logs warnings when >10 jobs are stuck

**Health Check Endpoint:**
```bash
curl https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/health-inngest
```

**Health check monitors:**
- Stuck jobs (>5 minutes in processing)
- Recent completions (last hour)
- Failure rates (last 2 hours)
- Returns HTTP 503 if critical issues detected

**Query stuck jobs manually:**
```sql
SELECT * FROM stuck_jobs_monitor;
-- or
SELECT * FROM get_stuck_job_summary();
```

---

## Quick Reference

**Netlify Function URLs:**
- Production: `https://contributor.info/.netlify/functions/inngest-prod`
- Preview: `http://main--contributor-info.netlify.app/.netlify/functions/inngest-prod`

**Health Checks:**
- Inngest health: `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/health-inngest`
- Cleanup status: Check `stuck_jobs_monitor` view

**Site Details:**
- Site ID: `49290020-1b2d-42c0-b1c9-ed386355493e`
- Primary URL: `https://contributor.info`
- Netlify Dashboard: https://app.netlify.com/sites/contributor-info

**Inngest Event Key:**
- Check: `.env.local` → `INNGEST_EVENT_KEY`
- Or Netlify: Environment Variables
