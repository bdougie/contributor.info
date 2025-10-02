# Testing Inngest on Supabase Edge Functions

## Overview

This document provides instructions for testing the Inngest deployment on Supabase Edge Functions.

## Endpoint Details

- **URL**: `https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod`
- **Anon Key**: Get from Supabase Dashboard → Settings → API → Project API keys

## Testing Commands

### 1. Basic Connectivity Test
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod
```
Expected: HTTP 200

### 2. GET Request (Inngest Introspection)
```bash
curl -s \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod
```
This should return the function definitions and configuration.

### 3. OPTIONS Preflight
```bash
curl -s -X OPTIONS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod
```
Expected: HTTP 200

### 4. HEAD Request (Health Check)
```bash
curl -I \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod
```
Should return `X-Inngest-Ready: true` header.

## Viewing Logs

To monitor the function execution in real-time:

```bash
# Using Supabase CLI (if version supports it)
supabase functions logs inngest-prod --project-ref [PROJECT_REF] --tail

# Or view in the dashboard
# https://supabase.com/dashboard/project/[PROJECT_REF]/functions/inngest-prod/logs
```

## Expected Responses

### Successful GET Response
```json
{
  "framework": "deno-edge",
  "app": "contributor-info",
  "functions": [...],
  "hasEventKey": true,
  "hasSigningKey": true,
  "mode": "cloud",
  "schemaVersion": "2024-01-01",
  "endpoint": "https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod"
}
```

### Successful POST Response (Event Acknowledgment)
```json
{
  "success": true,
  "message": "Event received and queued for processing",
  "event": "event.name",
  "functionId": "matching-function-id"
}
```

## Testing Without Authentication

For local testing or debugging, you can temporarily disable authentication requirements in the Supabase Dashboard:

1. Go to Settings → API
2. Find the Edge Functions section
3. Temporarily adjust security settings (not recommended for production)

## Troubleshooting

### 401 Unauthorized
- Check that you're using the correct anon key
- Verify the key hasn't expired
- Ensure both `Authorization` and `apikey` headers are set

### 500 Internal Server Error
- Check function logs for detailed error messages
- Verify environment variables are properly set
- Ensure the function code deployed successfully

### CORS Issues
- The function includes CORS headers for all origins (`*`)
- If testing from a browser, ensure OPTIONS preflight works

## Environment Variables

Ensure these are set in Supabase Dashboard (Settings → Edge Functions → Secrets):

- `INNGEST_APP_ID` - Application identifier (default: 'contributor-info')
- `INNGEST_PRODUCTION_EVENT_KEY` - Inngest production event key
- `INNGEST_PRODUCTION_SIGNING_KEY` - Inngest production signing key
- `GITHUB_TOKEN` - GitHub API token for repository operations

## Deployment

To deploy updates to the function:

```bash
# Deploy function
supabase functions deploy inngest-prod --project-ref [PROJECT_REF]

# Check deployment status
supabase functions list --project-ref [PROJECT_REF]
```

## Integration with Inngest

Once environment variables are configured, Inngest should automatically discover the endpoint at:
- Production: `https://contributor.info/api/inngest`
- Direct: `https://[PROJECT_REF].supabase.co/functions/v1/inngest-prod`

The function will then receive webhook events and process jobs according to the registered functions.