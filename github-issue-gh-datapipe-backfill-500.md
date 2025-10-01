# 🐛 Backfill Trigger Endpoint Returns 500 Error

## Description
The `/api/backfill/trigger` endpoint is returning 500 Internal Server Error when called from contributor.info, preventing manual repository data backfilling.

## Error Details

**Status Code:** 500 Internal Server Error
**Error Response:**
```json
{
  "status": 500,
  "statusText": "",
  "code": "INTERNAL_ERROR",
  "service": "backfill-trigger",
  "message": "Failed to trigger backfill: Failed to trigger backfill: Unknown error"
}
```

## Request Information

**Endpoint:** `POST https://gh-datapipe.fly.dev/api/backfill/trigger`

**Headers:**
```
Content-Type: application/json
X-API-Key: [configured from env.GH_DATPIPE_KEY]
```

**Request Body:**
```json
{
  "repository": "continuedev/continue",
  "days": 30,
  "callback_url": "https://contributor.info/api/webhook/backfill-complete"
}
```

## Expected Behavior

Should return **200 OK** with job details:
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "repository": "continuedev/continue",
  "days": 30,
  "estimated_completion": "2025-10-02T00:00:00.000Z",
  "status_url": "/api/backfill/status/550e8400-e29b-41d4-a716-446655440000",
  "message": "Backfill job queued successfully"
}
```

## Actual Behavior

Returns **500 Internal Server Error** with generic error message. No detailed error information is provided, making it difficult to diagnose the root cause.

## Diagnostic Steps Taken

### 1. Service Health Check
```bash
curl https://gh-datapipe.fly.dev/health
```
**Status:** ⚠️ _Pending verification_

### 2. Direct Endpoint Test
```bash
curl -X POST https://gh-datapipe.fly.dev/api/backfill/trigger \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $GH_DATPIPE_KEY" \
  -d '{
    "repository": "continuedev/continue",
    "days": 30,
    "callback_url": "https://contributor.info/api/webhook/backfill-complete"
  }' \
  -v
```
**Status:** ⚠️ _Pending verification_

### 3. Log Analysis Needed
```bash
fly logs -a gh-datapipe | grep -i "backfill\|error\|500"
```

## Investigation Checklist

- [ ] Verify `/api/backfill/trigger` endpoint exists and is mounted correctly
- [ ] Check Fly.io logs for detailed error messages during request processing
- [ ] Verify all required environment variables are set:
  - [ ] `DATABASE_URL`
  - [ ] `GITHUB_TOKEN`
  - [ ] `GH_DATPIPE_KEY` (or equivalent)
- [ ] Test database connectivity
- [ ] Test GitHub API connectivity
- [ ] Review authentication/authorization middleware
- [ ] Check CORS configuration
- [ ] Verify request body parsing middleware

## Suggested Fixes

### 1. Add Comprehensive Error Handling

```typescript
export async function backfillTriggerHandler(req: Request, res: Response) {
  try {
    const { repository, days = 30, callback_url, force = false } = req.body;

    // Input validation
    if (!repository) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'repository field is required',
        code: 'MISSING_REPOSITORY'
      });
    }

    // Detailed logging
    console.log('[backfill-trigger] Request:', {
      repository,
      days,
      callback_url,
      timestamp: new Date().toISOString()
    });

    // Process backfill
    const jobId = await queueBackfillJob({ repository, days, callback_url, force });

    console.log('[backfill-trigger] Success:', { job_id: jobId });

    return res.status(200).json({
      success: true,
      job_id: jobId,
      status: 'queued',
      repository,
      days,
      estimated_completion: new Date(Date.now() + days * 60000).toISOString(),
      status_url: `/api/backfill/status/${jobId}`
    });

  } catch (error) {
    // Detailed error logging
    console.error('[backfill-trigger] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      repository: req.body?.repository,
      timestamp: new Date().toISOString()
    });

    // Categorized error responses
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    if (errorMessage.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMITED';
    } else if (errorMessage.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (errorMessage.includes('unauthorized')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    }

    return res.status(statusCode).json({
      error: 'Failed to trigger backfill',
      message: errorMessage,
      code: errorCode
    });
  }
}
```

### 2. Add API Key Validation

```typescript
function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.GH_DATPIPE_KEY;

  if (!expectedKey) {
    return res.status(503).json({
      error: 'Service misconfigured',
      message: 'API key validation not configured',
      code: 'SERVICE_MISCONFIGURED'
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
}
```

### 3. Add Startup Health Checks

```typescript
async function checkDependencies() {
  const checks = { database: false, github: false };

  try {
    await db.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    console.error('[startup] Database unavailable:', error);
  }

  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    });
    checks.github = res.ok;
  } catch (error) {
    console.error('[startup] GitHub API unavailable:', error);
  }

  console.log('[startup] Health checks:', checks);
  return checks;
}
```

## Impact

**Severity:** High
**Affected Users:** All users attempting manual repository backfills

**User Impact:**
- Cannot trigger comprehensive historical data backfills
- Forced to rely on slower incremental sync (Inngest)
- Reduced data quality for newly tracked repositories
- Poor user experience with generic error messages

## Context

This endpoint is called from contributor.info's unified sync button when users want to backfill historical repository data (30+ days). The request flow is:

1. User clicks "Sync Now" button
2. Frontend → `POST /api/backfill/trigger` (contributor.info)
3. Netlify Function → `manualBackfillServerClient.triggerBackfill()`
4. HTTP Request → `POST https://gh-datapipe.fly.dev/api/backfill/trigger` ⚠️ **FAILS HERE**

**Related Files (contributor.info):**
- `netlify/functions/backfill-trigger.ts` - Netlify function that calls this endpoint
- `src/lib/manual-backfill/server-client.ts:42` - Makes the HTTP request
- `src/components/features/repository/unified-sync-button.tsx:188` - UI trigger

## Additional Information

**Similar Working Endpoint:** The `/health` endpoint works correctly, suggesting the service is running but this specific endpoint has issues.

**Previous Similar Issues:** This was working previously, so it's likely a recent regression or configuration change.

**Workaround Available:** Users can fall back to Inngest-based sync, but it only processes the last 7 days instead of 30+.

## Testing Instructions

Once fixed, test with:

```bash
# 1. Health check
curl https://gh-datapipe.fly.dev/health

# 2. Trigger backfill
curl -X POST https://gh-datapipe.fly.dev/api/backfill/trigger \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $GH_DATPIPE_KEY" \
  -d '{
    "repository": "continuedev/continue",
    "days": 30,
    "callback_url": "https://contributor.info/api/webhook/backfill-complete"
  }'

# Expected: 200 OK with job_id

# 3. Check job status
curl https://gh-datapipe.fly.dev/api/backfill/status/{job_id} \
  -H "X-API-Key: $GH_DATPIPE_KEY"
```

## Related Documentation

See full diagnostic guide: `docs/infrastructure/gh-datapipe-backfill-500-diagnostic.md` in contributor.info repository.

---

**Environment:**
- Service: gh-datapipe (Fly.io)
- Client: contributor.info (Netlify)
- Date Observed: 2025-10-01
