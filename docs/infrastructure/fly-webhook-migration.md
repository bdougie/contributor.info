# Fly.io Webhook Migration

## Overview

GitHub webhooks have been migrated from Netlify Functions to a dedicated Fly.io service to improve reliability and reduce 404 errors.

## Architecture

### Previous Setup (Netlify Functions)
- Webhooks handled by Netlify Functions at `/api/github-webhook` and `/api/github/webhook`
- Limited timeout (10 seconds for standard functions)
- Shared infrastructure with other serverless functions
- Resulted in ~9,310 404 errors due to timeout and cold start issues

### Current Setup (Fly.io)
- Dedicated webhook service running at `https://contributor-info-webhooks.fly.dev`
- Netlify redirects webhook traffic using 307 status (preserves POST method)
- Isolated infrastructure with better performance characteristics
- Longer timeout capabilities for processing large webhook payloads

## Webhook Routes

| Original Route | Redirects To | Status Code |
|---------------|--------------|-------------|
| `/api/github-webhook` | `https://contributor-info-webhooks.fly.dev/webhook` | 307 |
| `/api/github/webhook` | `https://contributor-info-webhooks.fly.dev/webhook` | 307 |

## Why 307 Status Code?

- **307 Temporary Redirect**: Preserves the HTTP method (POST) and request body
- Critical for webhooks as GitHub sends POST requests with JSON payloads
- Unlike 301/302 redirects which may change POST to GET

## Deployment

### Fly.io Service

The webhook service is deployed as a standalone application on Fly.io:

```bash
# Check service status
fly status -a contributor-info-webhooks

# View logs
fly logs -a contributor-info-webhooks

# Deploy updates
fly deploy -a contributor-info-webhooks
```

### Environment Variables

The Fly.io service requires the following secrets:

```bash
# Set secrets on Fly.io
fly secrets set GITHUB_WEBHOOK_SECRET=<secret> -a contributor-info-webhooks
fly secrets set SUPABASE_URL=<url> -a contributor-info-webhooks
fly secrets set SUPABASE_SERVICE_KEY=<key> -a contributor-info-webhooks
```

## Monitoring

### Health Checks

The Fly.io service exposes a health endpoint:
- `https://contributor-info-webhooks.fly.dev/health`

### Metrics

Monitor webhook processing:
1. Fly.io dashboard for service metrics
2. Supabase logs for database operations
3. GitHub webhook delivery status in repository settings

## Rollback Plan

If issues arise with the Fly.io service:

1. Remove redirects from `netlify.toml`
2. Restore original Netlify Function handlers
3. Update GitHub webhook URLs if needed

## Benefits

1. **Reduced 404 Errors**: ~9,310 webhook errors eliminated
2. **Better Performance**: Dedicated infrastructure, no cold starts
3. **Improved Reliability**: Longer timeouts, better error handling
4. **Easier Debugging**: Isolated logs and metrics
5. **Cost Efficiency**: Predictable pricing, no function invocation limits

## Related Files

- `/netlify.toml` - Contains redirect configuration
- `/fly.toml` - Fly.io service configuration (in webhook service repo)
- Original Netlify functions (deprecated):
  - `/netlify/functions/github-webhook.ts`
  - `/netlify/functions/github/webhook.ts`