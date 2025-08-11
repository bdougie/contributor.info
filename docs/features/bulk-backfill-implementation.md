# Bulk Backfill Implementation Guide

## Quick Summary

Add a backfill option to the bulk-add-repos UI that fetches up to 200 PRs from the last 30 days for each repository using Inngest for parallel processing.

## Architecture Decision: Inngest

**Why Inngest over GitHub Actions:**
- Better for long-running jobs (up to 2 hours vs 10 minutes)
- Built-in concurrency management
- Real-time progress monitoring  
- No webhook complexity
- Already integrated in the codebase

## Implementation Steps

### 1. Create Inngest Backfill Function

```typescript
// src/lib/inngest/functions/backfill-initial.ts
export const backfillRepositoryInitial = inngest.createFunction(
  {
    id: "backfill-repository-initial",
    concurrency: {
      limit: 5, // Process 5 repos at once
      scope: "account"
    },
    retries: 3
  },
  { event: "repository/backfill.initial" },
  async ({ event, step }) => {
    const { repositoryId, owner, name, maxPRs = 200 } = event.data;
    
    // Calculate 30-day cutoff
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Step 1: Initialize backfill state
    await step.run("init-backfill", async () => {
      await supabase
        .from('progressive_backfill_state')
        .insert({
          repository_id: repositoryId,
          total_prs: maxPRs,
          processed_prs: 0,
          status: 'active',
          chunk_size: 25,
          metadata: {
            type: 'initial_backfill',
            triggered_from: 'bulk_add_ui'
          }
        });
    });
    
    // Step 2: Fetch PRs in chunks
    let cursor = null;
    let totalFetched = 0;
    const chunkSize = 25;
    let reachedTimeLimit = false;
    
    while (totalFetched < maxPRs && !reachedTimeLimit) {
      const remaining = maxPRs - totalFetched;
      const currentChunkSize = Math.min(chunkSize, remaining);
      
      // Fetch chunk
      const prs = await step.run(`fetch-prs-${totalFetched}`, async () => {
        const client = getGraphQLClient();
        return await client.getRepositoryPRsPage(
          owner,
          name,
          currentChunkSize,
          cursor,
          'DESC'
        );
      });
      
      if (!prs || prs.length === 0) break;
      
      // Filter PRs by 30-day window
      const prsInWindow = prs.filter(pr => {
        const prDate = new Date(pr.createdAt);
        if (prDate < thirtyDaysAgo) {
          reachedTimeLimit = true;
          return false;
        }
        return true;
      });
      
      if (prsInWindow.length === 0) break;
      
      // Store chunk (only PRs in window)
      await step.run(`store-prs-${totalFetched}`, async () => {
        await storePRsInDatabase(repositoryId, prsInWindow);
        return prsInWindow.length;
      });
      
      totalFetched += prsInWindow.length;
      cursor = prs[prs.length - 1]?.cursor;
      
      // Update progress
      await step.run(`update-progress-${totalFetched}`, async () => {
        await supabase
          .from('progressive_backfill_state')
          .update({
            processed_prs: totalFetched,
            last_processed_cursor: cursor,
            last_processed_at: new Date().toISOString()
          })
          .eq('repository_id', repositoryId);
          
        // Send progress update
        await inngest.send({
          name: "backfill/progress.update",
          data: {
            repositoryId,
            progress: totalFetched,
            total: maxPRs,
            status: 'processing'
          }
        });
      });
      
      // Brief pause to respect rate limits
      await step.sleep("rate-limit-pause", "2s");
    }
    
    // Step 3: Complete backfill
    await step.run("complete-backfill", async () => {
      await supabase
        .from('progressive_backfill_state')
        .update({
          status: 'completed',
          processed_prs: totalFetched
        })
        .eq('repository_id', repositoryId);
        
      await inngest.send({
        name: "backfill/progress.update",
        data: {
          repositoryId,
          progress: totalFetched,
          total: maxPRs,
          status: 'completed'
        }
      });
    });
    
    return {
      success: true,
      repository: `${owner}/${name}`,
      prsFetched: totalFetched,
      reachedTimeLimit,
      cutoffDate: thirtyDaysAgo.toISOString()
    };
  }
);
```

### 2. Update Bulk Add UI

```typescript
// src/components/features/debug/bulk-add-repos.tsx
// Add to existing component

import { inngest } from "@/lib/inngest/client";

// Add state
const [includeBackfill, setIncludeBackfill] = useState(true);
const [backfillProgress, setBackfillProgress] = useState<Record<string, number>>({});

// Add after successful repository insertion
if (includeBackfill && result.added.length > 0) {
  // Get repository IDs for the added repos
  const repoDetails = await Promise.all(
    result.added.map(async (repo) => {
      const [owner, name] = repo.split('/');
      const { data } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', name)
        .single();
      return { repo, id: data?.id, owner, name };
    })
  );
  
  // Send backfill events
  const events = repoDetails
    .filter(r => r.id)
    .map(({ id, owner, name, repo }) => ({
      name: "repository/backfill.initial",
      data: {
        repositoryId: id,
        owner,
        name,
        maxPRs: 200
      }
    }));
    
  await inngest.send(events);
  
  // Initialize progress tracking
  const initialProgress = Object.fromEntries(
    result.added.map(repo => [repo, 0])
  );
  setBackfillProgress(initialProgress);
}

// Add UI elements
<div className="mb-4">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={includeBackfill}
      onChange={(e) => setIncludeBackfill(e.target.checked)}
      className="rounded"
    />
    <span className="text-sm">
      Fetch up to 200 PRs from the last 30 days (recommended)
    </span>
  </label>
  {includeBackfill && (
    <div className="text-xs text-muted-foreground mt-1 space-y-1">
      <p>• Fetches PRs created in the last 30 days only</p>
      <p>• Skips PRs already in the database</p>
      <p>• Estimated time: ~2 minutes per repository</p>
    </div>
  )}
</div>
```

### 3. Add Progress Tracking

```typescript
// src/hooks/use-backfill-progress.ts
export function useBackfillProgress(repositoryIds: string[]) {
  const [progress, setProgress] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (repositoryIds.length === 0) return;
    
    // Subscribe to progress updates
    const channel = supabase
      .channel('backfill-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'progressive_backfill_state',
          filter: `repository_id=in.(${repositoryIds.join(',')})`
        },
        (payload) => {
          const { repository_id, processed_prs } = payload.new;
          setProgress(prev => ({
            ...prev,
            [repository_id]: processed_prs
          }));
        }
      )
      .subscribe();
      
    return () => {
      channel.unsubscribe();
    };
  }, [repositoryIds]);
  
  return progress;
}
```

## Testing Plan

### 1. Unit Test - Backfill Function

```typescript
// tests/inngest/backfill-initial.test.ts
describe('backfillRepositoryInitial', () => {
  it('should fetch exactly 200 PRs', async () => {
    const mockPRs = generateMockPRs(250);
    mockGraphQLClient.getRepositoryPRsPage.mockResolvedValue(mockPRs);
    
    const result = await backfillRepositoryInitial.run({
      event: {
        data: {
          repositoryId: 'test-id',
          owner: 'test',
          name: 'repo',
          maxPRs: 200
        }
      }
    });
    
    expect(result.prsFetched).toBe(200);
  });
  
  it('should handle repos with fewer than 200 PRs', async () => {
    const mockPRs = generateMockPRs(50);
    mockGraphQLClient.getRepositoryPRsPage.mockResolvedValue(mockPRs);
    
    const result = await backfillRepositoryInitial.run({
      event: {
        data: {
          repositoryId: 'test-id',
          owner: 'small',
          name: 'repo',
          maxPRs: 200
        }
      }
    });
    
    expect(result.prsFetched).toBe(50);
  });
});
```

### 2. Integration Test - End to End

```typescript
// tests/integration/bulk-backfill.test.ts
it('should add repos and trigger backfill', async () => {
  // Add repositories
  const repos = ['facebook/react', 'vuejs/vue'];
  await addBulkRepos(repos, { includeBackfill: true });
  
  // Wait for Inngest events
  await waitFor(() => {
    expect(inngest.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "repository/backfill.initial"
        })
      ])
    );
  });
  
  // Verify backfill started
  const { data } = await supabase
    .from('progressive_backfill_state')
    .select('*')
    .in('repository_id', repoIds);
    
  expect(data).toHaveLength(2);
  expect(data[0].status).toBe('active');
});
```

### 3. Load Test Script

```bash
#!/bin/bash
# scripts/test/bulk-backfill-load.sh

# Test with 10 repositories
REPOS='[
  "sveltejs/svelte",
  "preactjs/preact", 
  "alpinejs/alpine",
  "solidjs/solid",
  "lit/lit",
  "polymer/polymer",
  "aurelia/framework",
  "emberjs/ember.js",
  "stimulus-use/stimulus-use",
  "hotwired/turbo"
]'

echo "Starting bulk backfill load test..."
echo "Repositories: $REPOS"

# Trigger via API
curl -X POST https://contributor.info/api/bulk-add \
  -H "Content-Type: application/json" \
  -d "{
    \"repositories\": $REPOS,
    \"includeBackfill\": true
  }"

# Monitor Inngest dashboard
echo "Monitor progress at: https://app.inngest.com/env/production/functions"
```

## Monitoring & Debugging

### Check Backfill Status

```sql
-- Real-time backfill progress
SELECT 
  r.owner || '/' || r.name as repository,
  pbs.status,
  pbs.processed_prs || '/200' as progress,
  ROUND(pbs.processed_prs::numeric / 200 * 100, 1) || '%' as percentage,
  pbs.created_at,
  pbs.last_processed_at
FROM progressive_backfill_state pbs
JOIN repositories r ON r.id = pbs.repository_id
WHERE pbs.metadata->>'triggered_from' = 'bulk_add_ui'
ORDER BY pbs.created_at DESC;
```

### Debug Failed Backfills

```typescript
// Check Inngest dashboard for failures
// https://app.inngest.com/env/production/functions/backfill-repository-initial

// Or query directly
const { data: failures } = await supabase
  .from('progressive_backfill_state')
  .select('*')
  .eq('status', 'failed')
  .eq('metadata->triggered_from', 'bulk_add_ui');
```

## Rollout Strategy

### Phase 1: Dev Testing
1. Deploy Inngest function to dev
2. Test with 5 small repositories
3. Verify rate limit compliance
4. Check data integrity

### Phase 2: Production Canary
1. Enable for admin users only
2. Add feature flag: `ENABLE_BULK_BACKFILL`
3. Monitor Inngest dashboard
4. Track success rates

### Phase 3: General Release
1. Enable for all users
2. Add user documentation
3. Monitor for 1 week
4. Optimize based on usage

## Performance Expectations

- **Time per repository**: ~1-2 minutes (depending on PR activity)
- **Concurrent repositories**: 5 (Inngest concurrency limit)
- **Total for 20 repos**: ~8 minutes (4 batches of 5)
- **Rate limit usage**: Up to 200 points per repository
- **Database impact**: Minimal with batched inserts
- **Date limit**: Only fetches PRs from last 30 days
- **Average PRs per repo**: 50-150 (varies by activity level)