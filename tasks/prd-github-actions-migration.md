# PRD: GitHub Actions Migration and Large Repository Handling

## Project Overview

### Objective
Migrate GitHub Actions workflows from the `bdougie/jobs` repository to `contributor.info` while implementing a progressive backfill strategy that handles large repositories effectively and provides full observability.

### Background
- Current system has a "black box" issue with GitHub Actions running in a separate repository
- Large repositories like `pytorch/pytorch` are being throttled due to sync restrictions (12-hour minimum between syncs)
- Need to implement 20-30% hybrid capture using GitHub Actions for cost optimization
- Inngest is hitting rate limits and timeouts for large repositories

### Success Metrics
- Zero "black box" failures - 100% observability into all job statuses
- Large repositories (>10k stars) successfully capture data without timeouts
- 20-30% of data capture workload handled by GitHub Actions
- Incremental backfill working for repositories with >1000 PRs
- Cost reduction of 60-85% compared to Inngest-only approach

## Current State Analysis

### Problems Identified

1. **Sync Throttling Issue**
   - 12-hour minimum between syncs for GraphQL
   - Large repos like pytorch/pytorch cannot get frequent updates
   - Error: "Repository was synced X hours ago. Skipping to prevent excessive API usage"

2. **Observability Black Hole**
   - GitHub Actions in separate repository with no status feedback
   - Missing scripts causing workflow failures
   - No unified monitoring across Inngest and GitHub Actions

3. **Large Repository Handling**
   - MAX_PRS_PER_SYNC = 150 (not enough for large repos)
   - Single large sync attempts cause timeouts
   - No incremental backfill mechanism

## Implementation Plan

### Phase 1: GitHub Actions Migration (Days 1-3)

#### 1.1 Create Local Workflow Infrastructure
```bash
# Directory structure
.github/
├── workflows/
│   ├── progressive-backfill.yml          # NEW: Main incremental backfill workflow
│   ├── capture-pr-chunk.yml             # NEW: Captures small chunks of PR data
│   ├── historical-pr-sync-graphql.yml   # Migrated from jobs repo
│   ├── capture-pr-reviews.yml           # Migrated from jobs repo
│   └── capture-pr-comments.yml          # Migrated from jobs repo

scripts/
├── github-actions/
│   ├── progressive-backfill.js          # NEW: Orchestrates incremental capture
│   ├── capture-pr-chunk.js              # NEW: Captures configurable PR chunks
│   ├── lib/
│   │   ├── chunk-calculator.js          # NEW: Calculates optimal chunk sizes
│   │   └── progress-tracker.js          # NEW: Tracks backfill progress
│   └── ... (migrated scripts)
```

#### 1.2 Progressive Backfill Workflow Design

**Key Features:**
- Captures data in small chunks (25-50 PRs at a time)
- Runs on a schedule (every 30 minutes)
- Respects rate limits with built-in throttling
- Tracks progress in database
- Automatically pauses when rate limits are low

```yaml
# .github/workflows/progressive-backfill.yml
name: Progressive Repository Backfill

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:
    inputs:
      repository_id:
        description: 'Repository ID to backfill'
        required: false
      chunk_size:
        description: 'Number of PRs per chunk'
        default: '25'
      
jobs:
  backfill:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Run progressive backfill
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          node scripts/github-actions/progressive-backfill.js \
            --chunk-size=${{ inputs.chunk_size || '25' }} \
            --repository-id=${{ inputs.repository_id || '' }}
```

### Phase 2: Incremental Data Capture System (Days 4-6)

#### 2.1 Database Schema Updates

```sql
-- Track backfill progress for large repositories
CREATE TABLE progressive_backfill_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id),
  total_prs INTEGER NOT NULL,
  processed_prs INTEGER DEFAULT 0,
  last_processed_cursor TEXT,
  last_processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active', -- active, paused, completed
  chunk_size INTEGER DEFAULT 25,
  error_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track individual chunk processing
CREATE TABLE backfill_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id),
  chunk_number INTEGER NOT NULL,
  pr_numbers INTEGER[],
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_backfill_state_repository ON progressive_backfill_state(repository_id);
CREATE INDEX idx_backfill_chunks_status ON backfill_chunks(repository_id, status);
```

#### 2.2 Smart Chunk Calculator

```javascript
// scripts/github-actions/lib/chunk-calculator.js
export class ChunkCalculator {
  constructor(repositoryMetrics) {
    this.repositoryMetrics = repositoryMetrics;
  }

  calculateOptimalChunkSize() {
    const { prCount, avgPrSize, rateLimit } = this.repositoryMetrics;
    
    // Base chunk size
    let chunkSize = 25;
    
    // Adjust based on repository size
    if (prCount > 10000) {
      chunkSize = 10; // Very large repos get smaller chunks
    } else if (prCount > 5000) {
      chunkSize = 15;
    } else if (prCount > 1000) {
      chunkSize = 20;
    }
    
    // Adjust based on rate limit headroom
    if (rateLimit.remaining < 1000) {
      chunkSize = Math.max(5, Math.floor(chunkSize / 2));
    }
    
    // Adjust based on average PR complexity
    if (avgPrSize > 100) { // Large PRs with many files
      chunkSize = Math.max(5, Math.floor(chunkSize * 0.7));
    }
    
    return chunkSize;
  }
  
  calculateProcessingInterval() {
    // Determine how often to process chunks
    const baseInterval = 30; // minutes
    
    if (this.repositoryMetrics.priority === 'high') {
      return 15; // Process high priority repos more frequently
    }
    
    if (this.repositoryMetrics.rateLimit.remaining < 500) {
      return 60; // Slow down when rate limit is low
    }
    
    return baseInterval;
  }
}
```

### Phase 3: Enhanced Monitoring and Observability (Days 7-8)

#### 3.1 Unified Monitoring Dashboard

```typescript
// src/pages/monitor/unified-capture-monitor.tsx
export function UnifiedCaptureMonitor() {
  return (
    <div className="space-y-6">
      {/* Real-time processor status */}
      <ProcessorStatusGrid>
        <InngestProcessorCard />
        <GitHubActionsProcessorCard />
        <HybridRoutingCard showPercentages />
      </ProcessorStatusGrid>
      
      {/* Progressive backfill status */}
      <BackfillProgressSection>
        <ActiveBackfillsTable />
        <BackfillMetricsChart />
        <RateLimitHealthIndicator />
      </BackfillProgressSection>
      
      {/* Job observability */}
      <JobObservabilitySection>
        <ActiveJobsTimeline />
        <FailedJobsAlert />
        <ProcessingMetrics />
      </JobObservabilitySection>
    </div>
  );
}
```

#### 3.2 GitHub Actions Status Webhook

```typescript
// netlify/functions/github-actions-webhook.mts
export default async (request: Request) => {
  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  
  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const payload = JSON.parse(body);
  
  // Handle workflow run events
  if (payload.action === 'completed') {
    const { workflow_run } = payload;
    
    // Update job status in database
    await supabase
      .from('progressive_capture_jobs')
      .update({
        status: workflow_run.conclusion === 'success' ? 'completed' : 'failed',
        completed_at: workflow_run.updated_at,
        metadata: {
          workflow_url: workflow_run.html_url,
          conclusion: workflow_run.conclusion,
          run_number: workflow_run.run_number
        }
      })
      .eq('metadata->workflow_run_id', workflow_run.id);
    
    // Update backfill progress if applicable
    if (workflow_run.name === 'Progressive Repository Backfill') {
      await updateBackfillProgress(workflow_run);
    }
  }
  
  return new Response('OK', { status: 200 });
};
```

### Phase 4: Hybrid Routing Implementation (Days 9-10)

#### 4.1 Enhanced Routing Logic

```typescript
// src/lib/progressive-capture/enhanced-hybrid-router.ts
export class EnhancedHybridRouter {
  private readonly GITHUB_ACTIONS_PERCENTAGE = 0.25; // 25% to GitHub Actions
  
  async routeJob(job: CaptureJob): Promise<ProcessorType> {
    const repository = await this.getRepositoryMetadata(job.repositoryId);
    
    // Always use GitHub Actions for progressive backfill
    if (job.type === 'progressive_backfill') {
      return 'github_actions';
    }
    
    // Large repositories with historical data -> GitHub Actions
    if (repository.prCount > 1000 && job.timeRange > 7) {
      return 'github_actions';
    }
    
    // Repositories currently being backfilled -> Inngest for recent data only
    const backfillState = await this.getBackfillState(job.repositoryId);
    if (backfillState?.status === 'active') {
      return job.timeRange <= 1 ? 'inngest' : 'skip'; // Skip to avoid conflicts
    }
    
    // Random distribution for remaining jobs
    return Math.random() < this.GITHUB_ACTIONS_PERCENTAGE ? 'github_actions' : 'inngest';
  }
  
  async shouldInitiateBackfill(repository: Repository): Promise<boolean> {
    // Check if repository needs backfill
    if (repository.prCount < 100) return false; // Small repos don't need backfill
    
    // Check if already being backfilled
    const existingBackfill = await this.getBackfillState(repository.id);
    if (existingBackfill) return false;
    
    // Check data completeness
    const { count: capturedPRs } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', repository.id);
    
    const completeness = (capturedPRs || 0) / repository.prCount;
    
    // Initiate backfill if less than 80% complete
    return completeness < 0.8;
  }
}
```

#### 4.2 Modified Sync Function

```typescript
// src/lib/inngest/functions/capture-repository-sync-graphql.ts (modified)
export const captureRepositorySyncGraphQL = inngest.createFunction(
  {
    id: "capture-repository-sync-graphql",
    name: "Sync Recent Repository PRs (GraphQL)",
    // ... existing config
  },
  { event: "capture/repository.sync.graphql" },
  async ({ event, step }) => {
    const { repositoryId, days, priority, reason } = event.data;
    
    // Check if repository is being backfilled
    const backfillState = await step.run("check-backfill-state", async () => {
      const { data } = await supabase
        .from('progressive_backfill_state')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('status', 'active')
        .single();
      
      return data;
    });
    
    // If backfill is active, only sync very recent data
    const effectiveDays = backfillState?.status === 'active' ? 1 : Math.min(days || DEFAULT_DAYS_LIMIT, DEFAULT_DAYS_LIMIT);
    
    // Remove the 12-hour sync restriction for repositories being backfilled
    const shouldCheckSyncTime = !backfillState && reason !== 'manual';
    
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, last_updated_at')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`) as NonRetriableError;
      }

      // Modified sync time check
      if (shouldCheckSyncTime && data.last_updated_at) {
        const lastSyncTime = new Date(data.last_updated_at).getTime();
        const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);
        
        if (hoursSinceSync < 12) {
          throw new Error(`Repository ${data.owner}/${data.name} was synced ${Math.round(hoursSinceSync)} hours ago. Skipping to prevent excessive API usage.`) as NonRetriableError;
        }
      }

      return data;
    });
    
    // Check if we should initiate backfill for large repos
    await step.run("check-initiate-backfill", async () => {
      const router = new EnhancedHybridRouter();
      if (await router.shouldInitiateBackfill(repository)) {
        // Queue backfill job
        await supabase
          .from('progressive_capture_jobs')
          .insert({
            job_type: 'progressive_backfill',
            repository_id: repositoryId,
            status: 'pending',
            processor_type: 'github_actions',
            metadata: {
              reason: 'auto_initiated',
              total_prs: repository.prCount
            }
          });
      }
    });
    
    // Continue with regular sync...
  }
);
```

## Rollout Strategy

### Week 1: Migration and Testing
1. Migrate workflows to contributor.info repository
2. Create progressive backfill system
3. Test with small repositories (<100 PRs)

### Week 2: Large Repository Testing
1. Test with medium repositories (100-1000 PRs)
2. Enable progressive backfill for pytorch/pytorch
3. Monitor rate limits and adjust chunk sizes

### Week 3: Full Rollout
1. Enable 25% GitHub Actions routing
2. Activate progressive backfill for all large repositories
3. Monitor costs and performance

## Success Criteria

### Phase 1 Success (Migration)
- [ ] All workflows migrated and functional
- [ ] Zero "black box" failures
- [ ] Webhook integration providing real-time status

### Phase 2 Success (Incremental Capture)
- [ ] Progressive backfill capturing data for pytorch/pytorch
- [ ] No rate limit exhaustion errors
- [ ] Chunk processing completing within 5 minutes

### Phase 3 Success (Monitoring)
- [ ] Unified dashboard showing all job statuses
- [ ] Alert system for failed backfills
- [ ] Cost tracking showing 60%+ reduction

### Phase 4 Success (Hybrid Routing)
- [ ] 25% of jobs routed to GitHub Actions
- [ ] Large repositories no longer hitting sync restrictions
- [ ] Data completeness >95% for all tracked repositories

## Risk Mitigation

### Technical Risks
1. **Rate Limit Exhaustion**
   - Mitigation: Dynamic chunk sizing based on remaining quota
   - Fallback: Pause backfill when limits are low

2. **Workflow Failures**
   - Mitigation: Comprehensive error handling and retries
   - Fallback: Manual intervention tools in monitoring dashboard

3. **Data Consistency**
   - Mitigation: Idempotent operations and deduplication
   - Fallback: Data validation and reconciliation jobs

### Operational Risks
1. **Cost Overruns**
   - Mitigation: Budget alerts and automatic pausing
   - Fallback: Reduce chunk sizes and processing frequency

2. **Performance Degradation**
   - Mitigation: Load balancing and queue management
   - Fallback: Prioritization system for critical repositories

## Future Enhancements

1. **Machine Learning Optimization**
   - Predict optimal chunk sizes based on repository patterns
   - Intelligent scheduling based on API usage patterns

2. **Advanced Caching**
   - Cache frequently accessed PR data
   - Implement incremental updates instead of full refreshes

3. **Multi-Region Processing**
   - Distribute GitHub Actions across regions
   - Reduce latency for global repositories

## Appendix: Key Decisions

### Why Progressive Backfill?
- Large repositories cannot be captured in a single operation
- Incremental approach respects rate limits
- Allows continuous operation without blocking

### Why 25% GitHub Actions?
- Cost optimization while maintaining reliability
- GitHub Actions better for batch operations
- Inngest better for real-time updates

### Why Unified Monitoring?
- Single pane of glass for all operations
- Faster problem detection and resolution
- Better capacity planning