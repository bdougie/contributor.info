import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { makeGitHubRequest } from '../github-client';

/**
 * Cron job to keep repository metadata fresh
 *
 * This function:
 * 1. Fetches all active, public repositories
 * 2. Refreshes metadata (stars, forks, issues, watchers) from GitHub REST API
 * 3. Triggers star/fork event capture so the activity feed stays up to date
 *
 * Runs daily at midnight UTC.
 */

interface RepositoryRow {
  id: string;
  owner: string;
  name: string;
}

interface GitHubRepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
}

const BATCH_SIZE = 50;

export const refreshRepositoryMetadataCron = inngest.createFunction(
  {
    id: 'refresh-repository-metadata-cron',
    name: 'Refresh Repository Metadata (Cron)',
    retries: 2,
    concurrency: {
      limit: 1, // Only one instance at a time
    },
  },
  { cron: '0 0 * * *' }, // Run daily at midnight UTC
  async ({ step }) => {
    console.log('[Metadata Cron] Starting repository metadata refresh');

    // Step 1: Get all active public repositories
    const repositories = await step.run('fetch-repositories', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('is_private', false)
        .eq('is_active', true)
        .order('stargazers_count', { ascending: false });

      if (error) {
        console.error('[Metadata Cron] Error fetching repositories: %s', error.message);
        throw new Error(`Failed to fetch repositories: ${error.message}`);
      }

      return (data || []) as RepositoryRow[];
    });

    if (repositories.length === 0) {
      console.log('[Metadata Cron] No active repositories found');
      return {
        success: true,
        repositoriesProcessed: 0,
        message: 'No active repositories to process',
      };
    }

    console.log('[Metadata Cron] Found %d repositories to process', repositories.length);

    // Step 2: Refresh repository metadata from GitHub API so stargazers_count,
    // forks_count, etc. are current — not stale from discovery time
    const refreshBatches = Math.ceil(repositories.length / BATCH_SIZE);
    let totalRefreshed = 0;

    for (let i = 0; i < refreshBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min((i + 1) * BATCH_SIZE, repositories.length);
      const batch = repositories.slice(batchStart, batchEnd);

      const batchRefreshed = await step.run(
        `refresh-metadata-batch-${i}`,
        async (): Promise<{ updated: number }> => {
          let updated = 0;

          for (const repo of batch) {
            try {
              const ghData = await makeGitHubRequest<GitHubRepoResponse>(
                `/repos/${repo.owner}/${repo.name}`
              );

              // Update the repositories table with fresh counts
              const { error } = await supabase
                .from('repositories')
                .update({
                  stargazers_count: ghData.stargazers_count,
                  forks_count: ghData.forks_count,
                  open_issues_count: ghData.open_issues_count,
                  watchers_count: ghData.watchers_count,
                  last_updated_at: new Date().toISOString(),
                })
                .eq('id', repo.id);

              if (error) {
                console.warn(
                  '[Metadata Cron] Failed to update metadata for %s/%s: %s',
                  repo.owner,
                  repo.name,
                  error.message
                );
              } else {
                updated++;
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              console.warn(
                '[Metadata Cron] GitHub API error for %s/%s: %s',
                repo.owner,
                repo.name,
                message
              );
            }
          }

          return { updated };
        }
      );

      totalRefreshed += batchRefreshed.updated;
    }

    console.log(
      '[Metadata Cron] Refreshed metadata for %d/%d repositories',
      totalRefreshed,
      repositories.length
    );

    // Step 3: Trigger star/fork event capture for all active repositories
    // This refreshes the github_events_cache so the activity feed stays up to date
    let eventsTriggered = 0;
    for (const repo of repositories) {
      await step.sendEvent(`repo-events-${eventsTriggered}`, {
        name: 'capture/repository.events',
        data: {
          repositoryId: repo.id,
        },
      });
      eventsTriggered++;
    }

    console.log('[Metadata Cron] Triggered event capture for %d repositories', eventsTriggered);

    return {
      success: true,
      repositoriesProcessed: repositories.length,
      metadataRefreshed: totalRefreshed,
      eventsTriggered,
      completedAt: new Date().toISOString(),
    };
  }
);
