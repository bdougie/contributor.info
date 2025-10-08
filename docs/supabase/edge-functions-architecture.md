# Edge Functions Architecture

## Overview

This document outlines the architecture, patterns, and conventions for Supabase Edge Functions in the contributor.info project. Edge functions are serverless functions deployed close to users for low latency and high performance.

## Purpose

Edge functions in this project serve several key purposes:

1. **Data Synchronization**: Sync data from GitHub to our Supabase database
2. **Webhook Processing**: Handle GitHub webhook events in real-time
3. **Background Jobs**: Process long-running tasks asynchronously
4. **Health Monitoring**: Provide health check endpoints for system monitoring
5. **API Integration**: Interface with external services (GitHub, Inngest, etc.)
6. **Data Processing**: Transform and analyze data (spam detection, insights, etc.)

## Function Categories

### Data Synchronization Functions
- `repository-sync-graphql` - GraphQL-based repository synchronization (recommended)
- `repository-sync` - REST API-based repository synchronization (legacy)
- `github-sync` - General GitHub data synchronization
- `workspace-issues-sync` - Workspace-specific issue synchronization

### Webhook Processing Functions
- `github-webhook` - Main GitHub webhook handler with event routing
- `process-webhook` - Webhook processing utility
- `queue-event` - Event queuing for async processing

### Background Job Functions
- `github-backfill` - Historical data backfill
- `manual-backfill` - Manually triggered data backfill
- `backfill-pr-stats` - Pull request statistics backfill
- `pr-details-batch` - Batch processing for PR details
- `process-job` - Generic job processor
- `cleanup-stuck-jobs` - Maintenance task for stuck jobs

### Health Check Functions
- `health` - Main health check endpoint
- `health-database` - Database health check
- `health-github` - GitHub API health check
- `health-inngest` - Inngest service health check
- `health-jobs` - Job queue health check

### Data Processing Functions
- `spam-detection` - Analyze GitHub profiles for spam indicators
- `repository-summary` - Generate repository statistics
- `calculate-monthly-rankings` - Monthly contributor rankings
- `insights` - Generate repository insights

### Integration Functions
- `inngest-prod` - Inngest event processing
- `codeowners-llm` - LLM-powered CODEOWNERS suggestions
- `social-cards` - Generate social media cards
- `url-shortener` - URL shortening service

### Communication Functions
- `welcome-email` - Send welcome emails to new users
- `workspace-invitation-email` - Send workspace invitations
- `workspace-invitation-accept` - Handle invitation acceptance
- `workspace-invitation-decline` - Handle invitation decline

### Specialized Functions
- `sync-pr-reviewers` - Sync PR reviewer information
- `purge-old-file-data` - Clean up old file data

## Recommended Patterns

### 1. Function Structure

```typescript
/**
 * [Function Name] Edge Function
 * 
 * [Brief description of function purpose]
 * 
 * @param {Request} request - HTTP request object
 * @returns {Promise<Response>} JSON response
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Main function logic
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Your code here
    
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

### 2. Import Patterns

**Deno Standard Library** (Pinned version for stability):
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';
```

**NPM Packages via ESM.sh**:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

**Shared Utilities** (Relative imports):
```typescript
import { corsHeaders } from '../_shared/cors.ts';
import { detectPrivilegedEvent } from '../_shared/event-detection.ts';
```

### 3. Error Handling

Always wrap main logic in try-catch blocks:

```typescript
try {
  // Main logic
} catch (error) {
  console.error('Function error:', error);
  return new Response(
    JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    }
  );
}
```

### 4. CORS Headers

Always include CORS headers in responses:

```typescript
import { corsHeaders } from '../_shared/cors.ts';

// Handle preflight requests
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Include in all responses
return new Response(data, {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### 5. Environment Variables

Access environment variables securely:

```typescript
// Required variables (fail fast with !)
const apiKey = Deno.env.get('GITHUB_TOKEN')!;

// Optional variables with defaults
const environment = Deno.env.get('ENVIRONMENT') || 'production';

// Validate required variables
if (!apiKey) {
  throw new Error('GITHUB_TOKEN environment variable is required');
}
```

### 6. Logging Best Practices

Use structured logging with format specifiers:

```typescript
// ✅ GOOD: Use format specifiers to prevent security issues
console.log('Processing repo: %s/%s', owner, name);
console.error('Error for user %s: %s', userId, error.message);

// ❌ BAD: Direct interpolation can cause security issues
console.log(`Processing repo: ${owner}/${name}`);
```

### 7. Database Operations

Use Supabase client with proper error handling:

```typescript
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Single record query
const { data, error } = await supabase
  .from('contributors')
  .select('*')
  .eq('login', username)
  .maybeSingle();

if (error) {
  throw new Error(`Database error: ${error.message}`);
}

// Batch operations with proper error handling
const { data: results, error: batchError } = await supabase
  .from('pull_requests')
  .upsert(records, { onConflict: 'github_id' });
```

### 8. Response Format Standards

Consistent response format across all functions:

```typescript
// Success response
{
  success: true,
  data: { /* result data */ },
  timestamp: new Date().toISOString(),
  metadata: {
    processed: 100,
    duration: 1234,
  }
}

// Error response
{
  success: false,
  error: "Error message",
  timestamp: new Date().toISOString(),
  details: { /* optional error details */ }
}
```

## Shared Utilities

### Available Utilities

Located in `supabase/functions/_shared/`:

1. **cors.ts** - CORS headers configuration
2. **event-detection.ts** - GitHub event detection and routing
3. **confidence-scoring.ts** - Contributor confidence score calculation
4. **bot-detection.ts** - Bot account detection
5. **spam-detection-integration.ts** - Spam detection integration

### Using Shared Utilities

```typescript
// Import shared utilities
import { corsHeaders } from '../_shared/cors.ts';
import { detectPrivilegedEvent, isBotAccount } from '../_shared/event-detection.ts';
import { calculateConfidenceScore } from '../_shared/confidence-scoring.ts';

// Use in your function
const isBot = isBotAccount(username);
const event = detectPrivilegedEvent(webhookEvent);
const score = await calculateConfidenceScore(supabase, contributorId);
```

## Security Considerations

### 1. Authentication & Authorization

- Use service role key for database operations
- Validate webhook signatures for GitHub events
- Never expose sensitive keys in responses
- Use Row Level Security (RLS) policies when possible

### 2. Input Validation

```typescript
// Validate request body
const body = await req.json();
if (!body.owner || !body.name) {
  return new Response(
    JSON.stringify({ error: 'Missing required fields: owner, name' }),
    { status: 400, headers: corsHeaders }
  );
}

// Sanitize inputs
const owner = String(body.owner).trim();
const name = String(body.name).trim();
```

### 3. Rate Limiting

Consider implementing rate limiting for public endpoints:

```typescript
// Check rate limit before processing
const rateLimitKey = `${userId}:${endpoint}`;
const requests = await getRateLimitCount(rateLimitKey);
if (requests > MAX_REQUESTS) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    { status: 429, headers: corsHeaders }
  );
}
```

### 4. Webhook Signature Verification

```typescript
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

async function verifyWebhookSignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');
  const webhookSecret = Deno.env.get('GITHUB_WEBHOOK_SECRET')!;
  
  if (!signature || !webhookSecret) {
    return false;
  }
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body)
  );
  
  const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Constant-time string comparison to prevent timing attacks
 * This prevents attackers from using timing information to forge signatures
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
```

## Performance Optimization

### 1. GraphQL vs REST API

**Prefer GraphQL for bulk operations:**

```typescript
// ✅ GOOD: GraphQL fetches all data in one request
const query = `
  query GetPullRequests($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100) {
        nodes {
          id
          number
          title
          # All fields in one query
        }
      }
    }
  }
`;
```

**Use REST API for single resources:**

```typescript
// ✅ GOOD: REST API is simpler for single resources
const response = await fetch(
  `https://api.github.com/repos/${owner}/${name}/pulls/${number}`
);
```

### 2. Batch Database Operations

```typescript
// ✅ GOOD: Batch upsert
const { error } = await supabase
  .from('contributors')
  .upsert(contributors, { onConflict: 'login' });

// ❌ BAD: Individual inserts in a loop
for (const contributor of contributors) {
  await supabase.from('contributors').insert(contributor);
}
```

### 3. Pagination

Handle large datasets with proper pagination:

```typescript
let hasNextPage = true;
let cursor = null;

while (hasNextPage) {
  const { data, pageInfo } = await fetchPage(cursor);
  await processData(data);
  
  hasNextPage = pageInfo.hasNextPage;
  cursor = pageInfo.endCursor;
}
```

## Testing Guidelines

### Local Testing

```bash
# Start Supabase locally
npx supabase start

# Serve a specific function
npx supabase functions serve function-name --env-file supabase/.env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/function-name \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Testing Checklist

- [ ] Test with valid inputs
- [ ] Test with invalid inputs
- [ ] Test error handling
- [ ] Test CORS preflight
- [ ] Verify response format
- [ ] Check logs for errors
- [ ] Test with production-like data volume

## Deployment

### Environment Variables

Required for all functions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Function-specific variables:
- `GITHUB_TOKEN` - For GitHub API calls
- `GITHUB_WEBHOOK_SECRET` - For webhook verification
- `INNGEST_SIGNING_KEY` - For Inngest integration

### Deploy Commands

```bash
# Deploy all functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy function-name

# Set environment variables
npx supabase secrets set GITHUB_TOKEN=your_token
```

## Monitoring & Debugging

### Logging

All logs are available in the Supabase dashboard:

```typescript
// Structured logging
console.log('Processing started:', {
  repository: `${owner}/${name}`,
  timestamp: new Date().toISOString(),
});

console.error('Error occurred:', {
  error: error.message,
  stack: error.stack,
});
```

### Metrics to Monitor

- Function invocation count
- Error rate
- Execution duration
- Database query performance
- External API latency

## Common Pitfalls

### 1. Missing CORS Headers

Always include CORS headers, especially for preflight requests.

### 2. Not Handling OPTIONS Requests

```typescript
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

### 3. Improper Error Handling

Always return proper HTTP status codes and error messages.

### 4. Hardcoded URLs

Use environment variables for all external URLs.

### 5. Not Validating Inputs

Always validate and sanitize user inputs.

### 6. Synchronous Processing of Large Datasets

Use pagination and batch processing for large datasets.

## Migration from REST to GraphQL

When migrating from REST to GraphQL:

1. Keep existing REST function as fallback
2. Create new GraphQL function with `-graphql` suffix
3. Test thoroughly with production data
4. Update callers to use new function
5. Monitor for errors and performance
6. Deprecate REST function after successful migration

## Function Versioning

When making breaking changes:

1. Create new version with suffix (e.g., `function-name-v2`)
2. Update callers gradually
3. Maintain old version for backward compatibility
4. Document migration path
5. Set deprecation timeline

## Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [CORS Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## Contributing

When adding new edge functions:

1. Follow the recommended patterns
2. Add JSDoc comments
3. Include error handling
4. Add to appropriate category
5. Update this documentation
6. Add tests
7. Document environment variables
