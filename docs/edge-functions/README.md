# Edge Functions Documentation

This folder contains documentation for Supabase Edge Functions (Deno-based serverless functions).

## Contents

### Configuration

- **[setting-secrets.md](./setting-secrets.md)** - Guide for setting and managing secrets in Supabase Edge Functions

## Purpose

This directory documents:
- Edge Function development
- Secret management
- Deployment procedures
- Performance optimization
- Error handling
- Testing strategies

## Edge Functions Overview

### What Are Edge Functions?

Supabase Edge Functions are:
- Deno-based serverless functions
- Deployed globally on Deno Deploy
- TypeScript/JavaScript compatible
- Integrated with Supabase services
- Automatically scaled

### When to Use Edge Functions

Use Edge Functions for:
- GitHub API integrations
- Background data processing
- Webhook handlers
- Custom business logic
- AI/ML integrations (OpenAI)
- Data transformations

## Current Edge Functions

### Inngest Integration
Handles background job processing:
- Repository sync
- Embeddings generation
- Workspace updates
- Scheduled tasks

### GitHub Sync
Manages GitHub data synchronization:
- Pull request data
- Issue tracking
- Contributor information
- Repository metrics

### Workspace Operations
Workspace-specific functionality:
- Issue sync
- Activity tracking
- Member management

## Development Workflow

### Local Development
```bash
# Start Edge Functions locally
supabase functions serve

# Test function
curl -i --location --request POST 'http://localhost:54321/functions/v1/function-name' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

### Function Structure
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Extract request data
  const { method, url } = req;

  // Handle request
  if (method === 'POST') {
    const body = await req.json();
    // Process request
  }

  // Return response
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

## Secret Management

### Setting Secrets
```bash
# Set a single secret
supabase secrets set SECRET_NAME="value" \
  --project-ref your-project-ref

# Set multiple secrets from .env file
supabase secrets set --env-file .env.production

# List secrets (shows hashes only)
supabase secrets list
```

### Required Secrets
- `GITHUB_TOKEN` - GitHub API access
- `OPENAI_API_KEY` - OpenAI integration
- `INNGEST_SIGNING_KEY` - Inngest authentication
- `SUPABASE_SERVICE_ROLE_KEY` - Database access

### Accessing Secrets
```typescript
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  throw new Error('API key not configured');
}
```

## Deployment

### Deploy Single Function
```bash
supabase functions deploy function-name \
  --project-ref your-project-ref
```

### Deploy All Functions
```bash
supabase functions deploy --project-ref your-project-ref
```

### Verify Deployment
```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs function-name
```

## Performance Optimization

### Cold Start Mitigation
- Keep functions small and focused
- Minimize dependencies
- Use import maps for shared code
- Consider warming strategies

### Memory Management
- Default: 512 MB
- Monitor memory usage in logs
- Optimize large data processing
- Use streaming for large responses

### Timeout Configuration
- Default: 60 seconds
- Configure via function metadata
- Consider chunking long operations

## Error Handling

### Best Practices
```typescript
try {
  // Function logic
  const result = await processData();
  return new Response(JSON.stringify({ result }), { status: 200 });
} catch (error) {
  console.error('Error processing request:', error);
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500 }
  );
}
```

### Validation
```typescript
import { z } from 'https://deno.land/x/zod/mod.ts';

const requestSchema = z.object({
  repository: z.string(),
  action: z.enum(['sync', 'update']),
});

const body = await req.json();
const result = requestSchema.safeParse(body);
if (!result.success) {
  return new Response(
    JSON.stringify({ error: 'Invalid request', details: result.error }),
    { status: 400 }
  );
}
```

## Testing

### Unit Tests
```typescript
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('processes data correctly', () => {
  const result = processData({ input: 'test' });
  assertEquals(result, 'expected output');
});
```

### Integration Tests
Test with local Supabase:
```bash
supabase start
supabase functions serve
# Run test requests
```

## Monitoring

### View Logs
```bash
# Recent logs
supabase functions logs function-name

# Follow logs in real-time
supabase functions logs function-name --follow

# Filter by time
supabase functions logs function-name --since 1h
```

### Key Metrics
- Invocation count
- Error rate
- Execution time
- Memory usage
- Cold start frequency

## Troubleshooting

### Function Not Responding
1. Check deployment status
2. Verify secrets are set
3. Review function logs
4. Test with curl locally

### High Error Rates
1. Check error logs for patterns
2. Verify API integrations
3. Review timeout settings
4. Check resource limits

### Slow Performance
1. Profile function execution
2. Optimize database queries
3. Reduce dependency size
4. Use caching strategies

## Best Practices

1. **Validate input** using Zod schemas
2. **Handle errors gracefully** with try-catch
3. **Log important events** for debugging
4. **Use environment variables** for configuration
5. **Keep functions focused** on single responsibilities
6. **Test locally** before deploying
7. **Monitor performance** post-deployment
8. **Document function behavior** in code comments

## Related Documentation

- [Infrastructure](../infrastructure/) - Infrastructure setup
- [API](../api/) - API documentation
- [Deployment](../deployment/) - Deployment procedures
- [Supabase Setup](../supabase/) - Supabase configuration
