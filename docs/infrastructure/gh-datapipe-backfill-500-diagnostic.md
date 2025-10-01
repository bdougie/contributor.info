# gh-datapipe Backfill 500 Error Diagnostic Guide

## Issue Summary

The `/api/backfill/trigger` endpoint is returning a 500 error when called from contributor.info.

**Error Details:**
```
POST https://contributor.info/api/backfill/trigger 500 (Internal Server Error)
{
  "status": 500,
  "statusText": "",
  "code": "INTERNAL_ERROR",
  "service": "backfill-trigger",
  "message": "Failed to trigger backfill: Failed to trigger backfill: Unknown error"
}
```

**Request Flow:**
1. Client → `POST /api/backfill/trigger` (contributor.info)
2. Netlify Function (backfill-trigger.ts) → `manualBackfillServerClient.triggerBackfill()`
3. Server Client → `POST https://gh-datapipe.fly.dev/api/backfill/trigger` ⚠️ **FAILS HERE**

**Request Payload:**
```json
{
  "repository": "continuedev/continue",
  "days": 30,
  "callback_url": "https://contributor.info/api/webhook/backfill-complete"
}
```

**Request Headers:**
```
Content-Type: application/json
X-API-Key: [value from GH_DATPIPE_KEY env var]
```

## Diagnostic Steps for gh-datapipe Repository

### 1. Check Service Health

```bash
# Test if gh-datapipe is running
curl https://gh-datapipe.fly.dev/health

# Expected response:
# {"status": "healthy"}
```

### 2. Test Backfill Endpoint Directly

```bash
# Replace with your actual API key
export GH_DATPIPE_KEY="your-key-here"

# Test the endpoint
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

### 3. Check Fly.io Logs

```bash
# View recent logs
fly logs -a gh-datapipe

# Filter for backfill-related errors
fly logs -a gh-datapipe | grep -i "backfill\|error\|500"

# Follow logs in real-time while testing
fly logs -a gh-datapipe --follow
```

### 4. Check Environment Variables

```bash
# List configured secrets
fly secrets list -a gh-datapipe

# Required secrets:
# - DATABASE_URL
# - GITHUB_TOKEN
# - GH_DATPIPE_KEY (or similar)
```

## Common Issues & Fixes

### Issue 1: Endpoint Not Found or Wrong Path

**Symptoms:**
- 404 errors or routing failures
- "Cannot POST /api/backfill/trigger" error

**Diagnosis:**
```typescript
// Check your router configuration
// Search codebase for: "backfill/trigger"
```

**Fix:**
```typescript
// Ensure endpoint is properly mounted
app.post('/api/backfill/trigger', backfillTriggerHandler);

// Or if using a router
router.post('/trigger', backfillTriggerHandler);
app.use('/api/backfill', router);
```

### Issue 2: Missing Error Handling

**Symptoms:**
- Generic "Unknown error" messages
- No detailed logs
- 500 responses without body

**Fix:**
```typescript
export async function backfillTriggerHandler(req: Request, res: Response) {
  try {
    const { repository, days = 30, callback_url, force = false } = req.body;

    // Validate input
    if (!repository) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'repository field is required',
        code: 'MISSING_REPOSITORY'
      });
    }

    // Validate format
    if (!repository.match(/^[\w.-]+\/[\w.-]+$/)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid repository format. Expected: owner/repo',
        code: 'INVALID_REPOSITORY_FORMAT'
      });
    }

    // Log incoming request
    console.log('[backfill-trigger] Request received:', {
      repository,
      days,
      callback_url,
      force,
      timestamp: new Date().toISOString(),
      headers: {
        'content-type': req.headers['content-type'],
        'x-api-key': req.headers['x-api-key'] ? '***' : 'missing'
      }
    });

    // Process backfill
    const jobId = await queueBackfillJob({
      repository,
      days,
      callback_url,
      force
    });

    console.log('[backfill-trigger] Job queued:', {
      job_id: jobId,
      repository,
      timestamp: new Date().toISOString()
    });

    // Return success response
    return res.status(200).json({
      success: true,
      job_id: jobId,
      status: 'queued',
      repository,
      days,
      estimated_completion: new Date(Date.now() + days * 60000).toISOString(),
      status_url: `/api/backfill/status/${jobId}`,
      message: 'Backfill job queued successfully'
    });

  } catch (error) {
    // Log detailed error information
    console.error('[backfill-trigger] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      repository: req.body?.repository
    });

    // Categorize error and return appropriate status code
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMITED';
    } else if (errorMessage.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    } else if (errorMessage.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
    }

    return res.status(statusCode).json({
      error: 'Failed to trigger backfill',
      message: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Issue 3: API Key Validation Failing

**Symptoms:**
- 401 or 403 errors
- "Unauthorized" messages

**Fix:**
```typescript
// Add API key middleware
function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.GH_DATPIPE_KEY;

  if (!expectedKey) {
    console.error('[auth] GH_DATPIPE_KEY not configured');
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'API key validation not configured',
      code: 'SERVICE_MISCONFIGURED'
    });
  }

  if (!apiKey) {
    console.warn('[auth] Request missing API key');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'X-API-Key header is required',
      code: 'MISSING_API_KEY'
    });
  }

  if (apiKey !== expectedKey) {
    console.warn('[auth] Invalid API key provided');
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
}

// Apply middleware
app.post('/api/backfill/trigger', validateApiKey, backfillTriggerHandler);
```

### Issue 4: Missing Dependencies or Database Connection

**Symptoms:**
- Database connection errors
- "Cannot connect to..." errors

**Fix:**
```typescript
// Add startup health checks
async function checkDependencies() {
  const checks = {
    database: false,
    github: false,
    queue: false
  };

  // Check database
  try {
    await db.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    console.error('[startup] Database check failed:', error);
  }

  // Check GitHub API
  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    });
    checks.github = response.ok;
  } catch (error) {
    console.error('[startup] GitHub API check failed:', error);
  }

  // Log results
  console.log('[startup] Dependency checks:', checks);

  return checks;
}

// Run on startup
checkDependencies();
```

### Issue 5: CORS Configuration

**Fix:**
```typescript
// Add CORS middleware for backfill endpoints
app.use('/api/backfill', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});
```

## GitHub Issue Template

Use this when creating an issue in the gh-datapipe repository:

```markdown
## Bug: Backfill Trigger Endpoint Returning 500 Error

### Description
The `/api/backfill/trigger` endpoint is returning 500 Internal Server Error when called from contributor.info.

### Error Details
**Status:** 500 Internal Server Error
**Error Message:** "Failed to trigger backfill: Unknown error"
**Service:** backfill-trigger

### Request Details
**Endpoint:** `POST https://gh-datapipe.fly.dev/api/backfill/trigger`

**Headers:**
```
Content-Type: application/json
X-API-Key: [configured from GH_DATPIPE_KEY]
```

**Payload:**
```json
{
  "repository": "continuedev/continue",
  "days": 30,
  "callback_url": "https://contributor.info/api/webhook/backfill-complete"
}
```

### Expected Behavior
Should return 200 OK with:
```json
{
  "job_id": "uuid",
  "status": "queued",
  "repository": "continuedev/continue",
  "days": 30,
  "estimated_completion": "2025-10-02T00:00:00Z",
  "status_url": "/api/backfill/status/uuid"
}
```

### Actual Behavior
Returns 500 with generic error message and no detailed logging.

### Investigation Needed
1. Check if `/api/backfill/trigger` endpoint exists and is mounted correctly
2. Review error logs in Fly.io for this endpoint
3. Verify environment variables (GH_DATPIPE_KEY, DATABASE_URL, etc.)
4. Add comprehensive error handling and logging
5. Test endpoint directly with curl

### Diagnostic Commands
```bash
# Check service health
fly logs -a gh-datapipe | grep -i "backfill\|error"

# Test endpoint
curl -X POST https://gh-datapipe.fly.dev/api/backfill/trigger \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $GH_DATPIPE_KEY" \
  -d '{"repository":"continuedev/continue","days":30}'
```

### Impact
- Prevents manual data backfilling for repositories
- Blocks users from triggering comprehensive historical data sync
- Reduces data quality for new repository tracking

### Related Files (in contributor.info)
- `netlify/functions/backfill-trigger.ts` - Calls this endpoint
- `src/lib/manual-backfill/server-client.ts:42` - Makes the request
- `src/components/features/repository/unified-sync-button.tsx:188` - Triggers from UI
```

## Alternative: Switch to Supabase Edge Function

If gh-datapipe is down or difficult to fix, contributor.info already has a Supabase Edge Function implementation at:
- `supabase/functions/manual-backfill/index.ts`

To switch, update `netlify.toml` line 173-176 to redirect to Supabase instead of gh-datapipe.

## Next Steps

1. **Immediate:** Run diagnostic commands above to identify root cause
2. **Short-term:** Implement comprehensive error handling in gh-datapipe
3. **Long-term:** Consider migrating to Supabase Edge Function for better reliability and timeout handling (similar to queue-event migration)
