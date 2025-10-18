import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { SyncLogger } from '../sync-logger';
import { NonRetriableError } from 'inngest';

/**
 * Captures all PR and issue comments for a repository
 * Orchestrates individual comment capture jobs for PRs and issues with recent activity
 *
 * This function is triggered by workspace comment sync operations to ensure
 * Replies tab data is fresh and complete.
 */
export const captureRepositoryCommentsAll = inngest.createFunction(
  {
    id: 'capture-repository-comments-all',
    name: 'Capture Repository Comments (All)',
    concurrency: {
      limit: 2,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 20,
      period: '1m',
    },
  },
  { event: 'capture/repository.comments.all' },
  async ({ event, step }) => {
    const { repositoryId, timeRange = 30, priority = 'medium' } = event.data;
    const syncLogger = new SyncLogger();

    if (!repositoryId) {
      throw new NonRetriableError('Missing repositoryId parameter');
    }

    // Step 0: Initialize sync log
    await step.run('init-sync-log', async () => {
      return await syncLogger.start('repository_comments_all', repositoryId, {
        timeRange,
        priority,
        source: 'workspace-sync',
      });
    });

    // Step 1: Get repository details
    const repository = await step.run('get-repository', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new NonRetriableError(`Repository not found: ${repositoryId}`);
      }
      return data;
    });

    // Step 2: Find recent PRs to sync comments for
    const recentPRs = await step.run('find-recent-prs', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeRange);

      const { data, error } = await supabase
        .from('pull_requests')
        .select('id, number')
        .eq('repository_id', repositoryId)
        .gte('updated_at', cutoffDate.toISOString())
        .order('updated_at', { ascending: false })
        .limit(100); // Limit to most recent 100 PRs for safety

      if (error) {
        console.error('Error fetching recent PRs: %s', error.message);
        return [];
      }

      console.log(
        'Found %d recent PRs for %s/%s (last %d days)',
        data?.length || 0,
        repository.owner,
        repository.name,
        timeRange
      );

      return data || [];
    });

    // Step 3: Queue PR comment capture jobs
    const prJobsQueued = await step.run('queue-pr-comment-jobs', async () => {
      if (recentPRs.length === 0) {
        return 0;
      }

      let queued = 0;
      for (const pr of recentPRs) {
        try {
          await inngest.send({
            name: 'capture/pr.comments',
            data: {
              repositoryId: repository.id,
              prNumber: pr.number.toString(),
              prId: pr.id,
              priority,
            },
          });
          queued++;
        } catch (error) {
          console.warn(
            'Failed to queue PR comment job for PR #%s: %s',
            pr.number,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      console.log('Queued %d PR comment capture jobs', queued);
      return queued;
    });

    // Step 4: Find recent issues to sync comments for
    const recentIssues = await step.run('find-recent-issues', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeRange);

      const { data, error } = await supabase
        .from('issues')
        .select('id, number')
        .eq('repository_id', repositoryId)
        .gte('updated_at', cutoffDate.toISOString())
        .order('updated_at', { ascending: false })
        .limit(100); // Limit to most recent 100 issues for safety

      if (error) {
        console.error('Error fetching recent issues: %s', error.message);
        return [];
      }

      console.log(
        'Found %d recent issues for %s/%s (last %d days)',
        data?.length || 0,
        repository.owner,
        repository.name,
        timeRange
      );

      return data || [];
    });

    // Step 5: Queue issue comment capture jobs
    const issueJobsQueued = await step.run('queue-issue-comment-jobs', async () => {
      if (recentIssues.length === 0) {
        return 0;
      }

      let queued = 0;
      for (const issue of recentIssues) {
        try {
          await inngest.send({
            name: 'capture/issue.comments',
            data: {
              repositoryId: repository.id,
              issueNumber: issue.number.toString(),
              issueId: issue.id,
              priority,
            },
          });
          queued++;
        } catch (error) {
          console.warn(
            'Failed to queue issue comment job for issue #%s: %s',
            issue.number,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      console.log('Queued %d issue comment capture jobs', queued);
      return queued;
    });

    // Complete sync log
    await step.run('complete-sync-log', async () => {
      await syncLogger.complete({
        records_processed: recentPRs.length + recentIssues.length,
        records_inserted: prJobsQueued + issueJobsQueued,
        github_api_calls_used: 0, // This function just orchestrates, actual API calls happen in child jobs
        metadata: {
          recentPRsFound: recentPRs.length,
          recentIssuesFound: recentIssues.length,
          prJobsQueued,
          issueJobsQueued,
          totalJobsQueued: prJobsQueued + issueJobsQueued,
          timeRange,
        },
      });
    });

    return {
      success: true,
      repositoryId,
      repository: `${repository.owner}/${repository.name}`,
      recentPRsFound: recentPRs.length,
      recentIssuesFound: recentIssues.length,
      prJobsQueued,
      issueJobsQueued,
      totalJobsQueued: prJobsQueued + issueJobsQueued,
    };
  }
);
