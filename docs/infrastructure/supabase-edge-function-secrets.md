# Supabase Edge Function Secrets Configuration

## Overview
This document tracks the secrets configured for Supabase Edge Functions in the contributor.info project.

## Configured Secrets (as of 2025-08-22)

The following secrets have been configured for the Supabase project (`egcxzonpmmcirmgqdrla`):

| Secret Name | Purpose | Last Updated |
|------------|---------|--------------|
| `INNGEST_EVENT_KEY` | Authentication key for sending events to Inngest | 2025-08-22 |
| `INNGEST_SIGNING_KEY` | Signing key for verifying Inngest webhook requests | 2025-08-22 |

## Edge Functions Using These Secrets

### queue-event
- **Location**: Deployed as Supabase Edge Function
- **Purpose**: Receives events from the browser and forwards them to Inngest
- **Timeout**: 150 seconds (vs Netlify's 10 second limit)
- **Endpoint**: `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/queue-event`

## Managing Secrets

### Viewing Secrets
```bash
npx supabase secrets list --project-ref egcxzonpmmcirmgqdrla
```

### Setting Secrets
```bash
npx supabase secrets set SECRET_NAME="secret_value" --project-ref egcxzonpmmcirmgqdrla
```

### Removing Secrets
```bash
npx supabase secrets unset SECRET_NAME --project-ref egcxzonpmmcirmgqdrla
```

## Notes
- Secrets are automatically available to all Edge Functions in the project
- Changes to secrets take effect immediately without requiring redeployment
- The secrets are synced from Netlify environment variables to maintain consistency