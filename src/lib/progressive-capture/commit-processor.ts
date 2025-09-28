import { captureCommits } from '../capture-commits';
import { supabase } from '../supabase';
import { queueManager } from './queue-manager';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { env } from '../env';

/**
 * Processor for capturing commits from GitHub using the progressive capture system
 * Integrates with the same patterns as other GitHub API data capture
 */
export class CommitProcessor {
  /**
   * Get time range configuration from environment
   */
  private static getTimeRangeConfig() {
    return {
      initialDays: parseInt(env.VITE_COMMITS_INITIAL_DAYS || '7', 10),
      updateDays: parseInt(env.VITE_COMMITS_UPDATE_DAYS || '1', 10),
      maxPerRun: parseInt(env.VITE_COMMITS_MAX_PER_RUN || '1000', 10),
      batchSize: parseInt(env.VITE_GITHUB_COMMITS_BATCH_SIZE || '100', 10),
      maxPages: parseInt(env.VITE_GITHUB_COMMITS_MAX_PAGES || '10', 10),
    };
  }

  /**
   * Process a commits job - fetch and store commits from GitHub
   */
  static async processCommitsJob(
    repositoryId: string,
    metadata: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get repository info
      const { data: repo, error: repoError } = await supabase
        .from('repositories')
        .select('owner, name, last_commit_capture_at')
        .eq('id', repositoryId)
        .maybeSingle();

      if (repoError || !repo) {
        return {
          success: false,
          error: `Repository not found: ${repoError?.message}`
        };
      }

      const config = this.getTimeRangeConfig();

      // Determine time range based on whether this is initial or incremental capture
      const isInitialCapture = !repo.last_commit_capture_at ||
        metadata?.force_initial === true;

      const daysToCapture = isInitialCapture ?
        config.initialDays :
        config.updateDays;

      // Calculate since date
      const since = new Date(Date.now() - daysToCapture * 24 * 60 * 60 * 1000);

      console.log(
        '[CommitProcessor] %s commit capture for %s/%s (last %d days)',
        isInitialCapture ? 'Initial' : 'Incremental',
        repo.owner,
        repo.name,
        daysToCapture
      );

      // Use the existing captureCommits function
      const result = await captureCommits(repo.owner, repo.name, since, {
        batchSize: config.batchSize,
        maxPages: Math.min(config.maxPages, Math.ceil(config.maxPerRun / config.batchSize)),
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      // Update last capture timestamp
      await supabase
        .from('repositories')
        .update({
          last_commit_capture_at: new Date().toISOString(),
          commit_capture_status: 'completed'
        })
        .eq('id', repositoryId);

      // Queue commit PR analysis if commits were captured
      if (result.count > 0) {
        // Get commit SHAs that need analysis
        const { data: commitsNeedingAnalysis } = await supabase
          .from('commits')
          .select('sha')
          .eq('repository_id', repositoryId)
          .is('is_direct_commit', null)
          .gte('authored_at', since.toISOString())
          .limit(100);

        if (commitsNeedingAnalysis && commitsNeedingAnalysis.length > 0) {
          const shas = commitsNeedingAnalysis.map(c => c.sha);
          const analysisQueued = await queueManager.queueCommitPRAnalysis(
            repositoryId,
            shas,
            'medium'
          );

          console.log(
            '[CommitProcessor] Queued %d commits for PR analysis',
            analysisQueued
          );
        }
      }

      // Show success notification
      if (result.count > 0) {
        ProgressiveCaptureNotifications.showProcessingComplete(
          `${repo.owner}/${repo.name}`,
          [`${result.count} commits captured`]
        );
      }

      console.log(
        '✅ [CommitProcessor] Successfully captured %d commits for %s/%s',
        result.count,
        repo.owner,
        repo.name
      );

      return { success: true };
    } catch (error) {
      console.error('[CommitProcessor] Error processing commits job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Queue commit capture for a repository
   */
  static async queueCommitCapture(
    repositoryId: string,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'medium',
    forceInitial = false
  ): Promise<boolean> {
    try {
      const config = this.getTimeRangeConfig();

      // Estimate API calls based on time range
      const daysToCapture = forceInitial ?
        config.initialDays :
        config.updateDays;

      // Rough estimate: 1 API call per 100 commits
      const estimatedApiCalls = Math.ceil(
        (daysToCapture * 10) / 100 // Assume ~10 commits per day average
      );

      const { error } = await supabase.from('data_capture_queue').insert({
        type: 'commits',
        priority,
        repository_id: repositoryId,
        estimated_api_calls: Math.min(estimatedApiCalls, config.maxPages),
        metadata: {
          days: daysToCapture,
          force_initial: forceInitial,
          reason: forceInitial ? 'initial_capture' : 'incremental_update',
          max_commits: config.maxPerRun,
        },
      });

      if (error && error.code !== '23505') {
        // Ignore duplicate key errors
        console.error('[CommitProcessor] Error queuing commit capture:', error);
        return false;
      }

      // Show UI notification
      ProgressiveCaptureNotifications.showJobsQueued(1, 'commit capture');

      return true;
    } catch (err) {
      console.error('[CommitProcessor] Error queuing commit capture:', err);
      return false;
    }
  }

  /**
   * Queue commit capture for repositories with stale or missing commit data
   */
  static async queueStaleCommitCaptures(
    maxRepositories = 10
  ): Promise<number> {
    try {
      const config = this.getTimeRangeConfig();
      const staleThreshold = new Date(
        Date.now() - config.updateDays * 24 * 60 * 60 * 1000
      );

      // Find repositories that need commit capture
      const { data: repositories, error } = await supabase
        .from('repositories')
        .select('id, owner, name, last_commit_capture_at')
        .or(`last_commit_capture_at.is.null,last_commit_capture_at.lt.${staleThreshold.toISOString()}`)
        .order('last_commit_capture_at', { ascending: true, nullsFirst: true })
        .limit(maxRepositories);

      if (error || !repositories || repositories.length === 0) {
        return 0;
      }

      let queuedCount = 0;
      for (const repo of repositories) {
        const isInitial = !repo.last_commit_capture_at;
        const priority = isInitial ? 'high' : 'medium';

        const queued = await this.queueCommitCapture(
          repo.id,
          priority,
          isInitial
        );

        if (queued) {
          queuedCount++;
        }
      }

      if (queuedCount > 0) {
        console.log(
          '[CommitProcessor] Queued commit capture for %d repositories',
          queuedCount
        );
      }

      return queuedCount;
    } catch (error) {
      console.error('[CommitProcessor] Error queuing stale commit captures:', error);
      return 0;
    }
  }
}