# Inngest Functions Architecture

## Overview

The application uses [Inngest](https://www.inngest.com/) for event-driven background processing. Inngest functions handle data capture, synchronization, and processing tasks that would be too slow or resource-intensive for synchronous API requests.

## Deployment Architecture

### Production Functions
- **Location**: `supabase/functions/inngest-prod/index.ts`
- **Endpoint**: `/.netlify/functions/inngest-prod` (Supabase Edge Function)
- **Authentication**: Deployed with `--no-verify-jwt` flag
- **Environment**: Production Inngest workspace

### Local Development
- **Location**: `netlify/functions/inngest-local-full.mts`
- **Endpoint**: `/.netlify/functions/inngest-local-full`
- **Purpose**: Full production function set for local testing
- **Environment**: Inngest Dev Server

## Function Categories

### PR Capture Functions

#### `capture/pr.details`
Captures detailed information for a single PR including reviews and comments.

**Trigger**: Event `capture/pr.details`
```typescript
{
  repository: { owner: string, name: string },
  pr_number: number
}
```

**GraphQL API**: Uses REST API
**Performance**: ~2-3 seconds per PR
**Use Case**: Individual PR updates, user-initiated capture

#### `capture/repository.sync-graphql`
Bulk captures the 100 most recent PRs for a repository using GraphQL.

**Trigger**: Event `capture/repository.sync`
```typescript
{
  repository: { owner: string, name: string, github_id: string }
}
```

**GraphQL API**: GitHub GraphQL API
**Performance**: ~1-2 seconds for 100 PRs
**Use Case**: User navigates to repository page
**Strategy**: Fetches PRs ordered by `CREATED_AT DESC`

**Key Implementation Details**:
```typescript
// Fetch 100 newest PRs
const query = `
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: 100
        orderBy: {field: CREATED_AT, direction: DESC}
      ) {
        nodes {
          number
          title
          isDraft
          # ... other fields
        }
      }
    }
  }
`;
```

**Database Schema Mapping**:
```typescript
// IMPORTANT: Database column is 'draft', not 'is_draft'
await supabase.from('pull_requests').upsert({
  draft: pr.isDraft || false,  // ✅ Correct mapping
});
```

#### `capture/repository.sync-enhanced`
Most efficient bulk capture using batched operations.

**Trigger**: Event `capture/repository.sync-enhanced`
**GraphQL API**: GitHub GraphQL API with bulk queries
**Performance**: ~500ms for 100 PRs
**Use Case**: Large-scale syncs, scheduled updates
**Optimization**: Single bulk upsert instead of individual inserts

### Repository Classification

#### `classify/repository.size`
Classifies repositories by size for processing optimization.

**Trigger**: Event `classify/repository.size`
**Criteria**:
- Small: < 100 PRs
- Medium: 100-500 PRs
- Large: > 500 PRs

#### `classify/single-repository`
Classifies a single repository on-demand.

**Trigger**: Event `classify/single-repository`
**Use Case**: User adds new repository to workspace

### Discovery Functions

#### `discover/new-repository`
Discovers and initializes tracking for new repositories.

**Trigger**: Event `discover/new-repository`
**Actions**:
1. Checks if repository exists in database
2. Fetches repository metadata from GitHub
3. Creates repository record
4. Triggers initial PR sync

### Workspace Metrics

#### `aggregate/workspace-metrics`
Aggregates contribution metrics for workspaces.

**Trigger**: Event `aggregate/workspace-metrics`
**Schedule**: Daily at midnight UTC
**Aggregations**:
- Total PRs per workspace
- Active contributors
- Review statistics
- Contribution trends

#### `scheduled/workspace-aggregation`
Scheduled daily aggregation for all workspaces.

**Trigger**: Cron schedule `0 0 * * *`
**Actions**: Triggers `aggregate/workspace-metrics` for each workspace

#### `handle/workspace-repository-change`
Handles repository additions/removals from workspaces.

**Trigger**: Event `workspace/repository-change`
**Actions**: Updates workspace metrics incrementally

### Data Cleanup

#### `cleanup/workspace-metrics-data`
Cleans up old workspace metrics data.

**Trigger**: Event `cleanup/workspace-metrics`
**Schedule**: Weekly
**Retention**: Keeps last 90 days of daily metrics

### Priority Sync

#### `sync/workspace-priorities`
Syncs priority repositories for workspaces.

**Trigger**: Event `sync/workspace-priorities`
**Use Case**: High-value repositories get more frequent updates

### Discussion Sync

#### `sync/discussions-cron`
Syncs GitHub Discussions for repositories.

**Trigger**: Cron schedule
**Status**: Experimental feature

## Error Handling

### Retry Strategy
Inngest provides automatic retries with exponential backoff:
```typescript
{
  id: 'function-name',
  retries: 3,
  cancelOn: [
    {
      event: 'cancel/function',
      if: 'async.data.reason === "user_requested"'
    }
  ]
}
```

### Common Errors

#### Schema Mismatch (PGRST204)
```
Could not find the 'column_name' column of 'table_name' in the schema cache
```

**Cause**: Code uses wrong column name for database table
**Fix**: Verify column names match database schema exactly

**Example**: Using `is_draft` when database has `draft`

#### GraphQL Query Errors
```
Field 'pullRequests' doesn't accept argument 'filterBy'
```

**Cause**: Invalid arguments in GraphQL query
**Fix**: Consult GitHub GraphQL API documentation

#### Rate Limiting
```
API rate limit exceeded
```

**Cause**: Too many GitHub API requests
**Fix**: Implement request throttling, use GraphQL instead of REST

## Monitoring

### Inngest Dashboard
- Function execution status
- Runtime duration
- Error rates
- Event throughput

**URL**: https://app.inngest.com

### Supabase Logs
- Edge function invocations
- Console.log output
- Error traces

**URL**: https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla/functions/inngest-prod/logs

### Debug Logging

Functions include structured logging:
```typescript
console.log(`[DEBUG] Operation description: ${details}`);
console.error(`[ERROR] Error description:`, error);
console.log(`[DEBUG-ENHANCED] Enhanced function: ${details}`);
```

**Log Prefixes**:
- `[DEBUG]`: Standard debug information
- `[DEBUG-ENHANCED]`: Enhanced/optimized function path
- `[ERROR]`: Error conditions requiring attention

## Performance Optimization

### GraphQL vs REST
- **REST**: 1 request per PR = 100 requests for 100 PRs
- **GraphQL**: 1 request for 100 PRs = 100x fewer requests

### Bulk Operations
- **Individual upserts**: 100 database calls
- **Bulk upsert**: 1 database call
- **Performance gain**: ~90% faster

### Caching Strategy
1. Check Supabase cache first
2. Only fetch from GitHub if data missing/stale
3. Update cache after successful fetch

## Local Development

### Setup
```bash
# Start Inngest Dev Server
npx inngest-cli@latest dev

# Start Netlify Dev (serves functions)
npm run dev
```

### Testing Functions
```bash
# Trigger event manually
curl -X POST http://localhost:8288/e/contributor-info \
  -H "Content-Type: application/json" \
  -d '{
    "name": "capture/repository.sync",
    "data": {
      "repository": {
        "owner": "continuedev",
        "name": "continue",
        "github_id": "123456"
      }
    }
  }'
```

### Viewing Logs
- **Inngest UI**: http://localhost:8288
- **Netlify Dev**: Terminal output
- **Supabase**: Local Supabase Studio

## Deployment

### Production Deployment
```bash
# Deploy Supabase Edge Function
supabase functions deploy inngest-prod --no-verify-jwt

# Sync with Inngest Cloud
# Functions auto-register when endpoint is hit
```

### Environment Variables
Required in Supabase Edge Function:
```bash
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
```

## Best Practices

### Event Design
- Use clear, hierarchical event names (`capture/pr.details`)
- Include all necessary data in event payload
- Avoid fetching additional data in function body when possible

### Function Composition
- Keep functions focused on single responsibility
- Use step.run() for logical operation grouping
- Enable proper error isolation and retry

### Database Operations
- Always use `onConflict` for upserts
- Batch operations when possible
- Map API field names to database column names explicitly

### Error Handling
- Log errors with context
- Use appropriate HTTP status codes
- Implement graceful degradation

## Related Documentation
- [PR Capture Strategy](/docs/features/pr-capture-strategy.md)
- [Data Pipeline Architecture](/docs/architecture/data-pipeline.md)
- [Inngest Official Docs](https://www.inngest.com/docs)
