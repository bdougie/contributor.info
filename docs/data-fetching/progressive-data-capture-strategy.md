# Progressive Data Capture Strategy

## Overview

Instead of trying to fetch all missing data at once (which would trigger rate limits), we implement a progressive queuing system that gradually fills in missing data while respecting GitHub API limits.

## Current State Analysis

### What We Have (Database Cache)
- ✅ 341 PRs for `continuedev/continue`
- ✅ Contributor data with avatars
- ✅ Basic PR metadata (titles, dates, states)

### What's Missing (Critical Gaps)
- ❌ File changes (additions/deletions) - ALL PRs show 0
- ❌ Recent PRs (last 5 days) - Cache is stale
- ❌ PR reviews and comments - Tables empty
- ❌ Recent commits - Integrated with progressive capture
- ❌ Recent activity - No data newer than 6 days

## Progressive Capture Architecture

### 1. Priority-Based Queue System

```typescript
interface DataCaptureJob {
  id: string;
  type: 'pr_details' | 'reviews' | 'comments' | 'commits' | 'recent_prs' | 'commit_pr_check';
  priority: 'critical' | 'high' | 'medium' | 'low';
  repository_id: string;
  resource_id?: string; // PR number, commit SHA, etc.
  estimated_api_calls: number;
  created_at: Date;
  attempts: number;
  max_attempts: number;
  next_retry_at?: Date;
}
```

### 2. Rate Limit Aware Processor

```typescript
class ProgressiveDataCapture {
  private rateLimitBudget: number = 4000; // Leave 1000 calls buffer
  private callsUsedThisHour: number = 0;
  private lastResetTime: Date = new Date();
  
  async processQueue() {
    // Check rate limit budget
    if (this.callsUsedThisHour >= this.rateLimitBudget) {
      console.log('Rate limit budget exhausted, waiting for reset');
      return;
    }
    
    // Process jobs by priority
    const job = await this.getNextJob();
    if (job) {
      await this.processJob(job);
    }
  }
}
```

## Implementation Phases

### Phase 1: Critical Data Recovery (Immediate)
**Goal**: Fix the most visible issues first

**Priority**: 🔴 Critical
**Timeline**: 1-2 days
**API Calls**: ~100-200/hour

1. **Recent PRs** (Last 7 days)
   ```sql
   -- Queue jobs for repositories with stale data
   INSERT INTO data_capture_queue (type, priority, repository_id, estimated_api_calls)
   SELECT 'recent_prs', 'critical', r.id, 10
   FROM repositories r 
   WHERE last_updated_at < NOW() - INTERVAL '3 days';
   ```

2. **File Changes for Popular PRs**
   ```sql
   -- Queue file change updates for PRs with 0 additions/deletions
   INSERT INTO data_capture_queue (type, priority, repository_id, resource_id, estimated_api_calls)
   SELECT 'pr_details', 'critical', pr.repository_id, pr.number::text, 1
   FROM pull_requests pr 
   WHERE pr.additions = 0 AND pr.deletions = 0 
   AND pr.created_at >= NOW() - INTERVAL '30 days'
   ORDER BY pr.created_at DESC 
   LIMIT 100;
   ```

### Phase 2: Historical Data Enrichment (Background)
**Goal**: Fill in missing historical data progressively

**Priority**: 🟡 High
**Timeline**: 1-2 weeks
**API Calls**: ~500/hour during off-peak

1. **PR Reviews**
   ```sql
   -- Queue review fetching for merged PRs
   INSERT INTO data_capture_queue (type, priority, repository_id, resource_id, estimated_api_calls)
   SELECT 'reviews', 'high', pr.repository_id, pr.number::text, 2
   FROM pull_requests pr 
   WHERE pr.merged_at IS NOT NULL 
   AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.pull_request_id = pr.id)
   ORDER BY pr.merged_at DESC;
   ```

2. **PR Comments**
   ```sql
   -- Queue comment fetching for active discussions
   INSERT INTO data_capture_queue (type, priority, repository_id, resource_id, estimated_api_calls)
   SELECT 'comments', 'high', pr.repository_id, pr.number::text, 1
   FROM pull_requests pr 
   WHERE NOT EXISTS (SELECT 1 FROM comments c WHERE c.pull_request_id = pr.id)
   ORDER BY pr.created_at DESC;
   ```

### Phase 2.5: Commit Capture (Integrated)
**Goal**: Enable YOLO coder detection and commit analysis

**Priority**: 🟡 High (Auto-scheduled)
**Timeline**: Immediate (integrated with repository tracking)
**API Calls**: ~10-15/week per repository

**Auto-triggered when**:
- New repository is tracked (initial 7-day capture)
- Daily incremental updates (last 24 hours)
- Bootstrap detects stale commit data

**Features**:
1. **Configurable Time Ranges**
   - Initial capture: 7 days (configurable via `VITE_COMMITS_INITIAL_DAYS`)
   - Incremental updates: 1 day (configurable via `VITE_COMMITS_UPDATE_DAYS`)
   - Maximum commits per run: 1,000 (configurable via `VITE_COMMITS_MAX_PER_RUN`)

2. **Smart API Management**
   - Batch size: 100 commits per API call
   - Max pages: 10 per capture session
   - Automatic commit PR analysis queuing

3. **Database Tracking**
   ```sql
   -- Added to repositories table
   ALTER TABLE repositories ADD COLUMN last_commit_capture_at TIMESTAMPTZ;
   ALTER TABLE repositories ADD COLUMN commit_capture_status TEXT DEFAULT 'pending';
   ```

### Phase 3: Historical Data (Long-term)
**Goal**: Complete historical data for advanced analytics

**Priority**: 🟢 Medium
**Timeline**: 2-4 weeks
**API Calls**: ~1000/hour during maintenance windows

1. **Extended Commit History** (>7 days for active repositories)
2. **Legacy PR Data** (Older repositories without recent activity)

## Queue Management Strategy

### 1. Intelligent Batching
```typescript
// Batch related API calls together
async function batchProcessPRDetails(jobs: DataCaptureJob[]) {
  const prNumbers = jobs.map(job => job.resource_id);
  
  // Fetch multiple PRs in parallel (respecting concurrency limits)
  const results = await Promise.allSettled(
    prNumbers.map(number => 
      fetchPRDetails(repository, number)
        .then(details => updatePRInDatabase(details))
    )
  );
  
  // Update job statuses based on results
  results.forEach((result, index) => {
    const job = jobs[index];
    if (result.status === 'fulfilled') {
      markJobCompleted(job.id);
    } else {
      scheduleRetry(job.id, result.reason);
    }
  });
}
```

### 2. Smart Scheduling
```typescript
// Schedule jobs based on repository activity and user interest
function calculateJobPriority(job: DataCaptureJob): number {
  let score = 0;
  
  // Recently viewed repositories get higher priority
  if (wasRecentlyViewed(job.repository_id)) score += 100;
  
  // Active repositories (recent commits) get higher priority
  if (hasRecentActivity(job.repository_id)) score += 50;
  
  // Fill gaps in popular repositories first
  if (isPopularRepository(job.repository_id)) score += 25;
  
  return score;
}
```

### 3. Rate Limit Management
```typescript
class RateLimitManager {
  private readonly HOURLY_LIMIT = 5000;
  private readonly BUFFER = 1000;
  private readonly BURST_LIMIT = 100; // Max calls per minute
  
  async canMakeRequest(estimatedCalls: number = 1): Promise<boolean> {
    const remaining = await this.getRemainingCalls();
    const isWithinBurstLimit = await this.checkBurstLimit();
    
    return remaining >= (estimatedCalls + this.BUFFER) && isWithinBurstLimit;
  }
  
  async waitForAvailability(): Promise<void> {
    // Exponential backoff when approaching limits
    const remaining = await this.getRemainingCalls();
    if (remaining < 500) {
      const waitTime = Math.min(60000, (500 - remaining) * 100); // Up to 1 minute
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
```

## Database Schema for Queue Management

```sql
-- Create queue table for managing data capture jobs
CREATE TABLE data_capture_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('pr_details', 'reviews', 'comments', 'commits', 'recent_prs', 'commit_pr_check', 'ai_summary', 'issues', 'workspace_issues')),
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    resource_id TEXT, -- PR number, commit SHA, etc.
    estimated_api_calls INTEGER NOT NULL DEFAULT 1,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    
    -- Scheduling
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Error tracking
    last_error TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Prevent duplicate jobs
    CONSTRAINT unique_job_per_resource UNIQUE (type, repository_id, resource_id)
);

-- Indexes for efficient queue processing
CREATE INDEX idx_queue_priority_status ON data_capture_queue(priority, status, next_retry_at);
CREATE INDEX idx_queue_repository ON data_capture_queue(repository_id, status);
CREATE INDEX idx_queue_type_status ON data_capture_queue(type, status);

-- Track rate limit usage
CREATE TABLE rate_limit_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hour_bucket TIMESTAMPTZ NOT NULL, -- Truncated to hour
    calls_made INTEGER NOT NULL DEFAULT 0,
    calls_remaining INTEGER,
    reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_hour_bucket UNIQUE (hour_bucket)
);
```

## Immediate Action Plan

### Step 1: Create Queue Infrastructure (Today)
```sql
-- Apply the queue table migration
-- Set up basic job processing
```

### Step 2: Queue Critical Jobs (Today)
```typescript
// Queue recent PRs for all active repositories
// Queue file changes for visible PRs (last 30 days)
// Start processing immediately
```

### Step 3: Background Processing (This Week)
```typescript
// Set up cron job to process queue every 5 minutes
// Implement rate limit monitoring
// Add retry logic for failed jobs
```

### Step 4: Progressive Enhancement (Ongoing)
```typescript
// Queue reviews and comments for merged PRs
// Queue commit history for active repositories
// Implement smart prioritization based on user activity
```

## Monitoring and Metrics

### Dashboard Metrics
- Queue depth by priority
- Processing rate (jobs/hour)
- API calls remaining
- Data completeness by repository
- Error rates and retry patterns

### Alerts
- Queue backing up (>1000 pending jobs)
- API rate limit approaching (>90% used)
- High error rates (>10% failed jobs)
- Stale data detected (>7 days old)

## Benefits of This Approach

1. **No Service Disruption**: Users see immediate improvements as data fills in
2. **Rate Limit Compliance**: Never exceed GitHub's limits
3. **Intelligent Prioritization**: Most important data gets fixed first
4. **Resilient**: Failed jobs are retried, system recovers from errors
5. **Scalable**: Can handle multiple repositories and data types
6. **Observable**: Clear metrics on progress and health

This progressive approach transforms the "all or nothing" problem into a gradual improvement that respects system constraints while delivering continuous value to users.