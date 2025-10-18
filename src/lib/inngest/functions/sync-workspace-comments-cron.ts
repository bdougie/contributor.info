import { inngest } from '../client';
import { supabase } from '../supabase-server';

/**
 * Cron job to periodically sync comments for workspace repositories
 * Runs every 6 hours to keep Replies tab data fresh without overwhelming the API
 *
 * Strategy:
 * - Targets repositories in active workspaces (has members, recent activity)
 * - Syncs comments from last 7 days to catch recent discussions
 * - Prevents stale comment data that would require manual refresh
 */
export const syncWorkspaceCommentsCron = inngest.createFunction(
  {
    id: 'sync-workspace-comments-cron',
    name: 'Sync Workspace Comments (Cron)',
    retries: 1,
  },
  { cron: '0 */6 * * *' }, // Run every 6 hours
  async ({ step }) => {
    // Step 1: Find all repositories in active workspaces
    const repositories = await step.run('get-workspace-repositories', async () => {
      // Get repositories that:
      // 1. Are in workspaces with members (active workspaces)
      // 2. Have been updated recently (within last 30 days)
      const { data, error } = await supabase
        .from('workspace_repositories')
        .select(
          `
          repository_id,
          repositories!inner(
            id,
            owner,
            name,
            updated_at
          ),
          workspaces!inner(
            id,
            name
          )
        `
        )
        .gte(
          'repositories.updated_at',
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        );

      if (error) {
        console.error('Error fetching workspace repositories: %s', error.message);
        throw error;
      }

      // Deduplicate repositories (a repo can be in multiple workspaces)
      const uniqueRepos = new Map();
      for (const item of data || []) {
        const repo = item.repositories as unknown as {
          id: string;
          owner: string;
          name: string;
          updated_at: string;
        };
        if (repo && !uniqueRepos.has(repo.id)) {
          uniqueRepos.set(repo.id, repo);
        }
      }

      const repos = Array.from(uniqueRepos.values());
      console.log('Found %d unique repositories in active workspaces', repos.length);
      return repos;
    });

    if (repositories.length === 0) {
      console.log('No workspace repositories to sync');
      return {
        success: true,
        repositoriesSynced: 0,
        message: 'No active workspace repositories found',
      };
    }

    // Step 2: Queue comment sync events for each repository
    await step.run('send-comment-sync-events', async () => {
      const events = repositories.map((repo) => ({
        name: 'capture/repository.comments.all' as const,
        data: {
          repositoryId: repo.id,
          timeRange: 7, // Last 7 days
          priority: 'low', // Background sync, not urgent
          triggerSource: 'cron',
        },
      }));

      // Send events individually to ensure they're all emitted
      for (const event of events) {
        await inngest.send(event);
      }

      return { eventsSent: events.length };
    });

    console.log('Triggered comment sync for %d workspace repositories', repositories.length);

    return {
      success: true,
      repositoriesSynced: repositories.length,
      repositories: repositories.map((r) => `${r.owner}/${r.name}`),
    };
  }
);
