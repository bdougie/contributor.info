# Supabase Edge Functions Deployment Guide

## Overview

As of October 2025, contributor.info has migrated critical background processing functions to Supabase Edge Functions to overcome timeout limitations and improve reliability. This is a **practical deployment guide** focusing on the `npx supabase functions deploy` commands and operational aspects.

**For technical architecture details, see: [Supabase Edge Functions Architecture](./supabase-edge-functions.md)**

## Why Supabase Edge Functions?

### Previous Issues with Netlify Functions
- **10-second timeout limit** causing failures for long-running jobs
- Bundle size constraints with ML models
- Limited compute resources for intensive operations

### Benefits of Supabase Edge Functions
- **150-second timeout** - 15x longer than Netlify
- Better resource allocation for ML workloads
- Native PostgreSQL integration
- Isolated runtime environment

## Deployed Functions

### Core Functions

#### `inngest-prod`
Production Inngest endpoint for job processing:
- Handles background job orchestration
- Processes webhooks and events
- Manages queue operations

```bash
# Deploy command
npx supabase functions deploy inngest-prod --no-verify-jwt
```

#### `compute-embeddings`
ML embedding generation for similarity search:
- Generates MiniLM-L6-v2 embeddings (384 dimensions)
- Processes issues, PRs, and discussions
- Updates similarity cache

```bash
# Deploy command
npx supabase functions deploy compute-embeddings --no-verify-jwt
```

## Deployment Process

### Prerequisites

1. **Install Supabase CLI**
```bash
npm install -g supabase
```

2. **Login to Supabase**
```bash
npx supabase login
```

3. **Link to Project**
```bash
npx supabase link --project-ref <your-project-ref>
```

### Deployment Commands

#### Deploy All Functions
```bash
# Deploy all functions in supabase/functions directory
npx supabase functions deploy --no-verify-jwt
```

#### Deploy Specific Function
```bash
# Deploy a single function
npx supabase functions deploy <function-name> --no-verify-jwt
```

#### Important Flags
- `--no-verify-jwt`: Required for functions that handle webhooks or need public access
- `--import-map`: Specify custom import map if needed
- `--project-ref`: Target specific project

### Setting Secrets

Edge functions need access to environment variables:

```bash
# Set individual secret
npx supabase secrets set INNGEST_SIGNING_KEY=<your-key>
npx supabase secrets set INNGEST_EVENT_KEY=<your-key>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>

# Set multiple secrets from .env file
npx supabase secrets set --env-file .env.production

# List current secrets
npx supabase secrets list
```

## Configuration

### Required Environment Variables

```env
# Inngest Configuration
INNGEST_SIGNING_KEY=your-signing-key
INNGEST_EVENT_KEY=your-event-key

# Supabase Configuration
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Optional: OpenAI for certain features
OPENAI_API_KEY=your-openai-key
```

### Function Configuration

Each function has a configuration in `supabase/functions/<function-name>/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Function logic here
    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
```

## Monitoring & Debugging

### View Function Logs

```bash
# Stream logs for specific function
npx supabase functions logs <function-name> --tail

# View recent logs
npx supabase functions logs <function-name> --limit 100

# Filter by log level
npx supabase functions logs <function-name> --level error
```

### Test Function Locally

```bash
# Serve function locally for testing
npx supabase functions serve <function-name> --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/<function-name>' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"test": "data"}'
```

### Production Testing

```bash
# Test deployed function
curl -i --location --request POST 'https://<project-ref>.supabase.co/functions/v1/<function-name>' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"test": "data"}'
```

## Common Issues & Solutions

### Issue: "No x-inngest-signature provided"

**Cause**: Missing or incorrect Inngest signing key

**Solution**:
```bash
# Verify secret is set
npx supabase secrets list

# Re-deploy with correct secret
npx supabase secrets set INNGEST_SIGNING_KEY=<correct-key>
npx supabase functions deploy inngest-prod --no-verify-jwt
```

### Issue: "Missing authorization header"

**Cause**: Missing service role key or incorrect headers

**Solution**:
```bash
# Set service role key
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>

# Ensure requests include header
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" ...
```

### Issue: Function timeout

**Cause**: Function exceeding 150-second limit

**Solution**:
- Break up large operations into smaller chunks
- Implement pagination for data processing
- Use background jobs for very long operations

### Issue: "Function not found"

**Cause**: Function not deployed or incorrect URL

**Solution**:
```bash
# List deployed functions
npx supabase functions list

# Deploy if missing
npx supabase functions deploy <function-name> --no-verify-jwt
```

## Best Practices

### 1. Deployment Strategy
- Always test locally before deploying
- Use version control for function code
- Deploy during low-traffic periods
- Monitor logs after deployment

### 2. Security
- Use `--no-verify-jwt` only when necessary
- Validate input data thoroughly
- Use service role key only for admin operations
- Implement rate limiting where appropriate

### 3. Performance
- Minimize cold starts with warm-up requests
- Cache frequently accessed data
- Use streaming for large responses
- Implement proper error handling

### 4. Monitoring
- Set up alerts for function errors
- Monitor execution times
- Track resource usage
- Log important operations

## Migration from Netlify Functions

If migrating from Netlify Functions:

1. **Update function URLs**:
```typescript
// Old: Netlify
const url = '/.netlify/functions/my-function';

// New: Supabase
const url = `${SUPABASE_URL}/functions/v1/my-function`;
```

2. **Update authentication**:
```typescript
// Add Supabase auth header
headers: {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
}
```

3. **Handle CORS**:
```typescript
// Supabase functions need explicit CORS handling
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
};
```

## Rollback Procedure

If a deployment causes issues:

1. **Immediate Rollback**:
```bash
# Deploy previous version from git
git checkout <previous-commit>
npx supabase functions deploy <function-name> --no-verify-jwt
```

2. **Verify Rollback**:
```bash
# Check function is responding
curl https://<project-ref>.supabase.co/functions/v1/<function-name>/health
```

3. **Monitor Logs**:
```bash
npx supabase functions logs <function-name> --tail
```

## Related Documentation

- [Supabase Edge Functions Architecture](./supabase-edge-functions.md) - Technical architecture and data flow
- [Dual Inngest Architecture](./dual-inngest-architecture.md) - Complete system architecture
- [Hybrid Job Processing](./hybrid-job-processing.md) - Job routing strategy
- [Embedding Computation](../data-fetching/embedding-computation.md) - ML workload example
- [Edge Function Secrets](./supabase-edge-function-secrets.md) - Secret management guide
- [Queue Event Migration](./queue-event-migration.md) - Migration from Netlify to Supabase

## Support & Troubleshooting

For additional help:
1. Check Supabase Dashboard → Functions tab for metrics
2. Review function logs for detailed error messages
3. Consult [Supabase Edge Functions docs](https://supabase.com/docs/guides/functions)
4. Check GitHub issues for similar problems

---

**Important**: Always use `--no-verify-jwt` for webhook handlers and public endpoints. This is a critical requirement for functions like `inngest-prod` that receive external webhooks.