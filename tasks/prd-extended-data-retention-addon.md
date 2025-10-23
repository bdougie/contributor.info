# PRD: Extended Data Retention Addon with Automatic Workspace Backfill

**Status:** In Progress
**Priority:** HIGH
**Issue:** #1153
**Branch:** `feat/workspace-backfill-addon-1153`
**Estimated Completion:** 5-7 days

---

## Project Overview

### Objective
Implement a premium addon system that automatically triggers comprehensive historical data backfill for all workspace repositories when users purchase the Extended Data Retention addon through Polar.

### Business Value
- **Revenue Stream:** $100/month recurring addon revenue
- **User Value:** Access to 365 days of historical data for trend analysis
- **Competitive Advantage:** Comprehensive data retention for workspace analytics
- **Target Market:** Pro and Team tier customers with workspace collaboration needs

### Success Metrics
- Addon purchase conversion rate: Track purchases per active subscription
- Backfill completion rate: >95% successful completion
- User satisfaction: Monitor support tickets and feature feedback
- Performance: Backfill completes within 24 hours for <10 repos, 72 hours for >10 repos

---

## Current State Analysis

### What Exists
1. **WorkspaceBackfillManager.tsx** - Manual 90-day event backfill UI
2. **github-backfill edge function** - Single repository event backfill
3. **HybridQueueManager** - Routes jobs to Inngest or GitHub Actions
4. **Subscription service** - Polar integration with tier management
5. **Progressive capture system** - Handles PR, issue, discussion sync

### What's Missing
1. **Addon detection** - No webhook handler for addon purchases
2. **Workspace-level orchestration** - No service to coordinate multi-repo backfill
3. **Comprehensive data coverage** - Current backfill only handles events (stars/forks)
4. **Progress tracking** - No real-time UI for workspace-wide backfill progress
5. **Database schema** - No tables to track backfill jobs and addon subscriptions
6. **365-day retention** - Current system limited to 30-90 days

### Gaps to Address
- Polar webhook needs addon purchase detection
- Need workspace-level backfill orchestration service
- Database needs backfill job tracking tables
- UI needs real-time progress monitoring
- Progressive capture functions need 365-day support

---

## Technical Architecture

### Component Overview

```
Polar Webhook → Backfill Service → HybridQueueManager → Processors
                      ↓                     ↓               ↓
                  Database            Job Routing    Inngest/Actions
                      ↓                                     ↓
                Progress UI ←────────────────────── Database Updates
```

### Data Flow
1. User purchases addon in Polar → webhook fired
2. Netlify function receives webhook → validates signature
3. WorkspaceBackfillService creates job record
4. Service queues backfill for each repository
5. HybridQueueManager routes to appropriate processor
6. Jobs execute and update progress in database
7. UI subscribes to database changes → real-time updates
8. On completion, user receives notification

---

## Implementation Plan

### Phase 1: Database Foundation ✅ PRIORITY: HIGH

**File:** `supabase/migrations/YYYYMMDD_workspace_backfill_addon.sql`

**Tables:**

1. **workspace_backfill_jobs**
   - Links: workspace_id, subscription_id, addon_product_id
   - Status: pending, in_progress, completed, failed
   - Progress: total_repositories, completed_repositories
   - Retention: retention_days (365)
   - Metadata: error_message, started_at, completed_at

2. **subscription_addons**
   - Links: subscription_id, addon_type, addon_product_id
   - Metadata: retention_days, purchase_date, expiry_date

**Deliverables:**
- ✅ Create migration file with schema
- ✅ Add RLS policies for workspace owners
- ✅ Add indexes for performance
- ✅ Test migration in staging

---

### Phase 2: Polar Integration ✅ PRIORITY: HIGH

**Files:**
- `netlify/functions/polar-webhook.ts`
- `src/services/polar/subscription.service.ts`

**Changes:**

1. **Webhook Handler Enhancement:**
   ```typescript
   onSubscriptionUpdated: async (subscription) => {
     // Detect Extended Data Retention addon
     // Trigger workspace backfill
     // Create subscription_addons record
   }
   ```

2. **Subscription Service Methods:**
   ```typescript
   hasExtendedRetention(userId): Promise<boolean>
   getRetentionDays(userId): Promise<number>
   getActiveAddons(userId): Promise<AddonInfo[]>
   ```

3. **Environment Variable:**
   ```bash
   POLAR_PRODUCT_ID_EXTENDED_RETENTION=65248b4b-20d8-4ad0-95c2-c39f80dc4d18
   ```

**Deliverables:**
- ✅ Add product ID to env vars
- ✅ Update webhook with addon handlers
- ✅ Add addon detection methods
- ✅ Test webhook in staging with test purchase

---

### Phase 3: Backfill Orchestration Service ✅ PRIORITY: HIGH

**File:** `src/services/workspace-backfill.service.ts`

**Core Methods:**
```typescript
class WorkspaceBackfillService {
  async triggerWorkspaceBackfill(workspaceId, retentionDays, addonId)
  async createBackfillJob(workspaceId, retentionDays)
  async processRepositoryBackfill(repoId, retentionDays, jobId)
  async updateJobProgress(jobId, completed, total)
  async handleBackfillError(jobId, repoId, error)
  async retryFailedRepository(jobId, repoId)
}
```

**Responsibilities:**
- Create workspace_backfill_jobs record
- Query all repositories in workspace
- Queue each repository for backfill
- Track overall progress
- Handle errors and retries
- Send completion notifications

**Data Types to Backfill:**
- Pull Requests (365 days)
- Issues (365 days)
- Discussions (365 days)
- PR Reviews & Comments
- Issue Comments
- GitHub Events (90 days max)
- AI Embeddings (all historical content)

**Deliverables:**
- ✅ Implement service class
- ✅ Add error handling and retries
- ✅ Add progress tracking
- ✅ Integrate with HybridQueueManager
- ✅ Add unit tests

---

### Phase 4: Queue Manager Integration ✅ PRIORITY: HIGH

**File:** `src/lib/progressive-capture/hybrid-queue-manager.ts`

**New Method:**
```typescript
async queueWorkspaceBackfill(
  workspaceId: string,
  retentionDays: number,
  jobId: string
): Promise<void>
```

**Routing Strategy:**
- Historical data (>90 days): GitHub Actions
- Medium range (30-90 days): GitHub Actions
- Recent data (<30 days): Inngest
- Embeddings: Inngest (after data capture)

**Deliverables:**
- ✅ Add workspace backfill method
- ✅ Implement routing logic
- ✅ Add priority handling for addon backfills
- ✅ Test with mock workspace

---

### Phase 5: UI Components ✅ PRIORITY: MEDIUM

**Files:**
- `src/components/features/workspace/WorkspaceBackfillProgress.tsx`
- `src/hooks/use-workspace-backfill-status.ts`
- `src/components/features/workspace/settings/WorkspaceSettings.tsx`

**WorkspaceBackfillProgress Component:**
- Overall progress bar (% repos completed)
- Per-repository status cards
- Data breakdown (PRs: 250/500, Issues: 100/150)
- Estimated time remaining
- Error display with retry button
- Real-time updates via Supabase subscriptions

**Hook Features:**
```typescript
const {
  job,
  progress,
  isComplete,
  error,
  retry
} = useWorkspaceBackfillStatus(workspaceId)
```

**Settings Integration:**
- "Data Retention" section
- Show addon status
- Display current backfill progress
- Manual retry option
- Link to purchase addon

**Deliverables:**
- ✅ Create progress component
- ✅ Create status hook
- ✅ Integrate into workspace settings
- ✅ Add Storybook stories
- ✅ Test real-time updates

---

### Phase 6: Progressive Capture Extensions ✅ PRIORITY: MEDIUM

**Files:**
- `src/lib/progressive-capture/historical-pr-sync.js`
- `src/lib/sync-workspace-issues.ts`
- `src/lib/sync-discussions.ts`

**Changes:**
- Add `retentionDays` parameter (default 30, max 365)
- Update date range calculations
- Add progress callbacks
- Handle large pagination

**Example:**
```javascript
export async function syncHistoricalPRs(
  owner,
  repo,
  retentionDays = 30,
  onProgress?: (progress) => void
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  // ... rest of sync logic
}
```

**Deliverables:**
- ✅ Update all sync functions
- ✅ Add 365-day support
- ✅ Add progress callbacks
- ✅ Test with large date ranges

---

### Phase 7: GitHub Actions Workflow ✅ PRIORITY: LOW

**File:** `.github/workflows/workspace-backfill.yml`

**Workflow Inputs:**
- workspace_id
- retention_days (365)
- job_id
- repository_ids (comma-separated)

**Logic:**
- Process repos in parallel (5 concurrent)
- Report progress after each repo
- Handle rate limits
- Retry failed repos
- Update database on completion

**Deliverables:**
- ✅ Create workflow file
- ✅ Add dispatch trigger
- ✅ Implement parallel processing
- ✅ Add rate limit handling
- ✅ Test with test workspace

---

## Acceptance Criteria

### Functional Requirements
- [ ] Addon purchase automatically triggers backfill
- [ ] All workspace repositories backfilled to 365 days
- [ ] Backfill includes: PRs, issues, discussions, comments, reviews, events, embeddings
- [ ] Real-time progress visible in workspace settings
- [ ] Users receive notification on completion
- [ ] Errors handled gracefully with retry option
- [ ] Failed backfills can be retried manually

### Non-Functional Requirements
- [ ] Respects GitHub API rate limits
- [ ] Completes within 24 hours for <10 repos
- [ ] Completes within 72 hours for >10 repos
- [ ] Database tracks all jobs with detailed status
- [ ] Cost-effective routing (GitHub Actions for bulk)
- [ ] No negative impact on existing sync performance

### User Experience
- [ ] Clear progress indicators
- [ ] Estimated time remaining
- [ ] Error messages are actionable
- [ ] Can retry individual failed repos
- [ ] Notifications are subtle and helpful

---

## Risk Assessment

### Technical Risks
1. **GitHub API rate limits** - Mitigation: Use GraphQL, batch requests, queue management
2. **Large data volumes** - Mitigation: Stream processing, chunked requests
3. **Job failures** - Mitigation: Retry logic, error tracking, manual retry UI

### Business Risks
1. **User expectations** - Mitigation: Clear communication about timing
2. **Cost overruns** - Mitigation: Monitor GitHub Actions usage, optimize workflows

---

## Testing Strategy

### Unit Tests
- WorkspaceBackfillService methods
- Webhook handler addon detection
- Progress calculation logic

### Integration Tests
- End-to-end addon purchase flow
- Multi-repository backfill orchestration
- Real-time progress updates

### Load Tests
- Workspace with 20+ repositories
- Concurrent addon purchases
- Rate limit handling

---

## Monitoring & Observability

### Metrics to Track
- Addon purchase events (PostHog)
- Backfill job success/failure rates
- Average completion time per repository
- GitHub API rate limit consumption
- Error types and frequencies

### Alerts
- Backfill job stuck >24 hours
- Error rate >10%
- GitHub API rate limit approaching

---

## Documentation

### User Documentation
**File:** `docs/addons/extended-data-retention.md`
- What is Extended Data Retention?
- How to purchase
- What data is included
- How long backfill takes
- Troubleshooting guide

### Developer Documentation
- Architecture overview
- Database schema
- Webhook integration
- Queue routing logic
- Testing guide

---

## Timeline

- **Day 1-2:** Database schema, environment setup, PRD
- **Day 3:** Webhook handler, subscription service
- **Day 4:** Backfill service, queue integration
- **Day 5:** UI components, hooks
- **Day 6:** Progressive capture extensions, testing
- **Day 7:** GitHub Actions workflow, documentation, final testing

---

## Notes

- Polar product ID: `65248b4b-20d8-4ad0-95c2-c39f80dc4d18`
- Addon price: $100/month
- Retention period: 365 days
- Available tiers: Pro and Team
- Automatic trigger on purchase
- Real-time progress monitoring required
