/**
 * Comment Sync Service
 *
 * Handles automatic syncing of PR and issue comments for workspace repositories.
 * Checks staleness and triggers Inngest events to capture latest comments from GitHub.
 */

import { supabase } from '../supabase';
import { sendInngestEvent } from '../inngest/client-safe';
import { logger } from '../logger';

// Configuration constants
const STALENESS_THRESHOLD_HOURS = 1;
const DEFAULT_SYNC_TIME_RANGE_DAYS = 30;
const ESTIMATED_SYNC_SECONDS_PER_REPO = 5;

export interface CommentSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isStale: boolean;
  estimatedCompletionSeconds: number;
}

export interface CommentSyncResult {
  success: boolean;
  message: string;
  repositoriesSynced: number;
  jobsQueued: number;
}

/**
 * Check if comment data is stale for workspace repositories
 * Data is considered stale if not synced in the last hour
 */
export async function checkCommentStaleness(
  workspaceId: string
): Promise<{ isStale: boolean; lastSyncedAt: Date | null }> {
  try {
    // Get workspace repository IDs
    const { data: workspaceRepos, error: repoError } = await supabase
      .from('workspace_repositories')
      .select('repository_id')
      .eq('workspace_id', workspaceId);

    if (repoError || !workspaceRepos || workspaceRepos.length === 0) {
      return { isStale: false, lastSyncedAt: null };
    }

    const repositoryIds = workspaceRepos.map((wr) => wr.repository_id);

    // Check sync_logs for most recent comment sync
    const { data: syncLogs, error: syncError } = await supabase
      .from('sync_logs')
      .select('completed_at, sync_type')
      .in('repository_id', repositoryIds)
      .in('sync_type', ['pr_comments', 'issue_comments'])
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (syncError) {
      logger.log('[CommentSync] Error checking sync logs: %s', syncError.message);
      return { isStale: true, lastSyncedAt: null };
    }

    if (!syncLogs || syncLogs.length === 0) {
      // No sync logs found - data is definitely stale
      return { isStale: true, lastSyncedAt: null };
    }

    const lastSync = new Date(syncLogs[0].completed_at);
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

    return {
      isStale: hoursSinceSync > STALENESS_THRESHOLD_HOURS,
      lastSyncedAt: lastSync,
    };
  } catch (error) {
    logger.log(
      '[CommentSync] Exception checking staleness: %s',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return { isStale: true, lastSyncedAt: null };
  }
}

/**
 * Trigger comment sync for all repositories in a workspace
 * Only syncs if data is stale to avoid unnecessary API calls
 */
export async function syncWorkspaceComments(
  workspaceId: string,
  forceSync = false
): Promise<CommentSyncResult> {
  try {
    // Check if sync is needed
    if (!forceSync) {
      const { isStale } = await checkCommentStaleness(workspaceId);
      if (!isStale) {
        logger.log('[CommentSync] Data is fresh, skipping sync for workspace %s', workspaceId);
        return {
          success: true,
          message: 'Comment data is fresh (synced within last hour)',
          repositoriesSynced: 0,
          jobsQueued: 0,
        };
      }
    }

    logger.log('[CommentSync] Starting comment sync for workspace %s', workspaceId);

    // Get workspace repositories with activity in last 30 days
    const { data: workspaceRepos, error: repoError } = await supabase
      .from('workspace_repositories')
      .select(
        `
        repository_id,
        repositories!inner(
          id,
          owner,
          name,
          updated_at
        )
      `
      )
      .eq('workspace_id', workspaceId);

    if (repoError || !workspaceRepos || workspaceRepos.length === 0) {
      logger.log('[CommentSync] No repositories found for workspace %s', workspaceId);
      return {
        success: false,
        message: 'No repositories found in workspace',
        repositoriesSynced: 0,
        jobsQueued: 0,
      };
    }

    logger.log('[CommentSync] Found %s repositories to sync', workspaceRepos.length);

    let jobsQueued = 0;
    const syncPromises = [];

    for (const repo of workspaceRepos) {
      const repository = repo.repositories as unknown as {
        id: string;
        owner: string;
        name: string;
        updated_at: string;
      };

      if (!repository) continue;

      // Queue PR comment sync event
      const prCommentPromise = sendInngestEvent({
        name: 'capture/repository.comments.all',
        data: {
          repositoryId: repository.id,
          timeRange: DEFAULT_SYNC_TIME_RANGE_DAYS,
          priority: 'medium',
          triggerSource: 'auto-sync',
        },
      }).then(() => {
        jobsQueued++;
        logger.log(
          '[CommentSync] Queued PR comment sync for %s/%s',
          repository.owner,
          repository.name
        );
      });

      syncPromises.push(prCommentPromise);

      // Queue issue comment sync event via repository issues sync
      // This will discover all issues and their comments
      const issueCommentPromise = sendInngestEvent({
        name: 'capture/repository.issues',
        data: {
          repositoryId: repository.id,
          timeRange: DEFAULT_SYNC_TIME_RANGE_DAYS,
          priority: 'medium',
          triggerSource: 'auto-sync',
        },
      }).then(() => {
        jobsQueued++;
        logger.log(
          '[CommentSync] Queued issue comment sync for %s/%s',
          repository.owner,
          repository.name
        );
      });

      syncPromises.push(issueCommentPromise);
    }

    // Wait for all sync jobs to be queued
    await Promise.all(syncPromises);

    logger.log(
      '[CommentSync] Successfully queued %s jobs for %s repositories',
      jobsQueued,
      workspaceRepos.length
    );

    return {
      success: true,
      message: `Queued ${jobsQueued} comment sync jobs for ${workspaceRepos.length} repositories`,
      repositoriesSynced: workspaceRepos.length,
      jobsQueued,
    };
  } catch (error) {
    logger.log(
      '[CommentSync] Error syncing workspace comments: %s',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      repositoriesSynced: 0,
      jobsQueued: 0,
    };
  }
}

/**
 * Get comment sync status for a workspace
 */
export async function getCommentSyncStatus(workspaceId: string): Promise<CommentSyncStatus> {
  try {
    const stalenessResult = await checkCommentStaleness(workspaceId);

    // Check if there are any active sync jobs
    const { data: workspaceRepos } = await supabase
      .from('workspace_repositories')
      .select('repository_id')
      .eq('workspace_id', workspaceId);

    if (!workspaceRepos || workspaceRepos.length === 0) {
      const status: CommentSyncStatus = {
        isSyncing: false,
        lastSyncedAt: stalenessResult.lastSyncedAt,
        isStale: Boolean(stalenessResult.isStale),
        estimatedCompletionSeconds: 0,
      };
      return status;
    }

    const repositoryIds = workspaceRepos.map((wr) => wr.repository_id);

    // Check for active sync jobs
    const { data: activeSyncs } = await supabase
      .from('sync_logs')
      .select('id, sync_type, started_at')
      .in('repository_id', repositoryIds)
      .in('sync_type', ['pr_comments', 'issue_comments'])
      .eq('status', 'running')
      .limit(1);

    const isSyncing = Boolean(activeSyncs && activeSyncs.length > 0);

    const estimatedCompletionSeconds = isSyncing
      ? workspaceRepos.length * ESTIMATED_SYNC_SECONDS_PER_REPO
      : 0;

    const status: CommentSyncStatus = {
      isSyncing,
      lastSyncedAt: stalenessResult.lastSyncedAt,
      isStale: Boolean(stalenessResult.isStale),
      estimatedCompletionSeconds,
    };
    return status;
  } catch (error) {
    logger.log(
      '[CommentSync] Error getting sync status: %s',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      isSyncing: false,
      lastSyncedAt: null,
      isStale: true,
      estimatedCompletionSeconds: 0,
    };
  }
}
