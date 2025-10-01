# PRD: Webhook Consolidation & Real-time Similarity Search

**Issue:** [#833](https://github.com/bdougie/contributor.info/issues/833)
**Status:** ✅ Completed (Phases 1-5)
**Priority:** HIGH
**Completion Date:** 2025-09-30
**Created:** 2025-09-30

---

## Executive Summary

Consolidate two separate webhook systems (`fly-github-webhooks/` and `app/webhooks/`) into one unified architecture while implementing real-time webhook-driven similarity search. This eliminates code duplication, enables GitHub Check Runs for better UX, and implements phases 1-5 from issue #833.

---

## Problem Statement

### Current Issues

1. **Duplicate Webhook Systems** (70% code overlap)
   - `fly-github-webhooks/` - Express server with Check Runs support
   - `app/webhooks/` - Main handlers with working similarity
   - Different patterns for same operations (repository upserts, contributor tracking)

2. **Disabled Features**
   - Check Runs similarity is disabled: "TODO: Re-enable once issue-similarity service is available"
   - Can't use ML in Fly webhook context
   - No unified embedding generation strategy

3. **On-Demand Similarity Issues** (from #833)
   - Delayed calculations waiting for API calls
   - Incomplete data when rate limited
   - No proactive embedding generation
   - Missing historical context

4. **No Reusability**
   - Each webhook handler duplicates logic
   - No shared services for common operations
   - Hard to maintain consistency

---

## Goals

### Primary Goals
1. **Consolidate** two webhook systems into one unified architecture
2. **Enable** Check Runs with working ML-powered similarity
3. **Implement** webhook-driven similarity search (phases 1-5)
4. **Create** reusable services for all webhook operations
5. **Reduce** codebase by 40-50% through deduplication

### Success Metrics
- ✅ 0 duplicate webhook systems (currently 2)
- ✅ <500ms similarity search with cache hits (currently 2-3s)
- ✅ 100% webhook-driven embedding generation (currently on-demand)
- ✅ 40-50% code reduction in webhook handlers
- ✅ 8+ new reusable service classes
- ✅ Check Runs + Comments dual feedback system

---

## Current State Analysis

### What We Have

**Fly GitHub Webhooks (`fly-github-webhooks/`)**
- ✅ Clean Express server architecture
- ✅ Check Runs API integration (similarity + performance)
- ✅ Good logging and metrics
- ✅ Rate limiting and security
- ❌ Similarity disabled (no ML access)
- ❌ Separate codebase to maintain

**Main App Webhooks (`app/webhooks/`)**
- ✅ Working similarity with embeddings
- ✅ Full ML service access
- ✅ Inngest background jobs
- ✅ Database patterns
- ❌ No Check Runs support
- ❌ Code duplication with Fly

**Existing Services**
- `app/services/similarity.ts` - Working similarity logic
- `app/services/embedding-service.ts` - OpenAI integration with caching
- `app/services/similarity-cache.ts` - LRU cache with database
- Database tables: `similarity_cache`, `embedding_jobs`, `webhook_metrics`

### What's Missing

1. Unified webhook data storage patterns
2. Reusable embedding queue service
3. Check Runs integration in main app
4. Real-time similarity updates
5. Event routing and prioritization
6. Progress tracking for installations
7. Metrics and monitoring services

---

## Solution Architecture

### Phase 0: Consolidation (Foundation)

**Goal:** Merge systems, enable all features everywhere

#### 0.1 Create Shared Services Layer
**Priority:** CRITICAL

**New Files:**
```
app/services/webhook/
  ├── data-service.ts          # Repository/contributor upserts
  ├── embedding-queue.ts       # Unified event queueing
  └── metrics-service.ts       # Performance tracking

app/services/check-runs/
  ├── check-run-manager.ts     # GitHub Check Runs API wrapper
  ├── similarity-check.ts      # Similarity Check Run logic
  └── performance-check.ts     # Performance Check Run logic
```

**WebhookDataService Interface:**
```typescript
class WebhookDataService {
  // Eliminates duplication across handlers
  async ensureRepository(repo: GitHubRepository): Promise<string>
  async upsertContributor(user: GitHubUser): Promise<string>
  async storeIssue(issue: Issue, repoId: string): Promise<string>
  async storePR(pr: PullRequest, repoId: string): Promise<string>
}
```

**EmbeddingQueueService Interface:**
```typescript
class EmbeddingQueueService {
  // Unified event naming and priority handling
  queueIssueEmbedding(issueId: string, priority: Priority): Promise<void>
  queuePREmbedding(prId: string, priority: Priority): Promise<void>
  queueBatchProcessing(repoId: string, items: Item[]): Promise<void>
}
```

**CheckRunManager Interface:**
```typescript
class CheckRunManager {
  // Reusable wrapper for Check Runs API
  async create(params: CheckRunParams): Promise<CheckRun>
  async update(id: number, params: CheckRunUpdate): Promise<void>
  async addAnnotation(id: number, annotation: Annotation): Promise<void>
}
```

**Acceptance Criteria:**
- [ ] WebhookDataService handles all repository/contributor upserts
- [ ] EmbeddingQueueService has consistent event naming
- [ ] CheckRunManager works with GitHub API
- [ ] All services have TypeScript interfaces
- [ ] Unit tests for each service

#### 0.2 Migrate Check Runs to TypeScript
**Priority:** HIGH

**Convert:**
- `fly-github-webhooks/src/handlers/pr-check-runs.js` (413 lines)
- → `app/webhooks/pr-check-runs.ts` (TypeScript, with ML)

**Enable Similarity:**
```typescript
// Before (disabled):
async function findSimilarIssues(...) {
  logger.info('Similarity check temporarily disabled');
  return [];
}

// After (enabled):
import { findSimilarIssues } from '../services/similarity';

async function runSimilarityCheck(...) {
  const similarIssues = await findSimilarIssues(pr, repo, {
    useSemantic: true,
    useCache: true,
    maxResults: 5,
  });
  // ... create Check Run with results
}
```

**Acceptance Criteria:**
- [ ] TypeScript conversion complete
- [ ] Imports `app/services/similarity.ts`
- [ ] Similarity search works in Check Runs
- [ ] Performance check still works
- [ ] Tests pass

#### 0.3 Update Main Webhook Handler
**Priority:** MEDIUM

**Modify:** `app/webhooks/pull-request.ts`

Add Check Runs alongside comments:
```typescript
// Dual feedback system
await Promise.all([
  postPRComment(pr, similarIssues),      // Existing
  createCheckRun(pr, similarIssues),     // NEW
]);
```

**Acceptance Criteria:**
- [ ] PRs get both comments and Check Runs
- [ ] Check Runs show in GitHub PR UI
- [ ] Check Runs update on PR sync
- [ ] No duplicate work

#### 0.4 Delete Fly Webhooks
**Priority:** LOW (last step)

```bash
rm -rf fly-github-webhooks/
```

**Update deployment configs:**
- Remove fly.toml if exists
- Update CI/CD pipelines
- Update environment variables

**Acceptance Criteria:**
- [ ] Fly folder deleted
- [ ] All functionality migrated
- [ ] Tests still pass
- [ ] Deployment works

---

### Phase 1: Webhook-Driven Data Collection

**Goal:** Comprehensive data capture on webhook events

#### 1.1 Refactor Issue Webhook Handler
**File:** `app/webhooks/issues.ts`

**Before:**
```typescript
// 330 lines with duplication
async function handleIssueOpened(event) {
  // Inline repository check
  const { data: repository } = await supabase
    .from('repositories')
    .select('id')
    .eq('github_id', event.repository.id)
    .maybeSingle();

  // Inline contributor upsert
  const { data: contributor } = await supabase
    .from('contributors')
    .upsert({...})

  // Inline issue storage
  const { data: issueData } = await supabase
    .from('issues')
    .upsert({...})

  // Inline embedding trigger
  await inngest.send({
    name: 'github.issue.analyze',
    data: {...}
  });
}
```

**After:**
```typescript
// ~130 lines with services
import { webhookDataService } from '../services/webhook/data-service';
import { embeddingQueueService } from '../services/webhook/embedding-queue';

async function handleIssueOpened(event: IssuesEvent) {
  // Reusable services
  const repoId = await webhookDataService.ensureRepository(event.repository);
  const contributorId = await webhookDataService.upsertContributor(event.issue.user);
  const issueId = await webhookDataService.storeIssue(event.issue, repoId);

  // Unified queueing
  await embeddingQueueService.queueIssueEmbedding(issueId, 'high');
}
```

**Expected Reduction:** 330 → ~130 lines (60% reduction)

**Acceptance Criteria:**
- [ ] Uses WebhookDataService
- [ ] Uses EmbeddingQueueService
- [ ] No inline database operations
- [ ] Tests pass
- [ ] Code is <150 lines

#### 1.2 Refactor PR Webhook Handler
**File:** `app/webhooks/pull-request.ts`

Same pattern as issues, expected reduction: 429 → ~170 lines (60% reduction)

**Acceptance Criteria:**
- [ ] Uses shared services
- [ ] No duplication with issues.ts
- [ ] Tests pass
- [ ] Code is <200 lines

#### 1.3 Add Webhook Metrics
**File:** `app/services/webhook/metrics-service.ts`

Track:
- Processing time per handler
- Database operation latency
- Embedding queue depth
- Error rates

**Acceptance Criteria:**
- [ ] Metrics stored in `webhook_metrics` table
- [ ] Dashboard queries available
- [ ] Performance alerts possible

---

### Phase 2: Background Embedding Processing

**Goal:** Proactive embedding generation with progress tracking

#### 2.1 Extend Inngest Events
**File:** `src/lib/inngest/client.ts`

Add to existing `DataCaptureEvents`:
```typescript
export type WebhookEmbeddingEvents = {
  'embedding/issue.generate': {
    data: {
      issueId: string;
      repositoryId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  'embedding/pr.generate': {
    data: {
      prId: string;
      repositoryId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  'embedding/batch.process': {
    data: {
      installationId: string;
      repositoryId: string;
      items: EmbeddingItem[];
    };
  };
  'embedding/progress.update': {
    data: {
      jobId: string;
      processed: number;
      total: number;
      status: 'processing' | 'completed' | 'failed';
    };
  };
};
```

**Acceptance Criteria:**
- [ ] Events defined in type system
- [ ] Compatible with existing events
- [ ] Documentation added

#### 2.2 Create Batch Processor
**File:** `src/lib/inngest/functions/process-webhook-embeddings.ts`

```typescript
export const processWebhookEmbedding = inngest.createFunction(
  {
    id: 'process-webhook-embedding',
    name: 'Process Webhook-Triggered Embedding',
    concurrency: { limit: 10 },
  },
  { event: 'embedding/issue.generate' },
  async ({ event, step }) => {
    // Use existing embeddingService (already has batch support!)
    const embedding = await step.run('generate-embedding', async () => {
      return await embeddingService.generateEmbedding({
        id: event.data.issueId,
        type: 'issue',
        repositoryId: event.data.repositoryId,
      });
    });

    // Track progress
    await step.run('update-progress', async () => {
      await progressTracker.updateEmbeddingProgress(event.data.jobId);
    });
  }
);
```

**Reuses:**
- ✅ `embeddingService.generateEmbedding()` - existing
- ✅ `similarityCache` - existing
- ✅ `embedding_jobs` table - existing

**Acceptance Criteria:**
- [ ] Processes webhook-triggered embeddings
- [ ] Uses existing embeddingService
- [ ] Tracks progress in database
- [ ] Handles errors gracefully
- [ ] Reports completion

#### 2.3 Add Progress Tracking Service
**File:** `app/services/progress-tracker.ts`

```typescript
export class ProgressTracker {
  async updateInstallationProgress(
    installationId: string,
    progress: { processed: number; total: number }
  ): Promise<void> {
    // Update via Supabase Realtime
    await supabase
      .from('embedding_jobs')
      .update({
        items_processed: progress.processed,
        progress_percentage: (progress.processed / progress.total) * 100,
      })
      .eq('installation_id', installationId);

    // Notify connected clients via realtime
    await this.broadcastProgress(installationId, progress);
  }
}
```

**Acceptance Criteria:**
- [ ] Real-time progress updates
- [ ] Works with Supabase Realtime
- [ ] UI can subscribe to updates
- [ ] Shows in installation flow

---

### Phase 3: Real-time Similarity Updates

**Goal:** Recalculate similarities when data changes

#### 3.1 Create Similarity Updater Service
**File:** `app/services/webhook/similarity-updater.ts`

```typescript
export class WebhookSimilarityService {
  // Recalculate when new issue/PR created
  async recalculateForRepository(repoId: string): Promise<void> {
    const openPRs = await this.getOpenPRs(repoId);

    for (const pr of openPRs) {
      const similarities = await findSimilarIssues(pr, repo, {
        useSemantic: true,
        useCache: true, // Use pre-computed embeddings!
      });

      await this.storeSimilarities(pr.id, similarities);
      await this.notifyUI(pr.id, similarities);
    }
  }

  // Cache-aware recalculation
  async updatePRSimilarities(prId: string): Promise<SimilarIssue[]> {
    // Check cache first
    const cached = await similarityCache.get(prId);
    if (cached && !this.isStale(cached)) {
      return cached;
    }

    // Recalculate with new embeddings
    return await this.calculateAndCache(prId);
  }
}
```

**Acceptance Criteria:**
- [ ] Recalculates on issue created
- [ ] Recalculates on issue edited
- [ ] Uses cached embeddings
- [ ] Invalidates stale cache
- [ ] Notifies UI of updates

#### 3.2 Integrate with Webhook Handlers

**Trigger Points:**
- Issue opened → `webhookSimilarityService.recalculateForRepository()`
- Issue edited → invalidate cache + recalculate
- PR opened → immediate similarity calculation

**Acceptance Criteria:**
- [ ] All trigger points implemented
- [ ] Cache invalidation works
- [ ] Check Runs update with new data
- [ ] No duplicate calculations

---

### Phase 4: Webhook Event Optimization

**Goal:** Smart routing and prioritization

#### 4.1 Create Event Router
**File:** `app/webhooks/event-router.ts`

```typescript
export class EventRouter {
  classifyPriority(event: WebhookEvent): Priority {
    // High priority: New items in active repos
    if (this.isNewItem(event) && this.isActiveRepo(event.repository)) {
      return 'high';
    }

    // Medium priority: Edits, labels
    if (['edited', 'labeled'].includes(event.action)) {
      return 'medium';
    }

    // Low priority: Old item updates
    return 'low';
  }

  shouldDebounce(event: WebhookEvent): boolean {
    // Debounce rapid edits (multiple edits within 5 seconds)
    return this.hasRecentSimilarEvent(event, 5000);
  }

  async routeEvent(event: WebhookEvent): Promise<void> {
    const priority = this.classifyPriority(event);

    if (this.shouldDebounce(event)) {
      await this.queueWithDelay(event, 5000);
    } else {
      await this.processImmediate(event, priority);
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Priority classification works
- [ ] Debouncing prevents spam
- [ ] High priority items process first
- [ ] Low priority batched

#### 4.2 Add Rate Limit Handling

Handle GitHub API rate limits gracefully:
- Detect rate limit errors
- Back off exponentially
- Queue for retry
- Don't lose events

**Acceptance Criteria:**
- [ ] Rate limit detection
- [ ] Exponential backoff
- [ ] Event retry queue
- [ ] No data loss

---

### Phase 5: Monitoring and Analytics

**Goal:** Track performance and accuracy

#### 5.1 Create Metrics Service
**File:** `app/services/webhook-metrics.ts`

Track:
- Processing time per webhook
- Embedding generation time
- Cache hit/miss rates
- Similarity accuracy
- Error rates

Store in existing `webhook_metrics` table.

**Acceptance Criteria:**
- [ ] All metrics tracked
- [ ] Stored in database
- [ ] Query functions available
- [ ] Dashboard queries work

#### 5.2 Add Similarity Accuracy Tracking
**File:** `app/services/similarity-metrics.ts`

Track:
- Which predicted issues were actually linked in PRs
- Precision/recall for similarity predictions
- User feedback on suggestions

**ML Improvement Loop:**
```typescript
async trackPredictionAccuracy(prId: string, predictions: SimilarIssue[]) {
  // Wait for PR to be merged/closed
  const actualLinks = await this.getActualLinkedIssues(prId);

  // Calculate metrics
  const accuracy = this.calculateAccuracy(predictions, actualLinks);
  const precision = this.calculatePrecision(predictions, actualLinks);
  const recall = this.calculateRecall(predictions, actualLinks);

  // Store for analysis
  await this.storeMetrics({ prId, accuracy, precision, recall });
}
```

**Acceptance Criteria:**
- [ ] Tracks prediction vs actual
- [ ] Calculates accuracy metrics
- [ ] Stores for analysis
- [ ] Can improve thresholds

---

## Database Changes

### Phase 0 & 1: Webhook Processing
```sql
-- Add webhook processing flags
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS processed_by_webhook BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS webhook_event_id TEXT;

ALTER TABLE pull_requests
  ADD COLUMN IF NOT EXISTS processed_by_webhook BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS webhook_event_id TEXT;

-- Index for webhook queries
CREATE INDEX IF NOT EXISTS idx_issues_webhook_processed
  ON issues(processed_by_webhook) WHERE processed_by_webhook = FALSE;
```

### Phase 2: Enhanced Embedding Tracking
```sql
-- Add installation tracking to embedding jobs
ALTER TABLE embedding_jobs
  ADD COLUMN IF NOT EXISTS installation_id TEXT,
  ADD COLUMN IF NOT EXISTS triggered_by TEXT CHECK (triggered_by IN ('webhook', 'manual', 'cron')),
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low'));

-- Index for job queries
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_installation
  ON embedding_jobs(installation_id, status);
```

### Phase 5: Performance Monitoring
```sql
-- Add indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_repository_time
  ON webhook_metrics(repository_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_event_type
  ON webhook_metrics(event_type, timestamp DESC);

-- Add similarity accuracy tracking
CREATE TABLE IF NOT EXISTS similarity_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
  predicted_issues JSONB NOT NULL,
  actual_linked_issues JSONB,
  precision FLOAT,
  recall FLOAT,
  accuracy FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  evaluated_at TIMESTAMP WITH TIME ZONE
);
```

---

## File Structure (After Consolidation)

```
app/
  services/
    webhook/
      data-service.ts              ← NEW (Phase 0.1)
      embedding-queue.ts           ← NEW (Phase 0.1)
      similarity-updater.ts        ← NEW (Phase 3.1)
      metrics-service.ts           ← NEW (Phase 5.1)
    check-runs/
      check-run-manager.ts         ← NEW (Phase 0.1)
      similarity-check.ts          ← NEW (Phase 0.2)
      performance-check.ts         ← NEW (Phase 0.2)
    progress-tracker.ts            ← NEW (Phase 2.3)
    event-priority.ts              ← NEW (Phase 4.1)
    similarity-metrics.ts          ← NEW (Phase 5.2)
    similarity.ts                  ✓ EXISTING (reused)
    embedding-service.ts           ✓ EXISTING (reused)
    similarity-cache.ts            ✓ EXISTING (reused)
  webhooks/
    issues.ts                      ✓ REFACTORED (Phase 1.1)
    pull-request.ts                ✓ REFACTORED (Phase 1.2)
    pr-check-runs.ts               ← NEW (Phase 0.2, migrated from Fly)
    event-router.ts                ← NEW (Phase 4.1)

src/lib/inngest/
  functions/
    process-webhook-embeddings.ts  ← NEW (Phase 2.2)

fly-github-webhooks/               ← DELETE (Phase 0.4)
```

---

## Implementation Order

### Week 1: Foundation (Phase 0)
**Days 1-2:**
- [ ] Create WebhookDataService
- [ ] Create EmbeddingQueueService
- [ ] Create CheckRunManager
- [ ] Unit tests for services

**Days 3-4:**
- [ ] Migrate pr-check-runs.js to TypeScript
- [ ] Enable similarity in Check Runs
- [ ] Update pull-request.ts to use Check Runs
- [ ] Integration tests

**Day 5:**
- [ ] Delete fly-github-webhooks/
- [ ] Update deployment configs
- [ ] Verify all features work

### Week 2: Phases 1-5
**Days 1-2: Phase 1**
- [ ] Refactor issues.ts with services
- [ ] Refactor pull-request.ts with services
- [ ] Add webhook metrics
- [ ] Tests

**Days 3-4: Phases 2-3**
- [ ] Create Inngest embedding processor
- [ ] Add progress tracking
- [ ] Create WebhookSimilarityService
- [ ] Tests

**Day 5: Phases 4-5**
- [ ] Create EventRouter
- [ ] Add monitoring/metrics
- [ ] Final tests
- [ ] Documentation

---

## Testing Strategy

### Unit Tests
- All new services (WebhookDataService, EmbeddingQueueService, etc.)
- CheckRunManager API interactions (mocked)
- EventRouter priority logic
- Metrics calculations

### Integration Tests
- End-to-end webhook processing
- Check Runs creation and updates
- Embedding generation pipeline
- Similarity recalculation flow

### Manual Testing
- Install GitHub App on test repo
- Create PR, verify Check Runs appear
- Verify similarity results accurate
- Check progress tracking works
- Monitor performance metrics

---

## Risks and Mitigations

### Risk 1: Breaking Existing Webhooks
**Mitigation:**
- Feature flags for new behavior
- Gradual rollout per repository
- Monitoring and rollback plan

### Risk 2: Performance Degradation
**Mitigation:**
- Load testing before deploy
- Database query optimization
- Cache warming strategies

### Risk 3: API Rate Limits
**Mitigation:**
- Smart priority system
- Debouncing rapid events
- Exponential backoff
- Queue for retry

### Risk 4: Data Migration Issues
**Mitigation:**
- Migrations tested on staging
- Backups before deploy
- Rollback procedures documented

---

## Success Criteria

### Must Have (MVP)
- [ ] Single unified webhook system (0 duplicate systems)
- [ ] Check Runs working with similarity
- [ ] Webhook-driven embeddings (100% coverage)
- [ ] 40% code reduction in handlers
- [ ] <500ms cached similarity searches

### Should Have
- [ ] Real-time similarity updates
- [ ] Progress tracking for installations
- [ ] Event routing and prioritization
- [ ] Comprehensive metrics

### Nice to Have
- [ ] ML accuracy tracking
- [ ] Auto-tuning thresholds
- [ ] Advanced performance analytics

---

## Post-Launch

### Monitoring
- Track similarity search latency
- Monitor cache hit rates
- Watch embedding generation times
- Alert on error rates

### Iteration
- Gather user feedback on Check Runs
- Analyze similarity accuracy metrics
- Optimize slow queries
- Improve ML model based on data

### Documentation
- Update webhook setup docs
- Add Check Runs user guide
- Document new services for developers
- Create architecture diagrams

---

## Questions for Review

1. Should we keep both comments AND Check Runs, or transition to Check Runs only?
2. What's the priority threshold for immediate vs batched processing?
3. Should we support similarity search without GitHub App installed?
4. How long should we cache embeddings before regenerating?
5. What metrics are most important for dashboard?

---

## Appendix

### Related Issues
- #833 - Enhance similarity search with real-time webhook data capture
- #350 - ML-powered similarity service (original implementation)

### References
- GitHub Check Runs API: https://docs.github.com/en/rest/checks/runs
- Existing similarity logic: `app/services/similarity.ts:25-133`
- Embedding service: `app/services/embedding-service.ts:1-335`
- Similarity cache: `app/services/similarity-cache.ts:1-440`
