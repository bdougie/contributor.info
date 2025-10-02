# PRD: Priority Queue Phase 2 - Workspace Repository Prioritization

**Issue:** #882
**Status:** In Progress
**Created:** 2025-01-03
**Owner:** Engineering Team

## Project Overview

### Objective
Automatically prioritize workspace repositories in the Inngest job queue to ensure critical user workspaces receive faster data updates than general tracked repositories.

### Background
- **Phase 1 Complete** (PRs #899, #904): Migrated all Inngest functions to Supabase Edge Functions
- All jobs now use 150s timeout on Supabase (no more Netlify routing)
- Current system treats all repositories equally regardless of workspace membership
- Users expect workspace repositories to sync faster since they're paying for workspace features

### Success Metrics
- ✅ Workspace repos process within 2 hours of trigger
- ✅ Tracked-only repos process within 24 hours
- ✅ Zero priority inversions (tracked-only processed before workspace)
- ✅ 95%+ workspace job success rate

## Current State Analysis

### What Works
- ✅ All functions on Supabase Edge (150s timeout)
- ✅ Dual architecture for embeddings (Netlify for Node.js dependencies)
- ✅ `tracked_repositories` table has `priority` enum column
- ✅ Workspace system fully operational with `workspace_repositories` join table

### What's Missing
- ❌ No automatic priority assignment based on workspace membership
- ❌ Priority column not used in job queueing
- ❌ No sync mechanism to update priorities when repos added/removed from workspaces
- ❌ No monitoring of priority-based processing times

### Schema Status
- `tracked_repositories.priority` exists (enum: 'high', 'medium', 'low')
- `workspace_repositories` exists (junction table for workspaces → repos)
- No `is_workspace_repo` flag (need to add)

## Implementation Plan

### Phase 2A: Database Schema (HIGH Priority)

**Goal:** Add workspace detection columns

**Tasks:**
1. Create migration `20250103000000_add_workspace_priority_tracking.sql`
2. Add `is_workspace_repo` boolean to `tracked_repositories`
3. Add `workspace_count` integer (how many workspaces track this repo)
4. Create index: `idx_tracked_repos_workspace_priority`
5. Backfill existing workspace repos

**Migration SQL:**
```sql
-- Add workspace tracking columns
ALTER TABLE tracked_repositories
ADD COLUMN IF NOT EXISTS is_workspace_repo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS workspace_count INTEGER DEFAULT 0;

-- Create performance index
CREATE INDEX IF NOT EXISTS idx_tracked_repos_workspace_priority
ON tracked_repositories(is_workspace_repo, priority, tracking_enabled);

-- Backfill existing workspace repos
UPDATE tracked_repositories tr
SET
  is_workspace_repo = true,
  workspace_count = (
    SELECT COUNT(*)
    FROM workspace_repositories wr
    WHERE wr.repository_id = tr.repository_id
  ),
  priority = 'high'
WHERE repository_id IN (
  SELECT DISTINCT repository_id
  FROM workspace_repositories
);

-- Add comment for documentation
COMMENT ON COLUMN tracked_repositories.is_workspace_repo IS
'True if this repository is tracked by at least one workspace. Auto-synced every 6 hours.';

COMMENT ON COLUMN tracked_repositories.workspace_count IS
'Number of workspaces tracking this repository. Used for priority scoring.';
```

**Acceptance Criteria:**
- ✅ Migration applies cleanly
- ✅ All workspace repos marked `is_workspace_repo=true`
- ✅ `workspace_count` accurate
- ✅ Index improves query performance

### Phase 2B: Priority Sync Service (HIGH Priority)

**Goal:** Auto-detect and sync workspace repository priorities

**New File:** `src/lib/progressive-capture/workspace-priority-sync.ts`

**Interface:**
```typescript
export interface SyncResult {
  workspaceRepos: number;
  trackedOnlyRepos: number;
  priorityChanges: number;
  errors: string[];
}

export interface PriorityUpdate {
  repositoryId: string;
  oldPriority: string;
  newPriority: string;
  isWorkspaceRepo: boolean;
  workspaceCount: number;
}

export class WorkspacePrioritySync {
  /**
   * Main sync - called by cron and on workspace changes
   * Detects all workspace repos and updates priorities
   */
  async syncAllPriorities(): Promise<SyncResult>

  /**
   * Mark repo as workspace-tracked with high priority
   * Called when repo added to workspace
   */
  async markAsWorkspaceRepo(repositoryId: string): Promise<void>

  /**
   * Downgrade repo when removed from all workspaces
   * Called when repo removed from last workspace
   */
  async markAsTrackedOnly(repositoryId: string): Promise<void>

  /**
   * Get all workspace repository IDs from junction table
   */
  async getWorkspaceRepositoryIds(): Promise<string[]>

  /**
   * Check if repo is in any workspace
   */
  async isInWorkspace(repositoryId: string): Promise<boolean>

  /**
   * Get current priority for repository
   */
  async getRepositoryPriority(repositoryId: string): Promise<string>
}
```

**Priority Rules:**
- In ≥1 workspace → `priority='high'`, `is_workspace_repo=true`
- In 0 workspaces → `priority='medium'`, `is_workspace_repo=false`
- Manual override → Respect explicit `priority='high'` even if not in workspace

**Acceptance Criteria:**
- ✅ Sync correctly identifies workspace repos
- ✅ Priority updates persist to database
- ✅ Handles edge cases (repo in multiple workspaces)
- ✅ Logs all priority changes with audit trail

### Phase 2C: Inngest Priority Integration (HIGH Priority)

**Goal:** Pass priority to Inngest when queueing jobs

**Files to Modify:**
1. `src/lib/progressive-capture/hybrid-queue-manager.ts`
2. `src/lib/progressive-capture/queue-manager.ts`
3. `src/lib/inngest/client.ts`

**Changes:**

**1. Query priority before queueing:**
```typescript
// In hybrid-queue-manager.ts queueJob()
const { data: trackedRepo } = await supabase
  .from('tracked_repositories')
  .select('priority, is_workspace_repo, workspace_count')
  .eq('repository_id', data.repositoryId)
  .single();

const priorityScore = trackedRepo?.is_workspace_repo ? 100 : 50;
```

**2. Priority mapping:**
```typescript
const PRIORITY_MAP = {
  'high': 100,      // Workspace repos
  'medium': 50,     // Tracked-only repos
  'low': 25,        // Background tasks
} as const;
```

**3. Pass priority in events:**
```typescript
await inngest.send({
  name: 'capture/repository.sync.graphql',
  data: {
    repositoryId,
    repositoryName,
    priority: priorityScore,
    metadata: {
      isWorkspaceRepo: trackedRepo?.is_workspace_repo,
      workspaceCount: trackedRepo?.workspace_count,
      originalPriority: trackedRepo?.priority
    }
  }
});
```

**Acceptance Criteria:**
- ✅ All Inngest events include priority metadata
- ✅ Workspace repos use priority=100
- ✅ Tracked-only repos use priority=50
- ✅ Priority visible in Inngest dashboard
- ✅ No breaking changes to existing events

### Phase 2D: Background Sync Job (MEDIUM Priority)

**Goal:** Periodic priority synchronization

**New File:** `src/lib/inngest/functions/sync-workspace-priorities.ts`

**Configuration:**
- **Event:** `workspace/priorities.sync`
- **Cron:** `0 */6 * * *` (every 6 hours)
- **Concurrency:** `limit: 1` (prevent concurrent syncs)
- **Retries:** 2

**Implementation:**
```typescript
export const syncWorkspacePriorities = inngest.createFunction(
  {
    id: 'sync-workspace-priorities',
    name: 'Sync Workspace Repository Priorities',
    concurrency: { limit: 1 },
    retries: 2,
  },
  [
    { cron: '0 */6 * * *' },
    { event: 'workspace/priorities.sync' }
  ],
  async ({ step }) => {
    const syncService = new WorkspacePrioritySync();

    const result = await step.run('sync-all-priorities', async () => {
      return await syncService.syncAllPriorities();
    });

    // Log summary
    console.log('Priority sync complete:', {
      workspaceRepos: result.workspaceRepos,
      trackedOnlyRepos: result.trackedOnlyRepos,
      priorityChanges: result.priorityChanges,
      errors: result.errors.length
    });

    return result;
  }
);
```

**Steps:**
1. Get all workspace repository IDs
2. Mark as high priority and workspace repos
3. Get all tracked repos NOT in workspaces
4. Downgrade to medium priority
5. Log priority changes
6. Update telemetry metrics

**Acceptance Criteria:**
- ✅ Runs every 6 hours automatically
- ✅ Can be triggered manually via event
- ✅ Completes within 2 minutes
- ✅ Logs summary of changes
- ✅ Handles errors gracefully

### Phase 2E: Workspace Event Hooks (MEDIUM Priority)

**Goal:** Immediate priority updates on workspace changes

**File to Modify:** `src/services/workspace.service.ts`

**New Hooks:**
```typescript
import { workspacePrioritySync } from '../lib/progressive-capture/workspace-priority-sync';

export class WorkspaceService {
  async addRepositoryToWorkspace(workspaceId: string, repositoryId: string) {
    // ... existing repository add logic ...

    // NEW: Immediately upgrade priority
    try {
      await workspacePrioritySync.markAsWorkspaceRepo(repositoryId);

      // Trigger immediate sync job (async, non-blocking)
      await inngest.send({
        name: 'workspace/priorities.sync',
        data: {
          repositoryId,
          trigger: 'workspace_add',
          workspaceId
        }
      });

      console.log(
        'Upgraded repository priority to high: %s (workspace: %s)',
        repositoryId,
        workspaceId
      );
    } catch (error) {
      // Log but don't fail the workspace operation
      console.error('Failed to update repository priority:', error);
    }
  }

  async removeRepositoryFromWorkspace(workspaceId: string, repositoryId: string) {
    // ... existing repository remove logic ...

    // NEW: Check if still in other workspaces
    try {
      const stillInWorkspace = await workspacePrioritySync.isInWorkspace(repositoryId);

      if (!stillInWorkspace) {
        await workspacePrioritySync.markAsTrackedOnly(repositoryId);

        console.log(
          'Downgraded repository priority to medium: %s (no workspaces)',
          repositoryId
        );
      } else {
        console.log(
          'Repository still in other workspaces: %s',
          repositoryId
        );
      }
    } catch (error) {
      console.error('Failed to downgrade repository priority:', error);
    }
  }
}
```

**Acceptance Criteria:**
- ✅ Priority updates instantly on repo add/remove
- ✅ Handles multi-workspace scenarios correctly
- ✅ No race conditions
- ✅ Workspace operations never fail due to priority sync errors
- ✅ All priority changes logged

### Phase 2F: Monitoring & Telemetry (LOW Priority - Optional)

**Goal:** Track priority-based processing performance

**New File:** `src/lib/progressive-capture/priority-telemetry.ts`

**Metrics to Track:**
- Average processing time by priority
- Queue depth by priority
- Priority inversion events (if any)
- Workspace repo success rate vs tracked-only

**Dashboard Queries:**
```sql
-- Average processing time by priority
SELECT
  priority,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds,
  COUNT(*) as job_count,
  COUNT(*) FILTER (WHERE status = 'completed') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY priority
ORDER BY priority DESC;

-- Priority distribution
SELECT
  is_workspace_repo,
  priority,
  COUNT(*) as count,
  AVG(workspace_count) as avg_workspace_count
FROM tracked_repositories
WHERE tracking_enabled = true
GROUP BY is_workspace_repo, priority
ORDER BY is_workspace_repo DESC, priority DESC;

-- Detect priority inversions (should be zero)
SELECT
  tr.repository_id,
  tr.priority,
  tr.is_workspace_repo,
  COUNT(*) as inversion_count
FROM tracked_repositories tr
WHERE tr.is_workspace_repo = true
  AND tr.priority != 'high'
GROUP BY tr.repository_id, tr.priority, tr.is_workspace_repo;
```

**Acceptance Criteria:**
- ✅ Metrics collected on all job executions
- ✅ Dashboard shows priority performance
- ✅ Alerts on priority inversions (if any occur)

## Technical Guidelines

### Database Best Practices
- Always use transactions for priority updates
- Index all priority-related queries
- Use `FOR UPDATE` locks when checking workspace membership to prevent race conditions

### Error Handling
- Priority sync failures should not block workspace operations
- Log all priority changes for audit trail
- Graceful degradation: default to medium priority on errors

### Testing Strategy
- **Unit tests:** Priority calculation logic
- **Integration tests:** Workspace add/remove flows
- **E2E test:** Verify workspace repo syncs faster than tracked-only

### Performance Considerations
- Batch priority updates when possible (Phase 2D)
- Cache workspace membership checks (5-minute TTL)
- Async priority sync to avoid blocking user actions
- Monitor database query performance with EXPLAIN ANALYZE

## Acceptance Criteria Summary

### Phase 2 Complete When:
- ✅ Database schema supports workspace detection
- ✅ All workspace repos automatically marked high priority
- ✅ Inngest receives priority metadata on all events
- ✅ Background sync runs every 6 hours
- ✅ Workspace add/remove triggers immediate priority update
- ✅ Monitoring shows priority-based performance metrics (optional)
- ✅ Zero manual intervention required
- ✅ 95%+ workspace repo job success rate
- ✅ Build passes with no TypeScript errors

## Out of Scope (Phase 3)

The following features are deferred to Phase 3:
- User-facing priority controls (no UI in Phase 2)
- Gradual rollout configuration (10% → 100%)
- Automatic failover mechanisms
- Per-workspace priority customization
- Rate limiting by priority tier
- Workspace billing tier integration

## Dependencies

### Required
- ✅ Supabase Edge Functions (completed - PR #899)
- ✅ Workspace system (completed)
- ✅ `tracked_repositories.priority` column (exists)

### Optional
- ⚠️ Inngest priority support (need to verify in docs)
- 🔮 Workspace billing tier integration (future)

## Rollout Plan

### Deployment Steps
1. **Phase 2A** - Deploy schema migration (5 min)
2. **Phase 2B** - Deploy priority sync service (15 min)
3. **Phase 2C** - Deploy Inngest integration (20 min)
4. **Monitor 24h** - Verify priority routing works correctly
5. **Phase 2D** - Deploy background sync (10 min)
6. **Phase 2E** - Deploy event hooks (15 min)
7. **Phase 2F** - Deploy monitoring (optional, 30 min)

**Total Implementation Time:** ~2 hours (excluding monitoring)

### Rollback Plan
If issues occur:
1. Revert migration: Set `is_workspace_repo=false` for all repos
2. Remove priority from Inngest event data
3. Disable background sync job
4. All repos fall back to medium priority (current behavior)

## Progress Tracking

### Phase 2A: Database Schema
- [ ] Migration file created
- [ ] Migration applied to development
- [ ] Backfill verified
- [ ] Index performance tested
- [ ] Migration applied to production

### Phase 2B: Priority Sync Service
- [ ] Service class implemented
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] Deployed to development
- [ ] Deployed to production

### Phase 2C: Inngest Integration
- [ ] Priority querying added
- [ ] Events updated with priority
- [ ] Build passing
- [ ] Deployed to development
- [ ] Verified in Inngest dashboard
- [ ] Deployed to production

### Phase 2D: Background Sync Job
- [ ] Function implemented
- [ ] Registered in Inngest
- [ ] Cron schedule configured
- [ ] Manual trigger tested
- [ ] Deployed to production

### Phase 2E: Workspace Event Hooks
- [ ] Hooks implemented
- [ ] Error handling added
- [ ] Tests passing
- [ ] Deployed to production

### Phase 2F: Monitoring (Optional)
- [ ] Telemetry service created
- [ ] Dashboard queries added
- [ ] Metrics validated
- [ ] Deployed to production

## Related Issues & PRs

- **Issue #882:** Re-implement Supabase Edge Functions for Inngest with priority queue system
- **PR #899:** fix: Migrate Inngest to Supabase Edge Functions (Phase 1 ✅)
- **PR #904:** feat: Re-enable embeddings via dual Inngest architecture (Phase 1 ✅)

## Notes

- **2025-01-03:** PRD created, starting Phase 2A implementation
- **Architecture Decision:** All jobs route to Supabase (no Netlify/Supabase split)
- **Priority Mechanism:** Using Inngest priority metadata instead of separate endpoints
