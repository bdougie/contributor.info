import { inngest } from '../client';
import { supabase } from '../../supabase';
import { makeGitHubRequest } from '../github-client';
import type { GitHubPullRequest } from '../types';

export const capturePrDetails = inngest.createFunction(
  {
    id: "capture-pr-details",
    name: "Capture PR Details",
    concurrency: {
      // Reduced limit for better rate management
      limit: 5,
      // Group by repository to avoid hammering the same repo
      key: "event.data.repositoryId",
    },
    retries: 3,
    // More conservative throttling
    throttle: {
      limit: 20,
      period: "1m",
      key: "event.data.priority",
    },
  },
  { event: "capture/pr.details" },
  async ({ event, step }) => {
    const { repositoryId, prNumber, prId } = event.data;

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

    // Step 2: Check rate limits
    await step.run("check-rate-limits", async () => {
      try {
        const rateLimit = await makeGitHubRequest('/rate_limit');
        const remaining = rateLimit.rate.remaining;
        const reset = new Date(rateLimit.rate.reset * 1000);
        
        // If we're getting low on rate limit, wait
        if (remaining < 100) {
          const waitTime = reset.getTime() - Date.now();
          if (waitTime > 0) {
            await step.sleep("rate-limit-wait", Math.min(waitTime, 60000)); // Max 1 minute
          }
        }

        return { remaining, reset };
      } catch (error) {
        // If rate limit check fails, continue anyway
        return { remaining: 1000, reset: new Date() };
      }
    });

    // Step 3: Fetch PR details from GitHub
    const prDetails = await step.run("fetch-pr-details", async () => {
      try {
        const pr = await makeGitHubRequest(`/repos/${repository.owner}/${repository.name}/pulls/${prNumber}`);
        const githubPr = pr as GitHubPullRequest;

        return {
          additions: githubPr.additions,
          deletions: githubPr.deletions,
          changed_files: githubPr.changed_files,
          commits: githubPr.commits,
          review_comments: githubPr.review_comments,
          comments: githubPr.comments,
          mergeable_state: githubPr.mergeable_state,
          merged: githubPr.merged,
          merged_at: githubPr.merged_at,
          merged_by_id: githubPr.merged_by?.id,
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          throw new Error(`PR #${prNumber} not found in ${repository.owner}/${repository.name}`);
        }
        throw error;
      }
    });

    // Step 4: Update database
    await step.run("update-database", async () => {
      const { error } = await supabase
        .from('pull_requests')
        .update({
          additions: prDetails.additions,
          deletions: prDetails.deletions,
          changed_files: prDetails.changed_files,
          commits: prDetails.commits,
          review_comments_count: prDetails.review_comments,
          comments_count: prDetails.comments,
          mergeable_state: prDetails.mergeable_state,
          merged: prDetails.merged,
          merged_at: prDetails.merged_at,
          merged_by_id: prDetails.merged_by_id?.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', prId);

      if (error) {
        throw new Error(`Failed to update PR: ${error.message}`);
      }

      return { success: true, prNumber, repositoryId };
    });

    // Step 5: Log completion
    await step.run("log-completion", async () => {
      console.log(`✅ Successfully captured details for PR #${prNumber} in repository ${repositoryId}`);
      
      // Optionally trigger UI notification
      await step.sendEvent("batch-completed", {
        name: "capture/batch.completed",
        data: {
          repositoryId,
          jobType: "pr_details",
          successCount: 1,
          failureCount: 0,
          totalCount: 1,
        },
      });
    });

    return {
      success: true,
      prNumber,
      repositoryId,
      fileChanges: prDetails.changed_files,
      additions: prDetails.additions,
      deletions: prDetails.deletions,
    };
  }
);