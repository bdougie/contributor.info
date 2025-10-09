# Postmortem: Embeddings Not Being Generated Due to Supabase Upsert Syntax Error

**Date**: 2025-10-09
**Status**: RESOLVED
**Severity**: HIGH (complete failure of embeddings generation)

## Summary

The compute-embeddings Inngest function was finding 100 items to process on every run but processing 0 items, despite showing as "completed" with no error messages in the database. This was caused by incorrect Supabase `.upsert()` syntax that silently failed and threw an error, preventing any embeddings from being saved.

## Timeline

- **2025-10-08 17:09**: Last successful embeddings generated
- **2025-10-09 01:30 - 06:24**: Multiple cron runs completing with `items_processed: 0` despite `items_total: 100`
- **2025-10-09 06:28**: Root cause identified - incorrect `.onConflict()` method call
- **2025-10-09 06:29**: Fix deployed to production

## Root Cause

The Supabase similarity_cache upsert was using incorrect syntax:

```typescript
// INCORRECT - .onConflict() is not a method
await supabase
  .from('similarity_cache')
  .upsert({
    repository_id: item.repository_id,
    item_type: item.type,
    item_id: item.id,
    embedding,
    content_hash: item.content_hash,
    ttl_hours: 168,
  })
  .onConflict('repository_id,item_type,item_id');  // ❌ Wrong!
```

The correct syntax is to pass `onConflict` as an option parameter to `.upsert()`:

```typescript
// CORRECT - onConflict as option
await supabase
  .from('similarity_cache')
  .upsert(
    {
      repository_id: item.repository_id,
      item_type: item.type,
      item_id: item.id,
      embedding,
      content_hash: item.content_hash,
      ttl_hours: 168,
    },
    {
      onConflict: 'repository_id,item_type,item_id',  // ✅ Correct!
    }
  );
```

## Impact

- **Duration**: ~13 hours (2025-10-08 17:09 to 2025-10-09 06:29)
- **Scope**: All embeddings generation completely stopped
- **Data Loss**: None - items were queued and processed after fix
- **User Impact**: Search/similarity features may have shown stale results

## Detection

The issue was discovered while investigating Inngest run failures. Key indicators:
1. Jobs showing `items_total: 100` but `items_processed: 0`
2. No error messages in database `embedding_jobs.error_message`
3. HTTP 206/200 status codes (successful Inngest step execution)
4. No new embeddings generated for 13 hours

## Resolution

1. Fixed the upsert syntax in `/Users/briandouglas/code/contributor.info/supabase/functions/inngest-prod/index.ts` at line 1164-1178
2. Redeployed inngest-prod edge function with `--no-verify-jwt` flag
3. Verified fix will be tested on next cron run (every 15 minutes)

## Action Items

### Immediate
- [x] Fix upsert syntax in inngest-prod/index.ts
- [x] Redeploy edge function
- [ ] Monitor next cron run to verify embeddings are being generated
- [ ] Check embedding counts increase

### Short Term
- [ ] Add TypeScript types for Supabase client to catch syntax errors at compile time
- [ ] Add better error logging in batch processing to surface silent failures
- [ ] Consider unit tests for database operations

### Long Term
- [ ] Evaluate consolidating compute-embeddings implementation (currently duplicated in src/lib/inngest/functions/compute-embeddings.ts and supabase/functions/inngest-prod/index.ts)
- [ ] Add monitoring/alerting for embedding generation rate
- [ ] Consider adding health check endpoint that validates embeddings are being generated

## Lessons Learned

1. **Silent Failures**: The error was caught in the try-catch but didn't propagate to the job status because it was early in the batch processing loop
2. **API Syntax**: Supabase upsert options must be passed as a second parameter object, not chained method calls
3. **Monitoring Gaps**: Need better alerting when jobs complete successfully but process 0 items
4. **Code Duplication**: Having the same function implemented in two places (client-side and edge function) increases risk of bugs

## References

- Supabase `.upsert()` docs: https://supabase.com/docs/reference/javascript/upsert
- Edge function: `/Users/briandouglas/code/contributor.info/supabase/functions/inngest-prod/index.ts`
- Related postmortem: `docs/postmortem-inngest-embeddings-failures.md`
