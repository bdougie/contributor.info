import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { makeGitHubRequest } from '../github-client';

/**
 * Cron job to capture repository metrics for trending detection
 *
 * This function:
 * 1. Fetches all active, public repositories
 * 2. Refreshes metadata (stars, forks, issues, watchers) from GitHub REST API
 * 3. Captures current metrics into repository_metrics_history table
 * 4. The database trigger automatically marks significant changes
 *
 * Runs daily at midnight UTC to capture metrics for trending detection.
 */

interface RepositoryMetrics {
  id: string;
  owner: string;
  name: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
}

interface MetricCapture {
  repository_id: string;
  metric_type: string;
  current_value: number;
}

interface GitHubRepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
}

// Use Record instead of Map for JSON serialization through Inngest steps
type CountsRecord = Record<string, number>;

const BATCH_SIZE = 50;

export const captureRepositoryMetricsCron = inngest.createFunction(
  {
    id: 'capture-repository-metrics-cron',
    name: 'Capture Repository Metrics (Cron)',
    retries: 2,
    concurrency: {
      limit: 1, // Only one instance at a time
    },
  },
  { cron: '0 0 * * *' }, // Run daily at midnight UTC
  async ({ step }) => {
    console.log('[Metrics Cron] Starting repository metrics capture');

    // Step 1: Get all active public repositories
    const repositories = await step.run('fetch-repositories', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('id, owner, name, stargazers_count, forks_count, open_issues_count, watchers_count')
        .eq('is_private', false)
        .eq('is_active', true)
        .order('stargazers_count', { ascending: false });

      if (error) {
        console.error('[Metrics Cron] Error fetching repositories: %s', error.message);
        throw new Error(`Failed to fetch repositories: ${error.message}`);
      }

      return (data || []) as RepositoryMetrics[];
    });

    if (repositories.length === 0) {
      console.log('[Metrics Cron] No active repositories found');
      return {
        success: true,
        repositoriesProcessed: 0,
        metricsInserted: 0,
        message: 'No active repositories to process',
      };
    }

    console.log('[Metrics Cron] Found %d repositories to process', repositories.length);

    // Step 2: Refresh repository metadata from GitHub API before capturing metrics
    // This ensures stargazers_count, forks_count, etc. are current — not stale from discovery time
    const refreshBatches = Math.ceil(repositories.length / BATCH_SIZE);
    let totalRefreshed = 0;

    for (let i = 0; i < refreshBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min((i + 1) * BATCH_SIZE, repositories.length);
      const batch = repositories.slice(batchStart, batchEnd);

      const refreshed = await step.run(`refresh-metadata-batch-${i}`, async () => {
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
                '[Metrics Cron] Failed to update metadata for %s/%s: %s',
                repo.owner,
                repo.name,
                error.message
              );
            } else {
              // Update the in-memory repo object so metrics capture uses fresh values
              repo.stargazers_count = ghData.stargazers_count;
              repo.forks_count = ghData.forks_count;
              repo.open_issues_count = ghData.open_issues_count;
              repo.watchers_count = ghData.watchers_count;
              updated++;
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(
              '[Metrics Cron] GitHub API error for %s/%s: %s',
              repo.owner,
              repo.name,
              message
            );
          }
        }

        return updated;
      });

      totalRefreshed += refreshed;
    }

    console.log(
      '[Metrics Cron] Refreshed metadata for %d/%d repositories',
      totalRefreshed,
      repositories.length
    );

    // Step 3: Get contributor counts for all repositories (using Record for JSON serialization)
    const contributorCounts = await step.run(
      'fetch-contributor-counts',
      async (): Promise<CountsRecord> => {
        const { data, error } = await supabase.rpc('get_repository_contributor_counts');

        if (error) {
          console.warn('[Metrics Cron] Could not fetch contributor counts: %s', error.message);
          return {};
        }

        const counts: CountsRecord = {};
        for (const row of data || []) {
          counts[row.repository_id] = row.contributor_count;
        }
        return counts;
      }
    );

    // Step 4: Get PR counts for all repositories (using Record for JSON serialization)
    const prCounts = await step.run('fetch-pr-counts', async (): Promise<CountsRecord> => {
      const { data, error } = await supabase.rpc('get_repository_pr_counts');

      if (error) {
        console.warn('[Metrics Cron] Could not fetch PR counts: %s', error.message);
        return {};
      }

      const counts: CountsRecord = {};
      for (const row of data || []) {
        counts[row.repository_id] = row.pr_count;
      }
      return counts;
    });

    // Step 5: Capture metrics in batches, tracking failures
    let totalMetricsInserted = 0;
    let failedBatches = 0;
    const totalBatches = Math.ceil(repositories.length / BATCH_SIZE);
    const failedBatchErrors: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min((i + 1) * BATCH_SIZE, repositories.length);
      const batch = repositories.slice(batchStart, batchEnd);

      const batchResult = await step.run(
        `capture-metrics-batch-${i}`,
        async (): Promise<{ inserted: number; error: string | null }> => {
          const metricsToCapture: MetricCapture[] = [];

          for (const repo of batch) {
            // Add base metrics from repository table
            metricsToCapture.push(
              {
                repository_id: repo.id,
                metric_type: 'stars',
                current_value: repo.stargazers_count || 0,
              },
              {
                repository_id: repo.id,
                metric_type: 'forks',
                current_value: repo.forks_count || 0,
              },
              {
                repository_id: repo.id,
                metric_type: 'issues',
                current_value: repo.open_issues_count || 0,
              },
              {
                repository_id: repo.id,
                metric_type: 'watchers',
                current_value: repo.watchers_count || 0,
              }
            );

            // Add contributor count if available
            const contributorCount = contributorCounts[repo.id];
            if (contributorCount !== undefined) {
              metricsToCapture.push({
                repository_id: repo.id,
                metric_type: 'contributors',
                current_value: contributorCount,
              });
            }

            // Add PR count if available
            const prCount = prCounts[repo.id];
            if (prCount !== undefined) {
              metricsToCapture.push({
                repository_id: repo.id,
                metric_type: 'pull_requests',
                current_value: prCount,
              });
            }
          }

          // Use batch_capture_metrics RPC for efficient insertion
          const { data, error } = await supabase.rpc('batch_capture_metrics', {
            metrics_data: metricsToCapture,
          });

          if (error) {
            console.error('[Metrics Cron] Error capturing batch %d: %s', i, error.message);
            return { inserted: 0, error: `Batch ${i}: ${error.message}` };
          }

          return { inserted: data || 0, error: null };
        }
      );

      totalMetricsInserted += batchResult.inserted;
      if (batchResult.error) {
        failedBatches++;
        failedBatchErrors.push(batchResult.error);
      }
    }

    // Determine success based on failure rate
    // Fail if more than 50% of batches failed, or if all batches failed
    const failureRate = failedBatches / totalBatches;
    const isSuccess = failedBatches === 0 || (failureRate < 0.5 && totalMetricsInserted > 0);

    if (failedBatches > 0) {
      console.warn(
        '[Metrics Cron] ⚠️ Completed with errors: %d/%d batches failed',
        failedBatches,
        totalBatches
      );
    } else {
      console.log(
        '[Metrics Cron] ✅ Completed: %d repositories processed, %d metrics inserted',
        repositories.length,
        totalMetricsInserted
      );
    }

    // Throw if too many failures to trigger Inngest retry
    if (!isSuccess) {
      throw new Error(
        `Metrics capture failed: ${failedBatches}/${totalBatches} batches failed. Errors: ${failedBatchErrors.join('; ')}`
      );
    }

    // Step 6: Trigger star/fork event capture for all active repositories
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

    console.log('[Metrics Cron] Triggered event capture for %d repositories', eventsTriggered);

    return {
      success: isSuccess,
      repositoriesProcessed: repositories.length,
      metadataRefreshed: totalRefreshed,
      metricsInserted: totalMetricsInserted,
      eventsTriggered,
      totalBatches,
      failedBatches,
      failedBatchErrors: failedBatchErrors.length > 0 ? failedBatchErrors : undefined,
      completedAt: new Date().toISOString(),
    };
  }
);

/**
 * Manual trigger to capture metrics immediately (for testing or one-off runs)
 */
export const captureRepositoryMetricsManual = inngest.createFunction(
  {
    id: 'capture-repository-metrics-manual',
    name: 'Capture Repository Metrics (Manual)',
    retries: 1,
  },
  { event: 'metrics/repository.capture' },
  async ({ step }) => {
    console.log('[Metrics Manual] Triggering manual metrics capture');

    // Step 1: Get all active public repositories
    const repositories = await step.run('fetch-repositories', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('id, owner, name, stargazers_count, forks_count, open_issues_count, watchers_count')
        .eq('is_private', false)
        .eq('is_active', true)
        .order('stargazers_count', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch repositories: ${error.message}`);
      }

      return (data || []) as RepositoryMetrics[];
    });

    if (repositories.length === 0) {
      return {
        success: true,
        repositoriesProcessed: 0,
        metricsInserted: 0,
        message: 'No active repositories to process',
      };
    }

    // Step 2: Get contributor counts (using Record for JSON serialization)
    const contributorCounts = await step.run(
      'fetch-contributor-counts',
      async (): Promise<CountsRecord> => {
        const { data, error } = await supabase.rpc('get_repository_contributor_counts');
        if (error) return {};
        const counts: CountsRecord = {};
        for (const row of data || []) {
          counts[row.repository_id] = row.contributor_count;
        }
        return counts;
      }
    );

    // Step 3: Get PR counts (using Record for JSON serialization)
    const prCounts = await step.run('fetch-pr-counts', async (): Promise<CountsRecord> => {
      const { data, error } = await supabase.rpc('get_repository_pr_counts');
      if (error) return {};
      const counts: CountsRecord = {};
      for (const row of data || []) {
        counts[row.repository_id] = row.pr_count;
      }
      return counts;
    });

    // Step 4: Capture all metrics
    const metricsResult = await step.run('capture-all-metrics', async () => {
      const metricsToCapture: MetricCapture[] = [];

      for (const repo of repositories) {
        metricsToCapture.push(
          {
            repository_id: repo.id,
            metric_type: 'stars',
            current_value: repo.stargazers_count || 0,
          },
          { repository_id: repo.id, metric_type: 'forks', current_value: repo.forks_count || 0 },
          {
            repository_id: repo.id,
            metric_type: 'issues',
            current_value: repo.open_issues_count || 0,
          },
          {
            repository_id: repo.id,
            metric_type: 'watchers',
            current_value: repo.watchers_count || 0,
          }
        );

        const contributorCount = contributorCounts[repo.id];
        if (contributorCount !== undefined) {
          metricsToCapture.push({
            repository_id: repo.id,
            metric_type: 'contributors',
            current_value: contributorCount,
          });
        }

        const prCount = prCounts[repo.id];
        if (prCount !== undefined) {
          metricsToCapture.push({
            repository_id: repo.id,
            metric_type: 'pull_requests',
            current_value: prCount,
          });
        }
      }

      const { data, error } = await supabase.rpc('batch_capture_metrics', {
        metrics_data: metricsToCapture,
      });

      if (error) {
        throw new Error(`Failed to capture metrics: ${error.message}`);
      }

      return data || 0;
    });

    return {
      success: true,
      repositoriesProcessed: repositories.length,
      metricsInserted: metricsResult,
      completedAt: new Date().toISOString(),
    };
  }
);
