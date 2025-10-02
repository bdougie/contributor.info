/**
 * Workspace Priority Sync Service
 *
 * Automatically detects and syncs workspace repository priorities
 * to ensure workspace repos receive high priority in job queues.
 */

import { supabase } from '../supabase';

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
  async syncAllPriorities(): Promise<SyncResult> {
    const errors: string[] = [];
    let priorityChanges = 0;

    try {
      // Step 1: Get all workspace repository IDs
      const workspaceRepoIds = await this.getWorkspaceRepositoryIds();
      console.log(
        '[WorkspacePrioritySync] Found %d workspace repositories',
        workspaceRepoIds.length
      );

      // Step 2: Mark workspace repos as high priority and update counts
      if (workspaceRepoIds.length > 0) {
        // First, mark all workspace repos as high priority
        const { data: updated, error: updateError } = await supabase
          .from('tracked_repositories')
          .update({
            is_workspace_repo: true,
            priority: 'high',
          })
          .in('repository_id', workspaceRepoIds)
          .select('repository_id, priority');

        if (updateError) {
          errors.push(`Failed to update workspace repos: ${updateError.message}`);
          console.error('[WorkspacePrioritySync] Error updating workspace repos:', updateError);
        } else {
          priorityChanges += updated?.length || 0;
        }

        // Step 3: Update workspace_count for all workspace repos
        for (const repoId of workspaceRepoIds) {
          const { count, error: countError } = await supabase
            .from('workspace_repositories')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', repoId);

          if (countError) {
            errors.push(`Failed to count workspaces for ${repoId}: ${countError.message}`);
            continue;
          }

          await supabase
            .from('tracked_repositories')
            .update({ workspace_count: count || 0 })
            .eq('repository_id', repoId);
        }
      }

      // Step 4: Get repos NOT in any workspace
      const { data: trackedOnlyRepos, error: trackedError } = await supabase
        .from('tracked_repositories')
        .select('repository_id')
        .not('repository_id', 'in', `(${workspaceRepoIds.join(',') || 'null'})`);

      if (trackedError) {
        errors.push(`Failed to get tracked-only repos: ${trackedError.message}`);
        console.error('[WorkspacePrioritySync] Error getting tracked-only repos:', trackedError);
      }

      // Step 5: Downgrade tracked-only repos to medium priority
      if (trackedOnlyRepos && trackedOnlyRepos.length > 0) {
        const { data: downgraded, error: downgradeError } = await supabase
          .from('tracked_repositories')
          .update({
            is_workspace_repo: false,
            priority: 'medium',
            workspace_count: 0,
          })
          .in(
            'repository_id',
            trackedOnlyRepos.map((r) => r.repository_id)
          )
          .neq('priority', 'medium') // Only count actual changes
          .select('repository_id');

        if (downgradeError) {
          errors.push(`Failed to downgrade tracked-only repos: ${downgradeError.message}`);
          console.error('[WorkspacePrioritySync] Error downgrading repos:', downgradeError);
        } else {
          priorityChanges += downgraded?.length || 0;
        }
      }

      const result: SyncResult = {
        workspaceRepos: workspaceRepoIds.length,
        trackedOnlyRepos: trackedOnlyRepos?.length || 0,
        priorityChanges,
        errors,
      };

      console.log('[WorkspacePrioritySync] Sync complete:', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Sync failed: ${errorMessage}`);
      console.error('[WorkspacePrioritySync] Sync failed:', error);

      return {
        workspaceRepos: 0,
        trackedOnlyRepos: 0,
        priorityChanges: 0,
        errors,
      };
    }
  }

  /**
   * Mark repo as workspace-tracked with high priority
   * Called when repo added to workspace
   */
  async markAsWorkspaceRepo(repositoryId: string): Promise<void> {
    try {
      // Get current workspace count
      const { count, error: countError } = await supabase
        .from('workspace_repositories')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId);

      if (countError) {
        throw new Error(`Failed to count workspaces: ${countError.message}`);
      }

      const { error } = await supabase
        .from('tracked_repositories')
        .update({
          is_workspace_repo: true,
          priority: 'high',
          workspace_count: count || 0,
        })
        .eq('repository_id', repositoryId);

      if (error) {
        throw new Error(`Failed to mark as workspace repo: ${error.message}`);
      }

      console.log(
        '[WorkspacePrioritySync] Marked repo as workspace: %s (count: %d)',
        repositoryId,
        count
      );
    } catch (error) {
      console.error('[WorkspacePrioritySync] Error marking as workspace repo:', error);
      throw error;
    }
  }

  /**
   * Downgrade repo when removed from all workspaces
   * Called when repo removed from last workspace
   */
  async markAsTrackedOnly(repositoryId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tracked_repositories')
        .update({
          is_workspace_repo: false,
          priority: 'medium',
          workspace_count: 0,
        })
        .eq('repository_id', repositoryId);

      if (error) {
        throw new Error(`Failed to mark as tracked-only: ${error.message}`);
      }

      console.log('[WorkspacePrioritySync] Marked repo as tracked-only: %s', repositoryId);
    } catch (error) {
      console.error('[WorkspacePrioritySync] Error marking as tracked-only:', error);
      throw error;
    }
  }

  /**
   * Get all workspace repository IDs from junction table
   */
  async getWorkspaceRepositoryIds(): Promise<string[]> {
    try {
      const { data, error } = await supabase.from('workspace_repositories').select('repository_id');

      if (error) {
        throw new Error(`Failed to get workspace repos: ${error.message}`);
      }

      // Return unique repository IDs
      const uniqueIds = [...new Set(data?.map((r) => r.repository_id) || [])];
      return uniqueIds;
    } catch (error) {
      console.error('[WorkspacePrioritySync] Error getting workspace repo IDs:', error);
      return [];
    }
  }

  /**
   * Check if repo is in any workspace
   */
  async isInWorkspace(repositoryId: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('workspace_repositories')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId);

      if (error) {
        throw new Error(`Failed to check workspace membership: ${error.message}`);
      }

      return (count || 0) > 0;
    } catch (error) {
      console.error('[WorkspacePrioritySync] Error checking workspace membership:', error);
      return false;
    }
  }

  /**
   * Get current priority for repository
   */
  async getRepositoryPriority(repositoryId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('tracked_repositories')
        .select('priority')
        .eq('repository_id', repositoryId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get repository priority: ${error.message}`);
      }

      return data?.priority || 'medium';
    } catch (error) {
      console.error('[WorkspacePrioritySync] Error getting repository priority:', error);
      return 'medium'; // Default fallback
    }
  }
}

// Export singleton instance
export const workspacePrioritySync = new WorkspacePrioritySync();
