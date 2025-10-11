# Manual Backfill Service Setup

This document describes how to configure and use the manual backfill service for fetching historical GitHub data.

## Environment Variables

The manual backfill service requires the following environment variables to be configured:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GH_DATPIPE_KEY` | API key for the GitHub data pipeline service | `ghp_xxx...` |
| `GH_DATPIPE_API_URL` | Base URL for the data pipeline API | `https://api.datapipe.example.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Base URL for webhook callbacks | `https://contributor.info` |

## Setup Instructions

### 1. Local Development

Create a `.env` file in your project root:

```bash
# Manual Backfill Configuration
GH_DATPIPE_KEY=your-api-key-here
GH_DATPIPE_API_URL=https://api.datapipe.example.com
BASE_URL=http://localhost:8888
```

### 2. Production (Netlify)

Add the environment variables in Netlify:

1. Go to Site settings → Environment variables
2. Add the required variables:
   - `GH_DATPIPE_KEY` - Your production API key
   - `GH_DATPIPE_API_URL` - Production API URL
3. Deploy or redeploy your site

## API Endpoints

The manual backfill service provides the following endpoints:

### Trigger Backfill
```
POST /api/backfill/trigger
```

Request body:
```json
{
  "repository": "owner/repo",
  "days": 90,
  "force": false,
  "callback_url": "optional-webhook-url"
}
```

Response (202 Accepted):
```json
{
  "job_id": "job-123",
  "status": "queued",
  "repository": "owner/repo",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Check Job Status
```
GET /api/backfill/status/{job_id}
```

Response (200 OK):
```json
{
  "job_id": "job-123",
  "status": "completed",
  "repository": "owner/repo",
  "progress": 100,
  "completed_at": "2024-01-01T01:00:00Z"
}
```

### Cancel Job
```
POST /api/backfill/cancel/{job_id}
```

Response (200 OK):
```json
{
  "job_id": "job-123",
  "status": "cancelled",
  "message": "Job cancelled successfully"
}
```

### List Jobs
```
GET /api/backfill/events
```

Query parameters:
- `status` - Filter by status (queued, running, completed, failed, cancelled)
- `limit` - Number of results (default: 10)

Response (200 OK):
```json
{
  "jobs": [
    {
      "job_id": "job-123",
      "repository": "owner/repo",
      "status": "completed",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 42
}
```

## Error Handling

### Service Unavailable (503)

When the environment variables are not configured, all endpoints will return:

```json
{
  "error": "Service unavailable",
  "message": "Backfill service is temporarily unavailable. Please try again later or use the sync button for immediate updates.",
  "code": "SERVICE_UNAVAILABLE"
}
```

### Rate Limiting (429)

When rate limits are exceeded:

```json
{
  "error": "Backfill trigger failed",
  "message": "Rate limit exceeded",
  "code": "RATE_LIMITED"
}
```

### Network Errors (502)

When the upstream service is unreachable:

```json
{
  "error": "Backfill trigger failed",
  "message": "Network error",
  "code": "NETWORK_ERROR"
}
```

## Troubleshooting

### 404 Not Found Error

If you're getting 404 errors when calling the backfill endpoints:

1. **Check environment variables**: Ensure `GH_DATPIPE_KEY` and `GH_DATPIPE_API_URL` are set
2. **Verify deployment**: Make sure the Netlify functions are deployed correctly
3. **Check function logs**: Look at Netlify function logs for initialization errors

### 503 Service Unavailable

This is the expected error when environment variables are not configured. To fix:

1. Add the required environment variables
2. Redeploy your application
3. The endpoints should now work correctly

### Testing the Setup

You can test if the service is configured correctly:

```bash
# Check if service is available
curl -X POST https://your-site.netlify.app/api/backfill/trigger \
  -H "Content-Type: application/json" \
  -d '{"repository": "test/repo"}'

# If you get a 503, the service is not configured
# If you get a 400 (bad repository format), the service is working
```

## Components Using This Service

The following UI components depend on the manual backfill service:

- `WorkspaceBackfillButton.tsx` - Workspace settings backfill button
- `WorkspaceBackfillManager.tsx` - Bulk backfill management
- `unified-sync-button.tsx` - Repository sync button
- `ManualBackfill.tsx` - Manual backfill debug page

## Implementation Details

The service uses lazy initialization to prevent function loading errors:

1. The `ManualBackfillServerClient` constructor no longer throws errors
2. Environment variable validation happens at method call time
3. This allows the Netlify function to load and return proper HTTP status codes
4. Without this pattern, missing env vars would cause 404 errors instead of 503

## Security Considerations

- Never commit API keys to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Consider IP whitelisting for production environments
- Monitor API usage for unusual patterns