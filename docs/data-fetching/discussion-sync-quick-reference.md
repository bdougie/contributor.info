# Discussion Sync Quick Reference

## Files Created/Modified

### New Files
1. **`src/lib/inngest/functions/capture-repository-discussions.ts`**
   - Main Inngest function for discussion sync
   - Mirrors issues/PR sync pattern
   - Includes AI summary generation

2. **`docs/data-fetching/discussion-background-sync.md`**
   - Complete documentation
   - Usage examples
   - Integration patterns

3. **`docs/data-fetching/discussion-sync-quick-reference.md`** (this file)
   - Quick reference for common tasks

### Modified Files
1. **`src/lib/inngest/functions/index-without-embeddings.ts`**
   - Added export for `captureRepositoryDiscussions`

2. **`netlify/functions/inngest-unified.mts`**
   - Imported and registered discussion function
   - Added to function list for introspection

## Quick Usage

### Trigger from Code
```typescript
import { inngest } from '@/lib/inngest/client';

await inngest.send({
  name: 'capture/repository.discussions',
  data: {
    repositoryId: 'uuid',
    maxItems: 100,
  },
});
```

### Trigger via HTTP
```bash
curl -X POST https://app.inngest.com/e/${INNGEST_EVENT_KEY} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "capture/repository.discussions",
    "data": {
      "repositoryId": "uuid",
      "maxItems": 100
    }
  }'
```

## Pattern Comparison

| Feature | Issues | PRs | Discussions |
|---------|--------|-----|-------------|
| **Event** | `capture/repository.issues` | `capture/repository.sync.enhanced` | `capture/repository.discussions` |
| **Function** | `captureRepositoryIssues` | `captureRepositorySyncEnhanced` | `captureRepositoryDiscussions` |
| **API** | REST | GraphQL | GraphQL |
| **AI Summaries** | ❌ | ❌ | ✅ |
| **Author Upsert** | ✅ | ✅ | ✅ |
| **Detail Jobs** | ✅ (comments) | ✅ (reviews/comments) | ❌ (inline) |
| **Concurrency** | 2 per repo | 5 per repo | 2 per repo |
| **Throttle** | 20/min | 75/min | 20/min |

## Key Differences from Manual Script

### Advantages of Inngest Function
- ✅ Background execution (non-blocking)
- ✅ Automatic retries (2x)
- ✅ Built-in rate limiting
- ✅ Sync logging to database
- ✅ Can be triggered from anywhere
- ✅ Integrates with existing sync architecture

### When to Use Manual Script
- One-time historical backfills
- Local development/testing
- Direct CLI control needed
- Debugging specific issues

## Common Patterns

### Auto-Sync on Repository Discovery
```typescript
// In discover-new-repository function
if (githubData.has_discussions) {
  await step.sendEvent('trigger-discussion-sync', {
    name: 'capture/repository.discussions',
    data: {
      repositoryId: repository.id,
      maxItems: 100,
    },
  });
}
```

### Scheduled Daily Sync
```typescript
export const dailyDiscussionSync = inngest.createFunction(
  { id: 'daily-discussion-sync' },
  { cron: '0 2 * * *' }, // 2am daily
  async ({ step }) => {
    const { data: repos } = await supabase
      .from('repositories')
      .select('id')
      .eq('has_discussions', true);

    for (const repo of repos || []) {
      await step.sendEvent(`sync-${repo.id}`, {
        name: 'capture/repository.discussions',
        data: { repositoryId: repo.id, maxItems: 50 },
      });
    }
  }
);
```

### Check Sync Status
```sql
-- View recent discussion syncs
SELECT
  sl.started_at,
  sl.completed_at,
  sl.status,
  sl.records_processed,
  sl.records_inserted,
  sl.github_api_calls_used,
  r.owner,
  r.name
FROM sync_logs sl
JOIN repositories r ON r.id = sl.entity_id
WHERE sl.entity_type = 'repository_discussions'
ORDER BY sl.started_at DESC
LIMIT 20;
```

## Troubleshooting

### Discussion sync fails with "discussions not enabled"
```sql
-- Check if repo has discussions enabled
SELECT owner, name, has_discussions
FROM repositories
WHERE id = 'uuid';

-- Update if needed (from GitHub API data)
UPDATE repositories
SET has_discussions = true
WHERE id = 'uuid';
```

### No AI summaries generated
```bash
# Check OpenAI API key is set
echo $OPENAI_API_KEY

# Summaries fail gracefully - check sync logs
SELECT metadata FROM sync_logs
WHERE entity_type = 'repository_discussions'
ORDER BY started_at DESC
LIMIT 1;
```

### Rate limit issues
```sql
-- Check API usage from sync logs
SELECT
  AVG(github_api_calls_used) as avg_calls,
  MAX(github_api_calls_used) as max_calls,
  COUNT(*) as total_syncs
FROM sync_logs
WHERE entity_type = 'repository_discussions'
AND started_at > NOW() - INTERVAL '1 hour';
```

## Next Steps

1. **Test the function**:
   ```bash
   # Via Inngest dashboard or CLI
   inngest-cli send -e capture/repository.discussions \
     -d '{"repositoryId":"uuid","maxItems":10}'
   ```

2. **Monitor execution**:
   - Check Inngest dashboard for function runs
   - Query `sync_logs` table for results
   - Verify discussions in `discussions` table

3. **Integrate with UI**:
   - Add to repository page for manual trigger
   - Include in auto-discovery flow
   - Schedule for tracked repositories

## Related
- Full docs: `docs/data-fetching/discussion-background-sync.md`
- Manual script: `scripts/data-sync/backfill-discussions.mjs`
- PR reference: #999 (discussion avatars and summaries)
