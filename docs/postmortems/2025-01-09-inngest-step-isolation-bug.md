# Postmortem: Inngest Embeddings Generation Complete Failure

## Issue Summary
**Duration**: 13+ hours  
**Impact**: All embeddings generation stopped - 0 items processed despite finding 100 items per run  
**Severity**: Critical - Complete feature failure  
**Resolution**: OpenAI API key was missing in Supabase Edge Function secrets

## Timeline
- **2025-01-09 ~16:00 UTC**: Last successful embeddings generated
- **2025-01-09 ~17:00 UTC**: Failures begin silently
- **2025-01-10 05:00 UTC**: Issue discovered during debugging
- **2025-01-10 05:35 UTC**: Multiple code fixes deployed - still failing
- **2025-01-10 05:45 UTC**: Root cause identified - OpenAI API key missing in production
- **2025-01-10 05:46 UTC**: OpenAI API key set in Supabase secrets - RESOLVED

## Root Causes Identified

### 1. ✅ Fixed: Incorrect Supabase Upsert Syntax
```typescript
// WRONG - Chained method
.upsert(data).onConflict('columns')

// CORRECT - Option parameter
.upsert(data, { onConflict: 'columns' })
```

### 2. ✅ Fixed: Step Isolation Variable Reset
- Local `processedCount` variable reset between Inngest steps
- Solution: Created PostgreSQL function `increment_embedding_job_progress()` for atomic DB increments

### 3. ✅ Fixed: Silent Error Swallowing
- Try-catch blocks caught errors without rethrowing
- Solution: Added `throw new Error(errorMsg)` to propagate to Inngest

### 4. ✅ Fixed: Return Statement Scope Access
- Problem: Return statement accessed variables from outer scope
- Solution: Moved all return logic inside final step
- Result: Code fix successful, but didn't resolve the issue

### 5. 🔥 ROOT CAUSE: Missing OpenAI API Key in Production
- Problem: `OPENAI_API_KEY` not set in Supabase Edge Function secrets
- Impact: `process-batch-0` failed immediately when trying to call OpenAI API
- Solution: `supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"`

## Final Resolution

The issue was NOT a code problem but a **configuration problem**. The OpenAI API key was present in the local environment but missing in the Supabase Edge Function production environment.

### Discovery Process
1. Observed `process-batch-0` failing immediately
2. Added extensive debug logging
3. Tested OpenAI API locally - worked perfectly
4. Checked Supabase secrets - key was missing/invalid
5. Set the key: `supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"`

### Verification
```javascript
// Local test confirmed API key worked
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: 'Test embedding generation',
  }),
});
// Result: ✅ Status 200
```

## Why It Took So Long to Find

### Red Herrings
1. **Complex Step Isolation Issues**: Spent hours fixing legitimate but non-critical bugs
2. **Supabase Upsert Syntax**: Real bug, but not the cause of total failure
3. **Variable Scope Problems**: Real issue, fixed, but not the root cause
4. **Database Increment Logic**: Created complex solution for a non-existent problem

### The Real Problem
- **Theory 2 was correct**: OpenAI API key was the issue
- The error logs showed "checking for key" but not "key not found"
- Assumption: If deployment worked, secrets must be configured
- Reality: Secrets need to be manually set in Supabase

## Prevention Measures Implemented

### 1. Environment Variable Validation
Added startup checks in Edge Function:
```typescript
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey || !apiKey.startsWith('sk-')) {
  console.error('⚠️ WARNING: OpenAI API key not properly configured');
}
```

### 2. Deployment Checklist
- [ ] Verify all environment variables match `.env.example`
- [ ] Run `supabase secrets list` to confirm all secrets exist
- [ ] Test API keys with simple curl requests
- [ ] Monitor first execution after deployment

### 3. Configuration Testing Script
Created `test-openai-key.js` to verify API configuration:
```javascript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({ model: 'text-embedding-3-small', input: 'Test' }),
});
console.log('API Key Valid:', response.ok);
```

## Lessons Learned

1. **Check Configuration First**: Before diving into complex code debugging
2. **Verify Production Secrets**: Never assume secrets are set in production
3. **Test External APIs Separately**: Isolate API issues from application logic
4. **Add Explicit Secret Validation**: Fail fast with clear error messages
5. **Document Deployment Requirements**: Include secret configuration in deployment docs

### Code Issues Fixed Along the Way
- ✅ Inngest step isolation handled correctly
- ✅ Supabase upsert syntax corrected
- ✅ Error propagation improved
- ✅ Database increment function created (though not needed for this issue)

## Action Items

- [x] Set OpenAI API key in Supabase secrets
- [x] Add debug logging to identify failure points
- [x] Create test script for API key validation
- [ ] Add startup validation for all required secrets
- [ ] Create deployment documentation with secret requirements
- [ ] Set up monitoring alerts for 0% success rates
- [ ] Add health check endpoint for secret validation
- [ ] Document all required environment variables

## Impact Analysis

- **13+ hours of downtime** for embeddings generation
- **~1,300 items** pending embeddings (100 items × 13 hours)
- **4+ hours** of engineering time debugging code issues
- **5 minutes** to fix once root cause identified

## Conclusion

A missing environment variable caused 13 hours of downtime. The debugging process uncovered and fixed several legitimate code issues, but the root cause was a simple configuration problem. This highlights the importance of checking basic configuration before diving into complex debugging.