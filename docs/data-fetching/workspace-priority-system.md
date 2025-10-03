# Workspace Priority System

## Overview

The workspace priority system ensures repositories added to workspaces receive faster data updates than tracked-only repositories. This creates a better user experience for workspace users while maintaining reasonable performance for public repository tracking.

## Priority Levels

| Priority | Score | Use Case | Update Frequency |
|----------|-------|----------|------------------|
| High | 100 | Workspace repositories | ~Daily or on-demand |
| Medium | 50 | Tracked-only repositories | ~Weekly |
| Low | 25 | Background maintenance tasks | As needed |

## Architecture

### Database Schema

**tracked_repositories** table additions:
```sql
-- Workspace detection columns
is_workspace_repo BOOLEAN DEFAULT FALSE
workspace_count INTEGER DEFAULT 0

-- Optimized query index
idx_tracked_repos_workspace_priority ON (is_workspace_repo, priority, tracking_enabled)
```

### Core Components

#### 1. WorkspacePrioritySync Service
**Location**: `src/lib/progressive-capture/workspace-priority-sync.ts`

Manages detection and synchronization of workspace repository priorities:

- `syncAllPriorities()` - Full sync of all repositories
- `markAsWorkspaceRepo(repositoryId)` - Upgrade to high priority
- `markAsTrackedOnly(repositoryId)` - Downgrade to medium priority
- `isInWorkspace(repositoryId)` - Check workspace membership
- `getWorkspaceRepositoryIds()` - List all workspace repos

#### 2. HybridQueueManager Integration
**Location**: `src/lib/progressive-capture/hybrid-queue-manager.ts`

Automatically queries priority when queueing jobs:

```typescript
// Query priority from tracked_repositories
const { data: trackedRepo } = await supabase
  .from('tracked_repositories')
  .select('priority, is_workspace_repo, workspace_count')
  .eq('repository_id', data.repositoryId)
  .maybeSingle();

// Attach metadata to Inngest events
data.metadata = {
  priority: trackedRepo?.priority || 'medium',
  priorityScore: PRIORITY_MAP[trackedRepo?.priority] || 50,
  isWorkspaceRepo: trackedRepo?.is_workspace_repo || false,
  workspaceCount: trackedRepo?.workspace_count || 0,
};
```

#### 3. Background Sync Function
**Location**: `src/lib/inngest/functions/sync-workspace-priorities.ts`

Cron job runs every 6 hours to ensure priorities stay consistent:

```typescript
inngest.createFunction(
  { id: 'sync-workspace-priorities', concurrency: { limit: 1 } },
  [
    { cron: '0 */6 * * *' }, // Every 6 hours
    { event: 'workspace/priorities.sync' }, // Manual trigger
  ],
  async ({ step }) => {
    const syncService = new WorkspacePrioritySync();
    return await step.run('sync-all-priorities', () =>
      syncService.syncAllPriorities()
    );
  }
);
```

#### 4. Workspace Event Hooks
**Location**: `src/services/workspace.service.ts`

Immediate priority updates on workspace changes:

**On Repository Add**:
```typescript
await workspacePrioritySync.markAsWorkspaceRepo(repositoryId);
await inngest.send({
  name: 'workspace/priorities.sync',
  data: { repositoryId, trigger: 'workspace_add' },
});
```

**On Repository Remove**:
```typescript
const stillInWorkspace = await workspacePrioritySync.isInWorkspace(repositoryId);
if (!stillInWorkspace) {
  await workspacePrioritySync.markAsTrackedOnly(repositoryId);
}
```

## How It Works

### 1. Repository Added to Workspace

```
User clicks "Add to Workspace"
    ↓
workspace.service.ts → addRepositoryToWorkspace()
    ↓
WorkspacePrioritySync → markAsWorkspaceRepo()
    ↓
Update: priority='high', is_workspace_repo=true, workspace_count++
    ↓
Inngest event: workspace/priorities.sync (immediate)
    ↓
Future data fetches use priority=100
```

### 2. Repository Removed from Workspace

```
User clicks "Remove from Workspace"
    ↓
workspace.service.ts → removeRepositoryFromWorkspace()
    ↓
WorkspacePrioritySync → isInWorkspace()
    ↓
If not in any workspace:
    ↓
WorkspacePrioritySync → markAsTrackedOnly()
    ↓
Update: priority='medium', is_workspace_repo=false, workspace_count=0
    ↓
Future data fetches use priority=50
```

### 3. Data Sync Jobs

```
HybridQueueManager → queueJob()
    ↓
Query tracked_repositories for priority
    ↓
Attach metadata: { priorityScore, isWorkspaceRepo, workspaceCount }
    ↓
Inngest receives event with priority metadata
    ↓
Jobs process in priority order (high → medium → low)
```

### 4. Background Consistency

```
Every 6 hours (cron: 0 */6 * * *)
    ↓
sync-workspace-priorities function runs
    ↓
WorkspacePrioritySync → syncAllPriorities()
    ↓
Identify all workspace repos from workspace_repositories table
    ↓
Update: priority='high' for workspace repos
    ↓
Update: priority='medium' for tracked-only repos
    ↓
Log: { workspaceRepos, trackedOnlyRepos, priorityChanges }
```

## Error Handling

All priority sync operations are **non-blocking** and **gracefully degrade**:

```typescript
try {
  await workspacePrioritySync.markAsWorkspaceRepo(repositoryId);
} catch (error) {
  // Log error but don't fail the workspace operation
  console.error('Failed to update repository priority:', error);
}
```

This ensures:
- Workspace add/remove operations always succeed
- Priority updates happen when possible
- Failed syncs are retried in background cron job

## Performance Considerations

### Database Queries
- Index on `(is_workspace_repo, priority, tracking_enabled)` optimizes priority lookups
- Single query per job queueing operation
- Batch updates in background sync (every 6 hours)

### Inngest Priority
- Priority metadata passed in event data (no separate routing)
- All functions run on Supabase Edge Functions (150s timeout)
- No additional infrastructure needed

## Monitoring

### Key Metrics to Watch

1. **Priority Distribution**
```sql
SELECT priority, COUNT(*) as count, is_workspace_repo
FROM tracked_repositories
WHERE tracking_enabled = true
GROUP BY priority, is_workspace_repo;
```

2. **Workspace Repository Count**
```sql
SELECT COUNT(*) as total_workspace_repos
FROM tracked_repositories
WHERE is_workspace_repo = true;
```

3. **Priority Sync Results** (Check Inngest logs)
```typescript
{
  workspaceRepos: number,
  trackedOnlyRepos: number,
  priorityChanges: number,
  errors: string[]
}
```

## Manual Operations

### Trigger Immediate Sync
```typescript
await inngest.send({
  name: 'workspace/priorities.sync',
  data: { trigger: 'manual' },
});
```

### Check Repository Priority
```typescript
const prioritySync = new WorkspacePrioritySync();
const priority = await prioritySync.getRepositoryPriority(repositoryId);
console.log(`Repository priority: ${priority}`);
```

### Verify Workspace Membership
```typescript
const prioritySync = new WorkspacePrioritySync();
const isInWorkspace = await prioritySync.isInWorkspace(repositoryId);
console.log(`In workspace: ${isInWorkspace}`);
```

## Related Documentation

- [Manual Repository Tracking](./manual-repository-tracking.md) - User-initiated tracking system
- [Hybrid Queue System](./hybrid-queue-system.md) - Job queueing architecture
- [Inngest Migration](../postmortems/inngest-supabase-migration.md) - Supabase Edge Functions setup
