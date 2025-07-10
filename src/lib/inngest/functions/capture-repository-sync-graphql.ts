import { inngest } from '../client';
import { supabase } from '../../supabase';
import { GraphQLClient } from '../graphql-client';
import type { NonRetriableError } from 'inngest';

// Rate limiting constants for GraphQL (more generous)
const MAX_PRS_PER_SYNC = 150; // Higher than REST due to efficiency
const LARGE_REPO_THRESHOLD = 1000;
const DEFAULT_DAYS_LIMIT = 30;

// GraphQL client instance
const graphqlClient = new GraphQLClient();

// Helper function to ensure contributors exist and return their UUIDs
async function ensureContributorExists(githubUser: any): Promise<string | null> {
  if (!githubUser || !githubUser.databaseId) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert({
      github_id: githubUser.databaseId.toString(),
      username: githubUser.login,
      name: githubUser.name || null,
      email: githubUser.email || null,
      avatar_url: githubUser.avatarUrl || null,
      bio: githubUser.bio || null,
      company: githubUser.company || null,
      location: githubUser.location || null,
      blog: githubUser.blog || null,
      twitter_username: githubUser.twitter_username || null,
      public_repos: githubUser.public_repos || 0,
      public_gists: githubUser.public_gists || 0,
      followers: githubUser.followers || 0,
      following: githubUser.following || 0,
      created_at: githubUser.createdAt || new Date().toISOString(),
      updated_at: githubUser.updatedAt || new Date().toISOString(),
    }, {
      onConflict: 'github_id',
      ignoreDuplicates: false
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error upserting contributor:', error);
    return null;
  }

  return data.id;
}

export const captureRepositorySyncGraphQL = inngest.createFunction(
  {
    id: "capture-repository-sync-graphql",
    name: "Sync Recent Repository PRs (GraphQL)",
    concurrency: {
      limit: 5, // Higher than REST due to better rate limits
      key: "event.data.repositoryId",
    },
    throttle: { limit: 75, period: "1m" }, // More generous than REST
    retries: 2,
  },
  { event: "capture/repository.sync.graphql" },
  async ({ event, step }) => {
    const { repositoryId, days, priority, reason } = event.data;
    const effectiveDays = Math.min(days || DEFAULT_DAYS_LIMIT, DEFAULT_DAYS_LIMIT);

    // Step 1: Get repository details and check if it was recently processed
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, last_updated_at')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`) as NonRetriableError;
      }

      // Check if repository was synced recently (within 12 hours for GraphQL - more frequent due to efficiency)
      if (data.last_updated_at) {
        const lastSyncTime = new Date(data.last_updated_at).getTime();
        const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);
        
        if (hoursSinceSync < 12 && reason !== 'manual') {
          throw new Error(`Repository ${data.owner}/${data.name} was synced ${Math.round(hoursSinceSync)} hours ago. Skipping to prevent excessive API usage.`) as NonRetriableError;
        }
      }

      return data;
    });

    // Step 2: Check repository size before proceeding
    await step.run("check-repository-size", async () => {
      const { count: prCount } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId);

      if (prCount && prCount > LARGE_REPO_THRESHOLD) {
        console.warn(`Large repository detected: ${repository.owner}/${repository.name} has ${prCount} PRs`);
      }

      return { prCount: prCount || 0 };
    });

    // Step 3: Fetch recent PRs from GitHub using GraphQL
    const recentPRs = await step.run("fetch-recent-prs-graphql", async () => {
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();
      
      try {
        const prs = await graphqlClient.getRecentPRs(
          repository.owner, 
          repository.name, 
          since, 
          MAX_PRS_PER_SYNC
        );

        console.log(`✅ GraphQL recent PRs query successful for ${repository.owner}/${repository.name} (${prs.length} PRs found)`);
        
        // Log rate limit info
        const rateLimit = graphqlClient.getRateLimit();
        if (rateLimit) {
          console.log(`📊 GraphQL rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining (cost: ${rateLimit.cost} points)`);
        }

        return prs.slice(0, MAX_PRS_PER_SYNC); // Ensure we don't exceed our limit
      } catch (error: any) {
        if (error.message?.includes('NOT_FOUND')) {
          throw new Error(`Repository ${repository.owner}/${repository.name} not found`) as NonRetriableError;
        }
        if (error.message?.includes('rate limit')) {
          throw new Error(`GraphQL rate limit hit for ${repository.owner}/${repository.name}. Please try again later.`);
        }
        
        console.warn(`GraphQL failed for ${repository.owner}/${repository.name}, this will trigger fallback to REST`);
        throw error;
      }
    });

    // Step 4: Store PRs in database
    const storedPRs = await step.run("store-prs", async () => {
      if (recentPRs.length === 0) {
        return [];
      }

      // First, ensure all contributors exist and get their UUIDs
      const contributorPromises = recentPRs.map((pr: any) => ensureContributorExists(pr.author));
      const contributorIds = await Promise.all(contributorPromises);

      // Then create PRs with proper UUIDs
      const prsToStore = recentPRs.map((pr: any, index: number) => ({
        github_id: pr.databaseId.toString(),
        repository_id: repositoryId,
        number: pr.number,
        title: pr.title,
        body: null, // Basic PR list doesn't include body
        state: pr.state?.toLowerCase() === 'open' ? 'open' : 
               pr.merged ? 'merged' : 'closed',
        author_id: contributorIds[index], // Now this is a proper UUID
        created_at: pr.createdAt,
        updated_at: pr.updatedAt,
        closed_at: pr.closedAt,
        merged_at: pr.mergedAt,
        draft: pr.isDraft || false,
        merged: pr.merged || false,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changedFiles || 0,
        commits: pr.commits?.totalCount || 0,
        base_branch: pr.baseRefName || 'main',
        head_branch: pr.headRefName || 'unknown',
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

    // Step 5: Prepare GraphQL job queue data (no nested steps)
    const jobsToQueue = await step.run("prepare-graphql-job-queue", async () => {
      const jobs = [] as any[];

      // Higher limit for GraphQL detail jobs due to efficiency
      const MAX_DETAIL_JOBS = 50; // Higher than REST due to single-query efficiency
      
      let detailJobsQueued = 0;

      for (const pr of storedPRs) {
        // Queue comprehensive GraphQL jobs for PRs that likely need more data
        const prData = recentPRs.find((p: any) => p.number === pr.number);
        
        if (!prData) continue;

        // Queue GraphQL detail jobs more liberally due to efficiency
        if (detailJobsQueued < MAX_DETAIL_JOBS) {
          jobs.push({
            name: "capture/pr.details.graphql",
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              priority,
            },
          });
          detailJobsQueued++;
        }

        if (detailJobsQueued >= MAX_DETAIL_JOBS) {
          console.log(`Reached GraphQL job queue limit (${MAX_DETAIL_JOBS}) for ${repository.owner}/${repository.name}`);
          break;
        }
      }

      return jobs;
    });

    // Step 6: Send GraphQL events for queued jobs (separate from preparation)
    const queuedJobs = await step.run("send-graphql-queued-events", async () => {
      const jobsQueued = {
        details: 0,
      };

      // Send GraphQL detail job events
      for (const job of jobsToQueue) {
        await step.sendEvent("pr-details-graphql", job);
        jobsQueued.details++;
      }

      return jobsQueued;
    });

    // Step 7: Update repository sync timestamp
    await step.run("update-sync-timestamp", async () => {
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

    // Get final metrics
    const metrics = graphqlClient.getMetrics();
    const rateLimit = graphqlClient.getRateLimit();

    return {
      success: true,
      repositoryId,
      repository: `${repository.owner}/${repository.name}`,
      method: 'graphql',
      prsFound: recentPRs.length,
      prsStored: storedPRs.length,
      jobsQueued: queuedJobs,
      reason,
      efficiency: {
        totalPointsUsed: metrics.totalPointsUsed,
        averagePointsPerQuery: metrics.averagePointsPerQuery,
        fallbackRate: `${metrics.fallbackRate.toFixed(1)}%`
      },
      rateLimit: rateLimit ? {
        remaining: rateLimit.remaining,
        limit: rateLimit.limit,
        resetAt: rateLimit.resetAt
      } : null
    };
  }
);