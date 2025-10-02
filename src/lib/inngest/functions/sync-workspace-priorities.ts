/**
 * Background sync job for workspace repository priorities
 * Runs every 6 hours to ensure priorities stay in sync
 */

import { inngest } from '../client';
import { WorkspacePrioritySync } from '../../progressive-capture/workspace-priority-sync';

export const syncWorkspacePriorities = inngest.createFunction(
  {
    id: 'sync-workspace-priorities',
    name: 'Sync Workspace Repository Priorities',
    concurrency: { limit: 1 }, // Prevent concurrent syncs
    retries: 2,
  },
  [
    { cron: '0 */6 * * *' }, // Every 6 hours
    { event: 'workspace/priorities.sync' }, // Manual trigger
  ],
  async ({ step }) => {
    const syncService = new WorkspacePrioritySync();

    // Step 1: Run full priority sync
    const result = await step.run('sync-all-priorities', async () => {
      return await syncService.syncAllPriorities();
    });

    // Step 2: Log summary
    console.log('[WorkspacePrioritySync] Sync complete:', {
      workspaceRepos: result.workspaceRepos,
      trackedOnlyRepos: result.trackedOnlyRepos,
      priorityChanges: result.priorityChanges,
      errors: result.errors.length,
      timestamp: new Date().toISOString(),
    });

    // Step 3: Alert if errors occurred
    if (result.errors.length > 0) {
      console.error('[WorkspacePrioritySync] Sync completed with errors:', {
        errorCount: result.errors.length,
        errors: result.errors,
      });
    }

    // Return result for telemetry
    return {
      success: result.errors.length === 0,
      workspaceRepos: result.workspaceRepos,
      trackedOnlyRepos: result.trackedOnlyRepos,
      priorityChanges: result.priorityChanges,
      errorCount: result.errors.length,
      errors: result.errors,
    };
  }
);
