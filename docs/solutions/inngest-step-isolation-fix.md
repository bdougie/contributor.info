# Inngest Step Isolation Fix Pattern

## Problem
Inngest functions fail with 400 errors when accessing outer scope variables in return statements after extensive step processing.

## Root Cause
Inngest's step execution model maintains a context that can expire or become invalid after multiple steps or long execution time, causing outer scope variables to become inaccessible.

## Solution Pattern

### ❌ BAD: Accessing outer scope in return
```typescript
const computeEmbeddings = inngest.createFunction(
  { /* config */ },
  { event: 'embeddings/compute.requested' },
  async ({ event, step }) => {
    const jobId = await step.run('create-job', async () => {
      // Create job...
      return job.id;
    });

    // ... many other steps ...

    const finalResult = await step.run('finalize-job', async () => {
      // Process final data...
      return {
        processedCount: 100,
        totalCount: 150
      };
    });

    // ❌ THIS FAILS - accessing outer scope variables
    return {
      jobId,  // Fails even though assigned from step
      processed: finalResult.processedCount,
      total: finalResult.totalCount,
    };
  }
);
```

### ✅ GOOD: Return everything from final step
```typescript
const computeEmbeddings = inngest.createFunction(
  { /* config */ },
  { event: 'embeddings/compute.requested' },
  async ({ event, step }) => {
    const jobId = await step.run('create-job', async () => {
      // Create job...
      return job.id;
    });

    // ... many other steps ...

    // ✅ CORRECT - capture and return everything in final step
    const finalReturn = await step.run('finalize-and-return', async () => {
      // Process final data...
      const processedCount = 100;
      const totalCount = 150;
      
      // Return complete response from within the step
      return {
        jobId,  // Capture jobId inside the step
        processed: processedCount,
        total: totalCount,
      };
    });

    // Return the step result directly - no outer scope access
    return finalReturn;
  }
);
```

## Implementation Checklist

When fixing Inngest step isolation issues:

1. **Identify the final return statement**
   - Look for the last `return` in the function
   - Check what variables it's accessing

2. **Check variable sources**
   - Variables from `event.data` - problematic
   - Variables from step results - also problematic after many steps
   - Literals/constants - usually fine

3. **Wrap in final step**
   - Create a step like `finalize-and-return`
   - Move ALL return logic inside this step
   - Capture any needed outer variables inside the step

4. **Return step result directly**
   - The function should just `return finalReturn;`
   - No property access or manipulation

## Common Patterns

### Pattern 1: Early Returns (Usually Safe)
```typescript
if (items.length === 0) {
  // Early returns often work because context hasn't expired yet
  return { message: 'No items to process', jobId };
}
```

### Pattern 2: Long-Running Functions (High Risk)
```typescript
// After processing many items in loops...
for (let i = 0; i < 1000; i += batchSize) {
  await step.run(`process-batch-${i}`, async () => {
    // Heavy processing...
  });
}

// ❌ This return will likely fail
return { processed: count };

// ✅ Wrap in step instead
const result = await step.run('prepare-return', async () => {
  return { processed: count };
});
return result;
```

### Pattern 3: Multiple Data Sources
```typescript
// ✅ Consolidate all data in final step
const finalReturn = await step.run('consolidate-and-return', async () => {
  // Re-fetch or recalculate if needed
  const supabase = getSupabaseClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  return {
    jobId: job.id,
    status: job.status,
    processed: job.items_processed,
    total: job.items_total,
  };
});

return finalReturn;
```

## Testing Strategy

To test if your fix works:

1. **Trigger the function with realistic data**
   - Use production-like payloads
   - Test with large datasets that cause long execution

2. **Check Inngest dashboard**
   - Look for 400 errors
   - Check if function completes successfully

3. **Monitor logs**
   - Add console.log before and after fixes
   - Verify all steps complete

4. **Stress test**
   - Run with maximum expected load
   - Test with concurrent executions

## Related Issues

This pattern affects:
- Long-running batch processors
- Functions with many sequential steps  
- Functions processing large datasets
- Multi-stage workflows

## References
- [Postmortem: Inngest Step Isolation Bug](../postmortems/2025-01-09-inngest-step-isolation-bug.md)
- [Inngest Step Documentation](https://www.inngest.com/docs/functions/steps)
- Fixed in: `supabase/functions/inngest-prod/index.ts` (computeEmbeddings function)