# Discussion Background Sync

This document explains how to use the Inngest background job for syncing GitHub discussions.

## Overview

The `capture-repository-discussions` function is an Inngest background job that:
- Fetches discussions from GitHub using GraphQL API
- Auto-generates AI summaries using OpenAI (like PR #999)
- Ensures discussion authors exist in contributors table
- Stores discussions in the database
- Mirrors the same pattern as issues and PR background sync

## Architecture

### Pattern Similarity

This follows the same pattern as issues and PRs:

**Issues**: `capture-repository-issues` → fetches issues → queues comment jobs
**PRs**: `capture-repository-sync-enhanced` → fetches PRs → queues detail jobs
**Discussions**: `capture-repository-discussions` → fetches discussions → stores with summaries

### Key Features

1. **GraphQL API**: Uses GitHub's GraphQL API for efficient data fetching
2. **AI Summaries**: Generates summaries inline during fetch (same as manual script)
3. **Author Management**: Automatically adds discussion authors to contributors
4. **Rate Limiting**: Throttled to 20 requests per minute
5. **Concurrency**: Limits 2 concurrent syncs per repository
6. **Sync Logging**: Tracks API calls and metadata

## Triggering the Sync

### Option 1: Via Inngest Client (Recommended for Code)

```typescript
import { inngest } from '@/lib/inngest/client';

// Trigger discussion sync for a repository
await inngest.send({
  name: 'capture/repository.discussions',
  data: {
    repositoryId: 'uuid-of-repository',
    maxItems: 100, // optional, defaults to 100
  },
});
```

### Option 2: Via HTTP Request

```bash
# Using Inngest CLI
curl -X POST https://api.inngest.com/v1/events \
  -H "Authorization: Bearer ${INNGEST_EVENT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "capture/repository.discussions",
    "data": {
      "repositoryId": "uuid-of-repository",
      "maxItems": 100
    }
  }'
```

### Option 3: From Repository Discovery

Add to the `discover-new-repository` function to auto-sync discussions:

```typescript
// After repository creation and classification
await step.sendEvent('trigger-discussion-sync', {
  name: 'capture/repository.discussions',
  data: {
    repositoryId: repository.id,
    maxItems: 100,
  },
});
```

## Event Payload

```typescript
{
  name: 'capture/repository.discussions',
  data: {
    repositoryId: string;  // Required: UUID of repository
    maxItems?: number;     // Optional: Max discussions to fetch (default: 100)
  }
}
```

## Response

```typescript
{
  success: true,
  repositoryId: 'uuid',
  discussionsProcessed: 50,    // Number fetched from GitHub
  discussionsStored: 50,        // Number stored in database
}
```

## Implementation Details

### Steps Executed

1. **Initialize Sync Log**: Creates sync log entry for tracking
2. **Get Repository**: Validates repo exists and has discussions enabled
3. **Fetch Discussions**: Uses GraphQL to paginate through discussions
4. **Upsert Authors**: Ensures all discussion authors are in contributors table
5. **Process & Store**: Generates AI summaries and stores discussions
6. **Complete Log**: Updates sync log with metrics

### AI Summary Generation

- Uses OpenAI `gpt-4o-mini` model
- Same prompt pattern as PR #999
- Max 150 characters, 1-2 sentences
- Focuses on main question/topic
- 100ms rate limit between generations
- Graceful fallback if OpenAI unavailable

### Rate Limits & Throttling

```typescript
{
  concurrency: {
    limit: 2,                    // Max 2 concurrent syncs per repo
    key: 'event.data.repositoryId',
  },
  retries: 2,                    // Retry failed syncs twice
  throttle: {
    limit: 20,                   // Max 20 syncs per minute globally
    period: '1m',
  },
}
```

## Integration Examples

### Auto-Sync on Page Load

```typescript
// In a React component or route loader
useEffect(() => {
  const syncDiscussions = async () => {
    const { data: repo } = await supabase
      .from('repositories')
      .select('id, has_discussions')
      .eq('owner', owner)
      .eq('name', name)
      .single();

    if (repo?.has_discussions) {
      await inngest.send({
        name: 'capture/repository.discussions',
        data: {
          repositoryId: repo.id,
          maxItems: 50,
        },
      });
    }
  };

  syncDiscussions();
}, [owner, name]);
```

### Scheduled Sync

```typescript
// Create a scheduled function to sync discussions periodically
export const scheduledDiscussionSync = inngest.createFunction(
  {
    id: 'scheduled-discussion-sync',
    name: 'Scheduled Discussion Sync',
  },
  { cron: '0 */12 * * *' }, // Every 12 hours
  async ({ step }) => {
    // Get all repos with discussions enabled
    const { data: repos } = await supabase
      .from('repositories')
      .select('id')
      .eq('has_discussions', true)
      .eq('is_active', true);

    for (const repo of repos || []) {
      await step.sendEvent(`sync-repo-${repo.id}`, {
        name: 'capture/repository.discussions',
        data: {
          repositoryId: repo.id,
          maxItems: 100,
        },
      });
    }

    return { syncedRepos: repos?.length || 0 };
  }
);
```

## Comparison with Manual Script

The Inngest function provides the same functionality as the manual script (`scripts/data-sync/backfill-discussions.mjs`) but with:

✅ **Advantages**:
- Background execution (non-blocking)
- Built-in retry logic
- Rate limiting & throttling
- Automatic sync logging
- Can be triggered from anywhere in the app
- No manual CLI invocation needed

❌ **Manual Script Use Cases**:
- One-time historical backfills
- Testing/debugging
- Local development
- When you need direct control over the process

## Monitoring

### Check Sync Logs

```sql
SELECT * FROM sync_logs
WHERE entity_type = 'repository_discussions'
ORDER BY started_at DESC
LIMIT 10;
```

### View Discussion Stats

```sql
SELECT
  r.owner,
  r.name,
  COUNT(d.id) as discussion_count,
  COUNT(d.summary) as summaries_generated,
  MAX(d.created_at) as latest_discussion
FROM repositories r
LEFT JOIN discussions d ON d.repository_id = r.id
GROUP BY r.id, r.owner, r.name
ORDER BY discussion_count DESC;
```

## Error Handling

The function handles these scenarios:

1. **Repository Not Found**: Throws `NonRetriableError`
2. **Discussions Disabled**: Throws `NonRetriableError`
3. **GraphQL Errors**: Logged and propagated for retry
4. **OpenAI Errors**: Logged but continues without summary
5. **Rate Limits**: Automatically retried by Inngest

## Related Files

- **Function**: `src/lib/inngest/functions/capture-repository-discussions.ts`
- **Export**: `src/lib/inngest/functions/index-without-embeddings.ts`
- **Registration**: `netlify/functions/inngest-unified.mts`
- **Manual Script**: `scripts/data-sync/backfill-discussions.mjs`
- **PR Reference**: #999 (discussion avatars and summaries)
