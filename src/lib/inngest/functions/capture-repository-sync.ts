import { inngest } from '../client';
import { supabase } from '../../supabase';
import type { GitHubPullRequest } from '../types';
import { RATE_LIMIT_CONFIG } from '../queue-manager';
import { getPRState } from '../../utils/state-mapping';

// Rate limiting constants
const MAX_PRS_PER_SYNC = 100;
const LARGE_REPO_THRESHOLD = 1000;
const DEFAULT_DAYS_LIMIT = 30;

// Helper function to ensure contributors exist and return their UUIDs
async function ensureContributorExists(githubUser: any): Promise<string | null> {
  if (!githubUser || !githubUser.id) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: githubUser.id,
        username: githubUser.login,
        display_name: githubUser.name || null,
        email: githubUser.email || null,
        avatar_url: githubUser.avatar_url || null,
        profile_url: `https://github.com/${githubUser.login}`,
        bio: githubUser.bio || null,
        company: githubUser.company || null,
        location: githubUser.location || null,
        blog: githubUser.blog || null,
        public_repos: githubUser.public_repos || 0,
        public_gists: githubUser.public_gists || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        github_created_at: githubUser.created_at || new Date().toISOString(),
        is_bot: githubUser.type === 'Bot' || githubUser.login.includes('[bot]'),
        is_active: true,
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error upserting contributor:', error);
    return null;
  }

  if (!data) {
    return null;
  }
  return data.id;
}

export const captureRepositorySync = inngest.createFunction(
  {
    id: 'capture-repository-sync',
    name: 'Sync Recent Repository PRs',
    concurrency: {
      limit: 3, // Reduced for better rate limit management
      key: 'event.data.repositoryId',
    },
    retries: 2,
  },
  { event: 'capture/repository.sync' },
  async ({ event, step }) => {
    const { repositoryId, days, priority, reason } = event.data;
    const effectiveDays = Math.min(days || DEFAULT_DAYS_LIMIT, DEFAULT_DAYS_LIMIT);

    // Step 1: Get repository details and check if it was recently processed
    const repository = await step.run('get-repository', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, last_updated_at')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }

      // Check if repository was synced recently
      if (data.last_updated_at) {
        const lastSyncTime = new Date(data.last_updated_at).getTime();
        const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

        if (hoursSinceSync < RATE_LIMIT_CONFIG.COOLDOWN_HOURS && reason !== 'manual') {
          const timeAgo =
            hoursSinceSync < 1
              ? `${Math.round(hoursSinceSync * 60)} minutes`
              : `${Math.round(hoursSinceSync)} hours`;
          throw new Error(
            `Repository ${data.owner}/${data.name} was synced ${timeAgo} ago. Skipping to prevent rate limiting.`
          );
        }
      }

      return data;
    });

    // Step 2: Check repository size before proceeding
    await step.run('check-repository-size', async () => {
      const { count: prCount } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId);

      if (prCount && prCount > LARGE_REPO_THRESHOLD) {
        console.warn(
          `Large repository detected: ${repository.owner}/${repository.name} has ${prCount} PRs`
        );
      }

      return { prCount: prCount || 0 };
    });

    // Step 3: Fetch recent PRs from GitHub with strict limits
    const recentPRs = await step.run('fetch-recent-prs', async () => {
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();

      try {
        // Use existing fetchPullRequests function from github.ts
        const { fetchPullRequests } = await import('../../github');
        const prs = (await fetchPullRequests(
          repository.owner,
          repository.name,
          effectiveDays.toString()
        )) as unknown as GitHubPullRequest[];

        // Filter PRs updated within the time range and apply limit
        const filteredPRs = prs
          .filter((pr: GitHubPullRequest) => new Date(pr.updated_at) >= new Date(since))
          .slice(0, MAX_PRS_PER_SYNC); // Strict limit to prevent rate limiting

        if (prs.length > MAX_PRS_PER_SYNC) {
          console.warn(
            `Limited ${repository.owner}/${repository.name} sync to ${MAX_PRS_PER_SYNC} most recent PRs out of ${prs.length} total`
          );
        }

        return filteredPRs;
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          throw new Error(`Repository ${repository.owner}/${repository.name} not found`);
        }
        if (apiError.status === 403) {
          throw new Error(
            `Rate limit hit for ${repository.owner}/${repository.name}. Please try again later.`
          );
        }
        throw error;
      }
    });

    // Step 4: Store PRs in database
    const storedPRs = await step.run('store-prs', async () => {
      if (recentPRs.length === 0) {
        return [];
      }

      // First, ensure all contributors exist and get their UUIDs
      const contributorPromises = recentPRs.map((pr) => ensureContributorExists(pr.user));
      const contributorIds = await Promise.all(contributorPromises);

      // Then create PRs with proper UUIDs
      const prsToStore = recentPRs.map((pr: GitHubPullRequest, index: number) => ({
        github_id: pr.id.toString(),
        repository_id: repositoryId,
        number: pr.number,
        title: pr.title,
        body: null, // PR body not available in simplified type
        state: getPRState({ state: pr.state, merged: pr.merged }),
        author_id: contributorIds[index], // Now this is a proper UUID
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        closed_at: pr.closed_at,
        merged_at: pr.merged_at,
        draft: pr.draft,
        merged: pr.merged || false,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        base_branch: pr.base?.ref || 'main',
        head_branch: pr.head?.ref || 'unknown',
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

    // Step 5: Prepare job queue data (no nested steps)
    const jobsToQueue = await step.run('prepare-job-queue', async () => {
      const jobs = {
        details: [] as any[],
        reviews: [] as any[],
        comments: [] as any[],
      };

      // Limit the number of detail jobs to queue
      const MAX_DETAIL_JOBS = 20;
      // Use centralized configuration for review/comment job limits
      const MAX_REVIEW_COMMENT_JOBS = RATE_LIMIT_CONFIG.MAX_REVIEW_COMMENT_JOBS;

      let detailJobsQueued = 0;
      let reviewJobsQueued = 0;
      let commentJobsQueued = 0;

      for (const pr of storedPRs) {
        // Queue jobs for PRs that likely need more data
        const prData = recentPRs.find((p: GitHubPullRequest) => p.number === pr.number);

        if (!prData) continue;

        // If PR has no file change data, prepare details job (limited)
        if (
          detailJobsQueued < MAX_DETAIL_JOBS &&
          ((prData.additions === 0 && prData.deletions === 0) || prData.changed_files === 0)
        ) {
          jobs.details.push({
            name: 'capture/pr.details',
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              priority,
            },
          });
          detailJobsQueued++;
        }

        // Prepare review capture (limited)
        if (reviewJobsQueued < MAX_REVIEW_COMMENT_JOBS) {
          jobs.reviews.push({
            name: 'capture/pr.reviews',
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              prGithubId: prData.id.toString(),
              priority,
            },
          });
          reviewJobsQueued++;
        }

        // Prepare comment capture (limited)
        if (commentJobsQueued < MAX_REVIEW_COMMENT_JOBS) {
          jobs.comments.push({
            name: 'capture/pr.comments',
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              prGithubId: prData.id.toString(),
              priority,
            },
          });
          commentJobsQueued++;
        }

        // Stop if we've hit all limits
        if (
          detailJobsQueued >= MAX_DETAIL_JOBS &&
          reviewJobsQueued >= MAX_REVIEW_COMMENT_JOBS &&
          commentJobsQueued >= MAX_REVIEW_COMMENT_JOBS
        ) {
          console.warn(
            `Hit job queue limits for ${repository.owner}/${repository.name}. Some PRs may not have complete data.`
          );
          break;
        }
      }

      return jobs;
    });

    // Step 6: Send events for queued jobs
    // Note: step.sendEvent must be called outside of step.run to avoid nested step tooling
    let detailsQueued = 0;
    for (const job of jobsToQueue.details) {
      await step.sendEvent(`pr-details-${detailsQueued}`, job);
      detailsQueued++;
    }

    let reviewsQueued = 0;
    for (const job of jobsToQueue.reviews) {
      await step.sendEvent(`pr-reviews-${reviewsQueued}`, job);
      reviewsQueued++;
    }

    let commentsQueued = 0;
    for (const job of jobsToQueue.comments) {
      await step.sendEvent(`pr-comments-${commentsQueued}`, job);
      commentsQueued++;
    }

    const queuedJobs = {
      reviews: reviewsQueued,
      comments: commentsQueued,
      details: detailsQueued,
    };

    // Step 7: Update repository sync timestamp
    await step.run('update-sync-timestamp', async () => {
      const { error } = await supabase
        .from('repositories')
        .update({
          last_updated_at: new Date().toISOString(),
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
