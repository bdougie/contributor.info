import { inngest } from '../client';
import { supabase } from '../supabase-server';

/**
 * Cron job to periodically sync discussions for repositories with discussions enabled
 * Runs daily to capture new discussions from tracked repositories
 */
export const syncDiscussionsCron = inngest.createFunction(
  {
    id: 'sync-discussions-cron',
    name: 'Sync Discussions (Cron)',
    retries: 1,
  },
  { cron: '0 2 * * *' }, // Run daily at 2 AM UTC
  async ({ step }) => {
    // Step 1: Find all repositories with discussions enabled
    const repositories = await step.run('get-repositories-with-discussions', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('has_discussions', true);

      if (error) {
        console.error('Error fetching repositories with discussions: %s', error.message);
        throw error;
      }

      console.log('Found %d repositories with discussions enabled', data?.length || 0);
      return data || [];
    });

    if (repositories.length === 0) {
      console.log('No repositories with discussions to sync');
      return {
        success: true,
        repositoriesSynced: 0,
        message: 'No repositories with discussions enabled',
      };
    }

    // Step 2: Trigger discussion sync for each repository
    await step.run('send-discussion-sync-events', async () => {
      const events = repositories.map((repo) => ({
        name: 'capture/repository.discussions' as const,
        data: {
          repositoryId: repo.id,
          maxItems: 100,
          source: 'cron',
        },
      }));

      // Send events individually to ensure they're all emitted
      for (const event of events) {
        await inngest.send(event);
      }

      return { eventsSent: events.length };
    });

    console.log('Triggered discussion sync for %d repositories', repositories.length);

    return {
      success: true,
      repositoriesSynced: repositories.length,
      repositories: repositories.map((r) => `${r.owner}/${r.name}`),
    };
  }
);
