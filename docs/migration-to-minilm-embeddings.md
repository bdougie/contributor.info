# Migration Guide: OpenAI to MiniLM Embeddings

This guide walks through the process of migrating from OpenAI embeddings (1536 dimensions) to MiniLM-L6-v2 embeddings (384 dimensions).

## Overview

The migration replaces expensive OpenAI embeddings with free, open-source MiniLM embeddings that:
- Reduce dimensions from 1536 to 384 (75% reduction)
- Eliminate API costs
- Provide faster embedding generation
- Maintain good semantic similarity performance

## Migration Steps

### 1. Apply the Database Migration

**⚠️ WARNING: This will DELETE all existing embeddings!**

1. Navigate to your Supabase Dashboard
2. Go to the SQL Editor
3. Copy the contents of `supabase/migrations/20250802000001_update_to_minilm_embeddings.sql`
4. Paste and execute the SQL

The migration will:
- Drop existing embedding columns
- Create new 384-dimensional embedding columns
- Update all vector search functions
- Recreate indexes for the new dimensions

### 2. Update Environment Variables

Remove or comment out OpenAI API keys from your `.env` file:
```bash
# OpenAI (optional – still required for GPT-based features)
# VITE_OPENAI_API_KEY=your-openai-api-key
# OPENAI_API_KEY=your-openai-api-key
```

### 3. Regenerate All Embeddings

After applying the migration, run the regeneration script:

```bash
# Make sure you have the required environment variables set
export VITE_SUPABASE_URL=your-supabase-url
export VITE_SUPABASE_ANON_KEY=your-anon-key

# Run the regeneration script
npx tsx scripts/regenerate-embeddings.ts
```

The script will:
- Count all items needing embeddings
- Process them in batches of 100
- Generate MiniLM embeddings for each item
- Store them in the database
- Verify all items have embeddings

### 4. Verify the Migration

After regeneration, verify everything is working:

```bash
# Run tests
npm test

# Check that similarity search works
# Try searching for similar issues in the UI
```

## Rollback Plan

If you need to rollback to OpenAI embeddings:

1. Restore the database from a backup taken before migration
2. Revert the code changes
3. Restore OpenAI API keys in environment variables

## Performance Comparison

| Metric | OpenAI (text-embedding-ada-002) | MiniLM-L6-v2 |
|--------|----------------------------------|--------------|
| Dimensions | 1536 | 384 |
| Cost | ~$0.0001 per 1K tokens | Free |
| Speed | API latency (100-500ms) | Local (10-50ms) |
| Storage | 4x larger | 75% smaller |
| Quality | Excellent | Good |

## Troubleshooting

### "Missing environment variable" errors in tests
- Ensure Supabase is properly mocked in test files
- Check that mocks are defined before imports

### Embeddings not generating
- Verify MiniLM model downloads successfully
- Check console for errors during generation
- Ensure sufficient memory (model requires ~250MB)

### Search quality degraded
- MiniLM may have slightly different semantic understanding
- Consider adjusting similarity thresholds in search functions
- Monitor user feedback and adjust as needed

## Long-term Considerations

1. **Storage Savings**: 75% reduction in vector storage costs
2. **Performance**: Faster embedding generation, no API latency
3. **Offline Capability**: Works without internet connection
4. **Cost Savings**: Eliminates OpenAI API costs for embeddings
5. **Maintenance**: No API key management or rate limiting

## Related Files

- Migration SQL: `supabase/migrations/20250802000001_update_to_minilm_embeddings.sql`
- Embedding Service: `app/services/embeddings.ts`
- Issue Similarity: `app/services/issue-similarity.ts`
- Regeneration Script: `scripts/regenerate-embeddings.ts`
- Tests: `src/app/services/__tests__/embeddings.test.ts`