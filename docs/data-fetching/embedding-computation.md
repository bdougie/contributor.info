# Embedding Computation System

## Overview

The embedding computation system generates vector embeddings for GitHub issues, pull requests, and discussions to enable semantic similarity search. It uses MiniLM-L6-v2 model (384 dimensions) and runs as a background process via Inngest and Supabase Edge Functions.

## Architecture

### Components

1. **Inngest Scheduler**: Triggers embedding computation every 15 minutes
2. **Supabase Edge Function**: Computes embeddings using the ML model
3. **PostgreSQL pgvector**: Stores 384-dimensional vectors
4. **Similarity Cache**: Caches frequently accessed similarity results

### Data Flow

```
Inngest Cron Job → Edge Function → Fetch Items → Generate Embeddings → Store in DB
     ↓                    ↓                ↓                ↓              ↓
Every 15 min    compute-embeddings   No embedding?    MiniLM model    pgvector
```

## Implementation Details

### Edge Function (`supabase/functions/compute-embeddings/index.ts`)

The main computation logic handles:
- Fetching items without embeddings
- Generating vectors using MiniLM-L6-v2
- Storing embeddings in the database
- Updating similarity cache

Key code structure:
```typescript
// Fetch items needing embeddings
const items = await supabase
  .from(tableName)
  .select('*')
  .is('embedding', null)
  .limit(batchSize);

// Generate embeddings
for (const item of items) {
  const text = `${item.title} ${item.body || ''}`;
  const embedding = await generateEmbedding(text);
  
  // Store in database (CRITICAL: format as string)
  await supabase
    .from(tableName)
    .update({ 
      embedding: `[${embedding.join(',')}]`,  // Must be string format!
      embedding_generated_at: new Date().toISOString()
    })
    .eq('id', item.id);
}
```

### Inngest Function Configuration

Located in `src/lib/inngest/functions/compute-embeddings.ts`:

```typescript
export const computeEmbeddings = inngest.createFunction(
  {
    id: "compute-embeddings",
    name: "Compute Embeddings",
  },
  {
    cron: "*/15 * * * *", // Every 15 minutes
  },
  async ({ event, step }) => {
    // Trigger Supabase edge function
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/compute-embeddings`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          tables: ['github_issues', 'pull_requests', 'discussions']
        })
      }
    );
    
    return { success: true, processed: response.data };
  }
);
```

## Critical Implementation Notes

### 1. String Formatting for pgvector

**CRITICAL**: Embeddings MUST be formatted as strings for pgvector:

❌ **Wrong** (causes silent failures):
```typescript
.update({ embedding: embedding }) // JavaScript array
```

✅ **Correct**:
```typescript
.update({ embedding: `[${embedding.join(',')}]` }) // String format
```

### 2. Authorization Headers

All requests to edge functions require proper authorization:

```typescript
headers: {
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'x-inngest-signature': signature // If using Inngest webhook
}
```

### 3. Debounce Implementation

The PR fixed a critical debounce bug that was causing Promise deadlocks:

```typescript
// Fixed implementation with proper Promise lifecycle
const debouncedSearch = useMemo(() => {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingRejectRef: ((reason?: any) => void) | null = null;
  
  return (item: MyWorkItem) => {
    return new Promise((resolve, reject) => {
      // Clear existing timeout and reject pending promise
      if (timeoutId) {
        clearTimeout(timeoutId);
        if (pendingRejectRef) {
          pendingRejectRef(new Error('Debounced'));
          pendingRejectRef = null;
        }
      }
      
      pendingRejectRef = reject;
      
      timeoutId = setTimeout(async () => {
        pendingRejectRef = null;
        try {
          const result = await performSearch(item);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 300);
    });
  };
}, []);
```

## Database Schema Requirements

### Tables with Embeddings

Each table needs:
- `embedding` column: `vector(384)` type
- `embedding_generated_at` column: `timestamptz` type
- Index for similarity search: `USING ivfflat (embedding vector_cosine_ops)`

Example migration:
```sql
-- Add embedding columns
ALTER TABLE github_issues 
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS idx_github_issues_embedding
ON github_issues USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## Manual Triggering

### Via Script
```bash
# Trigger embedding computation
./scripts/trigger-embeddings.sh

# Or directly with curl
curl -X POST https://your-project.supabase.co/functions/v1/compute-embeddings \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tables": ["github_issues", "pull_requests", "discussions"]}'
```

### Via Inngest Dashboard
1. Go to Inngest dashboard
2. Find `compute-embeddings` function
3. Click "Run" to trigger manually

## Monitoring & Debugging

### Check Embedding Status
```sql
-- Count items without embeddings
SELECT 
  'github_issues' as table_name,
  COUNT(*) as missing_embeddings
FROM github_issues
WHERE embedding IS NULL
UNION ALL
SELECT 
  'pull_requests',
  COUNT(*)
FROM pull_requests
WHERE embedding IS NULL
UNION ALL
SELECT 
  'discussions',
  COUNT(*)
FROM discussions
WHERE embedding IS NULL;
```

### Common Issues & Solutions

#### 1. "No similar items found" in UI
**Cause**: Embeddings not yet generated
**Solution**: Wait 15-30 minutes for background processing or trigger manually

#### 2. 0 embeddings processed despite jobs completing
**Cause**: Incorrect embedding format (JavaScript array vs string)
**Solution**: Ensure embeddings are formatted as strings: `[1,2,3,...]`

#### 3. Authorization errors
**Cause**: Missing or incorrect service role key
**Solution**: 
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in edge functions
- Check Inngest signing keys are configured

#### 4. Debounced search hanging
**Cause**: Promise deadlock in debounce implementation
**Solution**: Use the fixed implementation that properly manages Promise lifecycle

## Performance Considerations

### Batch Processing
- Default batch size: 50 items per run
- Processing time: ~2-5 seconds per item
- Total time per run: ~2-5 minutes

### Resource Usage
- Memory: ~200MB for ML model
- CPU: Moderate (vector operations)
- Network: Minimal (text data only)

### Optimization Tips
1. Process during low-traffic hours
2. Adjust batch size based on workload
3. Use similarity cache for frequent queries
4. Consider dedicated compute resources for large workspaces

## Testing

### Unit Tests
```bash
# Test embedding generation
npm test app/services/__tests__/embeddings.test.ts

# Test similarity search
npm test src/services/__tests__/similarity-search.test.ts
```

### Integration Tests
```bash
# Test edge function
./scripts/test-inngest-sync.sh

# Verify embeddings
psql $DATABASE_URL -c "SELECT COUNT(*) FROM github_issues WHERE embedding IS NOT NULL"
```

## Related Documentation

- [My Work Dashboard](../features/my-work-dashboard.md) - Feature using embeddings
- [Similarity Detection](../features/similarity-detection.md) - Similarity search implementation
- [Migration to MiniLM](../migration-to-minilm-embeddings.md) - Model migration guide
- [Inngest Integration](./inngest-integration.md) - Background job processing