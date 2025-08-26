import { inngest } from '../client';
import { supabase } from '../../supabase';

/**
 * Updates comments and reviews for existing PRs that may have new activity
 * This function should be triggered periodically to keep PR data fresh
 */
export const updatePrActivity = inngest.createFunction(
  {
    id: "update-pr-activity",
    name: "Update PR Comments and Reviews",
    concurrency: {
      limit: 5,
      key: "event.data.repositoryId",
    },
    throttle: {
      limit: 30,
      period: "1m",
    },
  },
  { event: "update/pr.activity" },
  async ({ event, step }) => {
    const { repositoryId, days = 7 } = event.data;
    
    // Input validation
    if (!repositoryId || typeof repositoryId !== 'string') {
      throw new Error('Invalid repositoryId: must be a non-empty string');
    }
    
    if (typeof days !== 'number' || days < 1 || days > 365) {
      throw new Error('Invalid days parameter: must be a number between 1 and 365');
    }

    // Step 1: Find PRs that might have new activity
    const prsToUpdate = await step.run("find-prs-needing-update", async () => {
      const { data: repository } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (!repository) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }

      // Find open PRs or recently closed PRs that might have new comments/reviews
      const { data: prs, error: _error } = await supabase
        .from('pull_requests')
        .select(`
          id,
          number,
          github_id,
          state,
          updated_at,
          created_at
        `)
        .eq('repository_id', repositoryId)
        .or(`state.eq.open,updated_at.gte.${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()}`)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (_error) {
        throw new Error(`Failed to fetch PRs: ${_error.message}`);
      }

      console.log('Found %s PRs to check for updates in %s/%s', prs?.length || 0, repository.owner, repository.name);
      return { prs: prs || [], repository };
    });

    // Step 2: Queue detail capture jobs for PRs
    const jobsQueued = await step.run("queue-update-jobs", async () => {
      const jobs = [];
      const { prs, repository } = prsToUpdate;

      for (const pr of prs) {
        // Check if we've captured comments/reviews recently
        const { count: commentCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('pull_request_id', pr.id);

        const { count: reviewCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('pull_request_id', pr.id);

        // Check last capture time from sync logs
        const { data: lastSync } = await supabase
          .from('sync_logs')
          .select('completed_at')
          .eq('meta_data->>prId', pr.id)
          .in('sync_type', ['pr_comments', 'pr_reviews', 'pr_details'])
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const hoursSinceLastSync = lastSync?.completed_at 
          ? (Date.now() - new Date(lastSync.completed_at).getTime()) / (1000 * 60 * 60)
          : Infinity;

        // Queue update if:
        // 1. PR is open (always check for new activity)
        // 2. No comments/reviews captured yet
        // 3. Haven't synced in over 6 hours
        const needsUpdate = pr.state === 'open' || 
                           (commentCount === 0 && reviewCount === 0) ||
                           hoursSinceLastSync > 6;

        if (needsUpdate) {
          jobs.push({
            name: "capture/pr.details.graphql",
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              prGithubId: pr.github_id,
              priority: pr.state === 'open' ? 'high' : 'medium',
            },
          });
        }
      }

      console.log('Queueing %s PR update jobs for %s/%s', jobs.length, repository.owner, repository.name);
      return jobs;
    });

    // Step 3: Send events for queued jobs
    let sent = 0;
    for (const job of jobsQueued) {
      await step.sendEvent(`update-pr-${sent}`, job);
      sent++;
    }

    return {
      success: true,
      repositoryId,
      prsChecked: prsToUpdate.prs.length,
      jobsQueued: sent,
      repository: `${prsToUpdate.repository.owner}/${prsToUpdate.repository.name}`,
    };
  }
);