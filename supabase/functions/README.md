# Supabase Edge Functions

This directory contains serverless edge functions for the contributor.info project. Edge functions run close to users for low latency and handle various tasks like data synchronization, webhook processing, and background jobs.

## Quick Start

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Docker running (for local development)
- Environment variables configured

### Local Development

```bash
# Start Supabase locally
npx supabase start

# Serve a specific function with hot reload
npx supabase functions serve function-name --env-file supabase/.env.local

# Test the function
curl -X POST http://localhost:54321/functions/v1/function-name \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Deployment

```bash
# Deploy all functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy function-name

# Set secrets
npx supabase secrets set GITHUB_TOKEN=your_token
```

## Function Categories

### 🔄 Data Synchronization
Sync data from GitHub to Supabase database:
- `repository-sync-graphql` - GraphQL-based sync (recommended)
- `repository-sync` - REST API-based sync (legacy)
- `github-sync` - General GitHub data sync
- `workspace-issues-sync` - Workspace-specific sync

### 🪝 Webhook Processing
Handle GitHub webhook events:
- `github-webhook` - Main webhook handler
- `process-webhook` - Webhook processor utility
- `queue-event` - Event queue for async processing

### ⚙️ Background Jobs
Process long-running tasks:
- `github-backfill` - Historical data backfill
- `manual-backfill` - Manual trigger backfill
- `backfill-pr-stats` - PR statistics backfill
- `pr-details-batch` - Batch PR processing
- `process-job` - Generic job processor
- `cleanup-stuck-jobs` - Stuck job cleanup

### 🏥 Health Checks
Monitor system health:
- `health` - Main health endpoint
- `health-database` - Database health
- `health-github` - GitHub API health
- `health-inngest` - Inngest health
- `health-jobs` - Job queue health

### 📊 Data Processing
Transform and analyze data:
- `spam-detection` - Profile spam detection
- `repository-summary` - Repository statistics
- `calculate-monthly-rankings` - Monthly rankings
- `insights` - Repository insights

### 🔌 Integrations
External service integrations:
- `inngest-prod` - Inngest event processing
- `codeowners-llm` - LLM CODEOWNERS suggestions
- `social-cards` - Social media cards
- `url-shortener` - URL shortening

### 📧 Communications
Email and notifications:
- `welcome-email` - Welcome new users
- `workspace-invitation-email` - Workspace invites
- `workspace-invitation-accept` - Accept invites
- `workspace-invitation-decline` - Decline invites

### 🛠️ Specialized
Specific use cases:
- `sync-pr-reviewers` - PR reviewer sync
- `purge-old-file-data` - Old data cleanup

## Directory Structure

```
supabase/functions/
├── _shared/              # Shared utilities
│   ├── cors.ts          # CORS headers
│   ├── event-detection.ts   # Event routing
│   ├── confidence-scoring.ts # Score calculation
│   ├── bot-detection.ts     # Bot detection
│   └── spam-detection-integration.ts
├── _templates/          # Function templates
│   └── function-template.ts
├── function-name/       # Individual functions
│   ├── index.ts         # Main function code
│   └── README.md        # Function docs (if complex)
└── __tests__/           # Function tests
```

## Shared Utilities

Located in `_shared/`, these utilities are reusable across functions:

### cors.ts
CORS headers configuration for cross-origin requests.

```typescript
import { corsHeaders } from '../_shared/cors.ts';

return new Response(data, {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### event-detection.ts
GitHub event detection and routing logic.

```typescript
import { detectPrivilegedEvent, isBotAccount } from '../_shared/event-detection.ts';

const isBot = isBotAccount(username);
const event = detectPrivilegedEvent(webhookEvent);
```

### confidence-scoring.ts
Contributor confidence score calculation.

```typescript
import { calculateConfidenceScore } from '../_shared/confidence-scoring.ts';

const score = await calculateConfidenceScore(supabase, contributorId);
```

See [Shared Utilities Documentation](./_shared/README.md) for detailed usage.

## Environment Variables

### Required for All Functions
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Function-Specific Variables
```bash
# GitHub Integration
GITHUB_TOKEN=ghp_your_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Inngest Integration
INNGEST_SIGNING_KEY=your_signing_key
INNGEST_EVENT_KEY=your_event_key

# Optional
ENVIRONMENT=production
```

Configure locally in `supabase/.env.local`:
```bash
# Copy example file
cp supabase/.env.example supabase/.env.local

# Edit with your values
vim supabase/.env.local
```

## Creating a New Function

### Using the Template

```bash
# Copy template
cp supabase/functions/_templates/function-template.ts \
   supabase/functions/new-function/index.ts

# Edit the function
vim supabase/functions/new-function/index.ts

# Test locally
npx supabase functions serve new-function --env-file supabase/.env.local

# Deploy
npx supabase functions deploy new-function
```

### Function Template Structure

```typescript
/**
 * Function Name Edge Function
 * 
 * Brief description of what this function does.
 * 
 * @param {Request} request - HTTP request object
 * @returns {Promise<Response>} JSON response
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Your logic here
    
    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
```

## Best Practices

### 1. Always Handle CORS
```typescript
// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Include in responses
return new Response(data, { headers: corsHeaders });
```

### 2. Use Format Specifiers in Logs
```typescript
// ✅ GOOD: Prevents security issues
console.log('Processing: %s/%s', owner, name);

// ❌ BAD: Template literals can expose sensitive data
console.log(`Processing: ${owner}/${name}`);
```

### 3. Validate Inputs
```typescript
const body = await req.json();
if (!body.owner || !body.name) {
  return new Response(
    JSON.stringify({ error: 'Missing required fields' }),
    { status: 400, headers: corsHeaders }
  );
}
```

### 4. Handle Errors Gracefully
```typescript
try {
  // Main logic
} catch (error) {
  console.error('Error:', error);
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: corsHeaders }
  );
}
```

### 5. Use Batch Operations
```typescript
// ✅ GOOD: Single batch upsert
await supabase.from('table').upsert(records);

// ❌ BAD: Individual inserts
for (const record of records) {
  await supabase.from('table').insert(record);
}
```

## Testing

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:54321/functions/v1/health

# Test with data
curl -X POST http://localhost:54321/functions/v1/repository-sync-graphql \
  -H "Content-Type: application/json" \
  -d '{"owner": "bdougie", "name": "contributor.info"}'
```

### Automated Tests
```bash
# Run function tests
npm run test:functions
```

## Monitoring

### View Logs
```bash
# View logs in Supabase dashboard
# Or use CLI
npx supabase functions logs function-name
```

### Health Checks
All health check functions return:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "database": { "status": "healthy", "latency": 50 },
    "github": { "status": "healthy", "latency": 100 }
  }
}
```

## Troubleshooting

### Function Not Responding
1. Check Supabase dashboard for errors
2. Verify environment variables are set
3. Check function logs for error messages
4. Test locally with `npx supabase functions serve`

### CORS Errors
1. Ensure `corsHeaders` are imported
2. Handle OPTIONS requests
3. Include headers in all responses

### Database Errors
1. Verify Supabase URL and key
2. Check RLS policies
3. Validate table permissions

### Timeout Issues
1. Use pagination for large datasets
2. Implement batch processing
3. Consider async job queues
4. Optimize database queries

## Documentation

- [Architecture Guide](../../docs/supabase/edge-functions-architecture.md) - Detailed patterns and conventions
- [Shared Utilities](./_shared/README.md) - Utility documentation
- Individual function READMEs - Complex function documentation

## Contributing

When adding or modifying functions:

1. Follow the architecture patterns
2. Add JSDoc comments
3. Include error handling
4. Update this README
5. Add tests
6. Document environment variables
7. Test locally before deploying

## Resources

- [Supabase Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [GitHub API Docs](https://docs.github.com/en/rest)

## Support

For questions or issues:
- Check the [Architecture Guide](../../docs/supabase/edge-functions-architecture.md)
- Review function-specific READMEs
- Open an issue on GitHub
- Ask in project discussions
