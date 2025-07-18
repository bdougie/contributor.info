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

    // Skip rate limit check - Inngest throttling handles this

    // Step 2: Fetch PR details from GitHub (with timeout)
    const githubPrData = await step.run("fetch-pr-details", async () => {
      try {
        // Add a race condition with timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GitHub API timeout')), 15000); // 15 second timeout
        });
        
        const apiPromise = makeGitHubRequest(`/repos/${repository.owner}/${repository.name}/pulls/${prNumber}`);
        
        const pr = await Promise.race([apiPromise, timeoutPromise]);
        return pr as GitHubPullRequest;
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          throw new Error(`PR #${prNumber} not found in ${repository.owner}/${repository.name}`);
        }
        if (error instanceof Error && error.message === 'GitHub API timeout') {
          throw new Error(`Timeout fetching PR #${prNumber} from ${repository.owner}/${repository.name}`);
        }
        throw error;
      }
    });

    // Step 3: Find or create merged_by contributor (simplified)
    const mergedByContributorId = await step.run("resolve-merged-by-contributor", async () => {
      if (!githubPrData.merged || !githubPrData.merged_by) {
        return null;
      }

      try {
        // Try upsert first - more efficient with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database timeout')), 10000); // 10 second timeout
        });
        
        const dbPromise = supabase
          .from('contributors')
          .upsert({
            github_id: githubPrData.merged_by.id,
            username: githubPrData.merged_by.login,
            avatar_url: githubPrData.merged_by.avatar_url,
            is_bot: githubPrData.merged_by.type === 'Bot' || githubPrData.merged_by.login.includes('[bot]')
          }, {
            onConflict: 'github_id',
            ignoreDuplicates: false
          })
          .select('id')
          .single();
          
        const result = await Promise.race([dbPromise, timeoutPromise]);
        const { data: contributor, error } = result as { data: any; error: any };

        if (error) {
          console.warn(`Failed to upsert merged_by contributor ${githubPrData.merged_by.login}:`, error);
          return null;
        }

        return contributor?.id || null;
      } catch (error) {
        console.warn(`Error handling merged_by contributor:`, error);
        return null;
      }
    });

    // Step 4: Update database (with timeout)
    await step.run("update-database", async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database update timeout')), 10000); // 10 second timeout
      });
      
      const updatePromise = supabase
        .from('pull_requests')
        .update({
          additions: githubPrData.additions,
          deletions: githubPrData.deletions,
          changed_files: githubPrData.changed_files,
          commits: githubPrData.commits,
          mergeable_state: githubPrData.mergeable_state,
          merged: githubPrData.merged,
          merged_at: githubPrData.merged_at,
          merged_by_id: mergedByContributorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prId);
        
      const result = await Promise.race([updatePromise, timeoutPromise]);
      const { error } = result as { error: any };

      if (error) {
        throw new Error(`Failed to update PR: ${error.message}`);
      }

      return { success: true, prNumber, repositoryId };
    });

    console.log(`✅ Successfully captured details for PR #${prNumber} in repository ${repositoryId}`);

    return {
      success: true,
      prNumber,
      repositoryId,
      fileChanges: githubPrData.changed_files,
      additions: githubPrData.additions,
      deletions: githubPrData.deletions,
    };
  }
);