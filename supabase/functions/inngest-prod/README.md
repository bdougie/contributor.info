# Inngest Production Edge Function

This Supabase Edge Function handles Inngest webhook requests for production background job processing. It's a migration from the Netlify Function to take advantage of longer timeout limits and better performance.

## Features

- **150s timeout** (Supabase paid tier) vs 10s (Netlify)
- **CORS support** for Inngest webhook delivery
- **GraphQL-intensive operations** for GitHub data fetching
- **Repository size classification** using AI/ML metrics
- **Idempotency support** (planned) to prevent duplicate processing

## Environment Variables

The following environment variables must be configured in the Supabase dashboard:

```bash
# Supabase (automatically available)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Inngest Configuration
INNGEST_APP_ID=contributor-info
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# Alternative keys (for production environment)
INNGEST_PRODUCTION_EVENT_KEY=your-production-event-key
INNGEST_PRODUCTION_SIGNING_KEY=your-production-signing-key

# GitHub API Access
GITHUB_TOKEN=your-github-personal-access-token
# or
VITE_GITHUB_TOKEN=your-github-token
```

## Deployment

1. **Deploy the function**:
   ```bash
   supabase functions deploy inngest-prod
   ```

2. **Set environment variables**:
   ```bash
   supabase secrets set INNGEST_EVENT_KEY=your-key
   supabase secrets set INNGEST_SIGNING_KEY=your-key
   supabase secrets set GITHUB_TOKEN=your-token
   ```

3. **Update Inngest webhook URL**:
   - Go to Inngest dashboard
   - Update webhook URL to: `https://your-project.supabase.co/functions/v1/inngest-prod`

## Endpoints

### GET /functions/v1/inngest-prod
Returns status information about the endpoint including:
- Environment configuration
- Available functions
- CORS configuration
- Rate limit status

### POST /functions/v1/inngest-prod
Handles Inngest webhook requests with:
- Signature verification
- Function routing
- Error handling
- CORS headers

### OPTIONS /functions/v1/inngest-prod
Handles CORS preflight requests with proper headers for:
- `x-inngest-signature`
- `x-inngest-sdk`
- Standard CORS headers

## Functions

### Primary Functions (Fully Migrated)

1. **capture-repository-sync-graphql**
   - Syncs recent PRs using GitHub GraphQL API
   - Rate limiting: 5 concurrent, 75/min throttle
   - Supports different sync reasons with varying cooldowns

2. **classify-single-repository**
   - Classifies repository size (small/medium/large/xl)
   - Uses GitHub metrics: stars, forks, PRs, commits, contributors
   - Updates database with classification

### Supporting Functions (Stubs)

The following functions are included as stubs and would need full migration:
- `capture-pr-details`
- `capture-pr-reviews`
- `capture-pr-comments`
- `capture-issue-comments`
- `capture-repository-issues`
- `capture-repository-sync`
- `capture-pr-details-graphql`
- `classify-repository-size`
- `discover-new-repository`

## Testing

Run tests with:
```bash
npm run test:edge-functions
```

Tests cover:
- CORS header handling
- Webhook signature verification
- Environment configuration
- Error handling
- GraphQL client functionality
- Repository classification logic
- Performance with large payloads
- Idempotency (planned)

## Monitoring

Monitor the function using:
- Supabase Dashboard > Functions > Logs
- Inngest Dashboard > Events & Functions
- GitHub API rate limit status

## Rollback Plan

If issues occur, traffic can be routed back to Netlify:
1. Update Inngest webhook URL back to Netlify endpoint
2. Monitor error rates
3. Investigate issues in Supabase logs
4. Fix and redeploy

## Migration Status

- ✅ Main handler with CORS support
- ✅ GraphQL client for GitHub API
- ✅ Repository size classifier
- ✅ Core Inngest functions
- ✅ Comprehensive test suite
- ⏳ Idempotency key support (planned)
- ⏳ Full function migration (in progress)
- ⏳ Circuit breaker pattern (planned)

## Performance Considerations

- GraphQL queries are more efficient than REST (1 query vs multiple)
- Rate limits: 5000 points/hour for GraphQL vs 5000 requests/hour for REST
- Batch processing limited to prevent timeouts
- Automatic retry with exponential backoff

## Security

- Webhook signatures verified using `INNGEST_SIGNING_KEY`
- Service role key used for database operations
- GitHub token securely stored in environment
- CORS configured for Inngest domains only