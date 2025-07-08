import { inngest } from '../client';
import { supabase } from '../../supabase';
import type { GitHubPullRequest } from '../types';

export const captureRepositorySync = inngest.createFunction(
  {
    id: "capture-repository-sync",
    name: "Sync Recent Repository PRs",
    concurrency: {
      limit: 5, // Lower limit for repository-wide operations
      key: "event.data.repositoryId",
    },
    retries: 2,
  },
  { event: "capture/repository.sync" },
  async ({ event, step }) => {
    const { repositoryId, days, priority, reason } = event.data;

    // Step 1: Get repository details
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }
      return data;
    });

    // Step 2: Fetch recent PRs from GitHub
    const recentPRs = await step.run("fetch-recent-prs", async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      try {
        // Use existing fetchPullRequests function from github.ts
        const { fetchPullRequests } = await import('../../github');
        const prs = await fetchPullRequests(repository.owner, repository.name, days.toString()) as unknown as GitHubPullRequest[];

        // Filter PRs updated within the time range
        return prs.filter((pr: GitHubPullRequest) => new Date(pr.updated_at) >= new Date(since));
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          throw new Error(`Repository ${repository.owner}/${repository.name} not found`);
        }
        throw error;
      }
    });

    // Step 3: Store PRs in database
    const storedPRs = await step.run("store-prs", async () => {
      if (recentPRs.length === 0) {
        return [];
      }

      const prsToStore = recentPRs.map((pr: GitHubPullRequest) => ({
        github_id: pr.id.toString(),
        repository_id: repositoryId,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author_id: pr.user?.id.toString(),
        author_username: pr.user?.login,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        closed_at: pr.closed_at,
        merged_at: pr.merged_at,
        draft: pr.draft,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        base_ref: pr.base.ref,
        head_ref: pr.head.ref,
      }));

      const { data, error } = await supabase
        .from('pull_requests')
        .upsert(prsToStore, {
          onConflict: 'github_id',
          ignoreDuplicates: false,
        })
        .select('id, number');

      if (error) {
        throw new Error(`Failed to store PRs: ${error.message}`);
      }

      return data || [];
    });

    // Step 4: Queue detailed capture for PRs missing data
    const queuedJobs = await step.run("queue-detailed-capture", async () => {
      const jobsQueued = {
        reviews: 0,
        comments: 0,
        details: 0,
      };

      for (const pr of storedPRs) {
        // Queue jobs for PRs that likely need more data
        const prData = recentPRs.find((p: GitHubPullRequest) => p.number === pr.number);
        
        if (!prData) continue;

        // If PR has no file change data, queue details job
        if ((prData.additions === 0 && prData.deletions === 0) || prData.changed_files === 0) {
          await step.sendEvent("pr-details", {
            name: "capture/pr.details",
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              priority,
            },
          });
          jobsQueued.details++;
        }

        // Queue review capture
        await step.sendEvent("pr-reviews", {
          name: "capture/pr.reviews",
          data: {
            repositoryId,
            prNumber: pr.number.toString(),
            prId: pr.id,
            prGithubId: prData.id.toString(),
            priority,
          },
        });
        jobsQueued.reviews++;

        // Queue comment capture
        await step.sendEvent("pr-comments", {
          name: "capture/pr.comments",
          data: {
            repositoryId,
            prNumber: pr.number.toString(),
            prId: pr.id,
            prGithubId: prData.id.toString(),
            priority,
          },
        });
        jobsQueued.comments++;
      }

      return jobsQueued;
    });

    // Step 5: Update repository sync timestamp
    await step.run("update-sync-timestamp", async () => {
      const { error } = await supabase
        .from('repositories')
        .update({
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', repositoryId);

      if (error) {
        console.warn(`Failed to update repository sync timestamp: ${error.message}`);
      }
    });

    return {
      success: true,
      repositoryId,
      repository: `${repository.owner}/${repository.name}`,
      prsFound: recentPRs.length,
      prsStored: storedPRs.length,
      jobsQueued: queuedJobs,
      reason,
    };
  }
);