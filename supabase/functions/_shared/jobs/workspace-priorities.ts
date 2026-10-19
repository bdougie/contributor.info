/**
 * `workspace/priorities.sync`: repositories in a workspace are tracked at
 * high priority, everything else at medium. Ported from the Inngest function
 * `sync-workspace-priorities` (cron every 6 h plus manual trigger).
 */

import type { JobContext, JobPayload, JobResult } from './types.ts';

interface RepoIdRow {
  repository_id: string;
}

export async function syncWorkspacePriorities(
  ctx: JobContext,
  _payload: JobPayload,
): Promise<JobResult> {
  const { supabase } = ctx;
  const errors: string[] = [];
  let changes = 0;

  const { data: workspaceRows, error: wsError } = await supabase
    .from('workspace_repositories')
    .select('repository_id');
  if (wsError) {
    throw new Error(`Failed to list workspace repositories: ${wsError.message}`);
  }
  const workspaceRepoIds = [
    ...new Set(((workspaceRows ?? []) as RepoIdRow[]).map((r) => r.repository_id)),
  ];
  console.log('[priorities] %d workspace repositories', workspaceRepoIds.length);

  if (workspaceRepoIds.length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from('tracked_repositories')
      .update({ is_workspace_repo: true, priority: 'high' })
      .in('repository_id', workspaceRepoIds)
      .select('repository_id');
    if (updateError) {
      errors.push(`Failed to update workspace repos: ${updateError.message}`);
    } else {
      changes += updated?.length ?? 0;
    }

    // workspace_count per repository, one count query each (52 repos today)
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
        .update({ workspace_count: count ?? 0 })
        .eq('repository_id', repoId);
    }
  }

  // Everything not in a workspace goes back to medium
  let downgraded = 0;
  let query = supabase
    .from('tracked_repositories')
    .update({ is_workspace_repo: false, priority: 'medium', workspace_count: 0 })
    .neq('priority', 'medium');
  if (workspaceRepoIds.length > 0) {
    query = query.not('repository_id', 'in', `(${workspaceRepoIds.join(',')})`);
  }
  const { data: downgradedRows, error: downgradeError } = await query.select('repository_id');
  if (downgradeError) {
    errors.push(`Failed to downgrade tracked-only repos: ${downgradeError.message}`);
  } else {
    downgraded = downgradedRows?.length ?? 0;
  }

  const result = {
    success: errors.length === 0,
    workspaceRepos: workspaceRepoIds.length,
    trackedOnlyRepos: downgraded,
    priorityChanges: changes + downgraded,
    errorCount: errors.length,
    errors,
  };
  console.log('[priorities] done: %s', JSON.stringify(result));
  return result;
}
