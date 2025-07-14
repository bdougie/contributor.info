# Inngest Troubleshooting Guide

## Overview

This guide helps diagnose and fix common Inngest issues in the contributor.info project. Inngest handles real-time data processing for recent PRs and small batches.

## Quick Diagnosis

### Status Check

```bash
# Local environment
node scripts/debug-inngest-local.js

# Production environment  
node scripts/debug-inngest-auth.js

# Test events
node scripts/test-inngest-events.js
```

## Common Issues and Solutions

### 1. Events Created but Functions Not Running

**Symptoms**:
- Events appear in Inngest dashboard
- No function runs are triggered
- No errors in event stream

**Diagnosis**:
1. Check if functions are registered:
   - Local: http://localhost:8288/functions
   - Production: Check Inngest dashboard → Apps → contributor-info

2. Verify event names match:
   ```javascript
   // Event sent:
   { name: "capture/repository.sync.graphql", data: {...} }
   
   // Function listening for:
   { event: "capture/repository.sync.graphql" }  // ✅ Must match exactly
   ```

**Solutions**:

**A. Local Development**:
```bash
# 1. Stop all services
# 2. Start with npm start (not just netlify dev)
npm start

# 3. Wait for all services to initialize
# 4. Check functions are registered
open http://localhost:8288/functions
```

**B. Production**:
1. Verify endpoint is synced:
   - Go to https://app.inngest.com
   - Check Apps → contributor-info → Last synced
   
2. Re-sync if needed:
   - Trigger a new Netlify deploy
   - Or manually sync in Inngest dashboard

### 2. Authentication Failed in Production

**Symptoms**:
```json
{
  "authentication_succeeded": false,
  "has_event_key": true,
  "has_signing_key": false
}
```

**Solution**:

1. **Get correct keys from Inngest**:
   - Go to https://app.inngest.com/env/production/manage/keys
   - Copy keys from `contributor-info` app (NOT `default`)

2. **Add to Netlify**:
   ```
   INNGEST_PRODUCTION_EVENT_KEY = [event key]
   INNGEST_PRODUCTION_SIGNING_KEY = [signing key]
   ```
   - Scope: All (production, previews, branches)

3. **Trigger redeploy**:
   ```bash
   # Or push a commit to trigger deploy
   git commit --allow-empty -m "Trigger deploy for env vars"
   git push
   ```

### 3. Functions Not Appearing in Inngest

**Symptoms**:
- http://localhost:8288/functions shows empty
- No functions listed in dashboard

**Common Causes**:

1. **Import errors**:
   ```typescript
   // Check netlify dev console for errors like:
   // "Cannot find module './capture-functions'"
   // "ReferenceError: X is not defined"
   ```

2. **Environment variables missing**:
   ```bash
   # Required for functions to initialize:
   GITHUB_TOKEN or VITE_GITHUB_TOKEN
   SUPABASE_URL or VITE_SUPABASE_URL
   SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
   ```

3. **Wrong endpoint in npm start**:
   ```json
   // package.json - verify this points to correct function
   "start": "... \"npx inngest-cli@latest dev -u http://127.0.0.1:8888/.netlify/functions/inngest-local\""
   ```

**Solutions**:

1. **Check for import errors**:
   ```bash
   # Look at netlify dev output for errors
   # Fix any missing imports or syntax errors
   ```

2. **Use the full function file**:
   ```bash
   # Update package.json to use inngest-local-full
   # which includes all capture functions
   ```

3. **Verify environment**:
   ```bash
   # Check .env file has all required vars
   cat .env | grep -E "(GITHUB|SUPABASE|INNGEST)"
   ```

### 4. Rate Limiting Issues

**Symptoms**:
- Functions fail with rate limit errors
- GitHub API or Supabase limits exceeded

**Solutions**:

1. **Check current limits**:
   ```javascript
   // In function logs
   "GraphQL rate limit: 4950/5000 remaining"
   ```

2. **Adjust concurrency**:
   ```typescript
   // In function definition
   {
     id: "capture-repository-sync",
     concurrency: {
       limit: 3,  // Reduce if hitting limits
       key: "event.data.repositoryId"
     }
   }
   ```

3. **Use GitHub App token** (higher limits):
   - Verify GITHUB_TOKEN is from GitHub App
   - Not personal access token

### 5. Local vs Production Mismatch

**Issue**: Works locally but not in production

**Check these differences**:

1. **Environment variables**:
   ```bash
   # Local uses:
   INNGEST_EVENT_KEY
   INNGEST_SIGNING_KEY
   
   # Production uses:
   INNGEST_PRODUCTION_EVENT_KEY
   INNGEST_PRODUCTION_SIGNING_KEY
   ```

2. **App IDs**:
   ```typescript
   // Local might use:
   id: "contributor-info-local"
   
   // Production uses:
   id: "contributor-info"
   ```

3. **Function files**:
   - Local: `inngest-local.mts`
   - Production: `inngest-prod.mts`

## Debugging Tools

### 1. Event Testing Scripts

```bash
# Test local events
node scripts/test-inngest-events.js

# Test production events
node scripts/test-production-inngest.js
```

### 2. Diagnostic Scripts

```bash
# Full diagnostic
node scripts/diagnose-inngest.js

# Check registration
node scripts/check-inngest-registration.js
```

### 3. Browser Console

```javascript
// Send test event from browser
await fetch('/.netlify/functions/queue-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventName: 'test/prod.hello',
    data: { message: 'Browser test' }
  })
})
```

### 4. Inngest Dev UI

- **Event Stream**: http://localhost:8288/stream
- **Function Runs**: http://localhost:8288/runs
- **Registered Functions**: http://localhost:8288/functions

## Production Monitoring

### Check Function Health

1. **Inngest Dashboard**:
   - https://app.inngest.com/env/production/functions
   - Look for error rates, execution times

2. **Database Metrics**:
   ```sql
   -- Check Inngest performance
   SELECT 
     COUNT(*) as total_jobs,
     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
     SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
     AVG(processing_time_ms) as avg_time_ms
   FROM progressive_capture_jobs
   WHERE processor_type = 'inngest'
     AND created_at > NOW() - INTERVAL '1 hour';
   ```

### Alert on Issues

Set up monitoring for:
- High error rates (> 5%)
- Slow execution times (> 30s)
- Queue backlog growing

## Emergency Procedures

### Stop All Inngest Processing

```javascript
// In browser console
rollout.emergencyStop('Inngest issues detected')

// This routes all traffic away from hybrid system
```

### Manually Retry Failed Jobs

```sql
-- Find failed jobs
SELECT id, repository_id, job_type, error 
FROM progressive_capture_jobs
WHERE status = 'failed' 
  AND processor_type = 'inngest'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Reset for retry
UPDATE progressive_capture_jobs
SET status = 'pending', error = NULL
WHERE id IN (...);
```

### Switch to GitHub Actions

If Inngest is down:
```javascript
// Force all processing to GitHub Actions
rollout.setStrategy('github_actions_only')
```

## Best Practices

1. **Always use npm start** for local development
2. **Check function registration** before testing events
3. **Monitor rate limits** in function logs
4. **Use different event keys** for local vs production
5. **Test in production** with test events first
6. **Keep concurrency low** to avoid rate limits

## Getting Help

1. **Inngest Documentation**: https://www.inngest.com/docs
2. **Inngest Support**: Discord or GitHub issues
3. **Project Issues**: https://github.com/bdougie/contributor.info/issues
4. **Logs**: Check Netlify function logs for detailed errors