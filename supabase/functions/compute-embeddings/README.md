# Compute Embeddings Edge Function

Generates MiniLM embeddings for issues, pull requests, and discussions using the Xenova/all-MiniLM-L6-v2 model running directly in the Deno edge runtime.

## Features

- **Zero API Costs**: Runs MiniLM locally in the edge function
- **384 Dimensions**: Smaller, faster vectors than OpenAI's 1536-dimensional embeddings
- **Batch Processing**: Handles multiple items efficiently
- **Smart Caching**: Stores embeddings in similarity cache for fast access
- **Content Hash Tracking**: Only regenerates when content changes

## Usage

### Direct HTTP Call

```bash
curl -X POST https://your-project.supabase.co/functions/v1/compute-embeddings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryId": "uuid-here",
    "limit": 100,
    "forceRegenerate": false
  }'
```

### Request Parameters

- `repositoryId` (optional): Process only items from this repository
- `itemIds` (optional): Array of specific item IDs to process
- `itemType` (optional): Filter by type: 'issue', 'pull_request', or 'discussion'
- `limit` (optional): Max items to process (default: 100)
- `forceRegenerate` (optional): Regenerate even if embeddings exist (default: false)

### Response

```json
{
  "success": true,
  "message": "Processed 85 of 100 items",
  "processed": 85,
  "total": 100,
  "errors": [] // Optional, only if errors occurred
}
```

## How It Works

1. **Query Database**: Finds items needing embeddings using `items_needing_embeddings` view
2. **Generate Embeddings**: Uses MiniLM model to create 384-dimensional vectors
3. **Store Results**: Updates database with embeddings and content hashes
4. **Cache**: Stores in `similarity_cache` table for fast similarity searches

## Performance

- **Cold Start**: ~2-5 seconds (model loading)
- **Warm Start**: ~50-200ms per item
- **Model Size**: ~100MB cached in edge runtime
- **Memory**: ~200MB when loaded

## Integration

Called automatically by:
- Inngest cron job (every 15 minutes)
- GitHub webhook events (new issues/PRs)
- Manual triggers via API

## Monitoring

Check embedding job status:
```sql
SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 10;
```

Check items needing embeddings:
```sql
SELECT COUNT(*) FROM items_needing_embeddings;
```

## Related Files

- `supabase/functions/_shared/embeddings.ts` - Shared embedding utilities
- `app/services/embeddings.ts` - Node.js embedding service
- `src/lib/inngest/functions/compute-embeddings.ts` - Inngest integration
