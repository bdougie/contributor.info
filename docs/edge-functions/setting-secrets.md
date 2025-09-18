# Setting Edge Function Secrets

## Overview
Edge Functions in Supabase require proper environment variables to integrate with external services like Inngest for event processing.

## Common Issues
- **500 errors from queue-event endpoint**: Missing INNGEST environment variables
- **Failed event queueing**: Edge Function cannot connect to Inngest API

## Solution

### Using the Setup Script
A script is provided to automatically set the required secrets:

```bash
./scripts/set-edge-function-secrets.sh
```

This script:
1. Sources environment variables from `.env`
2. Sets `INNGEST_API_URL` and `INNGEST_EVENT_KEY` in Supabase
3. Provides verification instructions

### Manual Setup
If you need to set secrets manually:

```bash
# Set individual secrets
supabase secrets set INNGEST_API_URL="https://api.inngest.com"
supabase secrets set INNGEST_EVENT_KEY="your-production-event-key"

# Verify secrets are set
supabase secrets list
```

### Required Environment Variables

| Variable | Purpose | Source |
|----------|---------|--------|
| `INNGEST_API_URL` | Inngest API endpoint | Usually `https://api.inngest.com` |
| `INNGEST_EVENT_KEY` | Authentication key for Inngest | Found in `.env` as `INNGEST_PRODUCTION_EVENT_KEY` |

## Verification
After setting secrets:
1. Check Edge Function logs for errors
2. Test event queueing through the UI
3. Monitor Inngest dashboard for incoming events

## Troubleshooting
- **Still getting 500 errors**: Ensure you're using the production event key, not the local development key
- **Secrets not applying**: Edge Functions use secrets immediately without needing a redeploy
- **Permission errors**: Ensure you have the necessary Supabase project permissions