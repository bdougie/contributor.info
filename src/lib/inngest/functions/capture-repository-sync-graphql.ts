import { inngest } from '../client';
import { supabase } from '../../supabase';
import { GraphQLClient } from '../graphql-client';
import type { NonRetriableError } from 'inngest';
import { getThrottleHours, QUEUE_CONFIG } from '../../progressive-capture/throttle-config';

// Rate limiting constants for GraphQL (more generous)
const MAX_PRS_PER_SYNC = QUEUE_CONFIG.maxPrsPerSync || 150; // Higher than REST due to efficiency
const LARGE_REPO_THRESHOLD = 1000;
const DEFAULT_DAYS_LIMIT = 30;

// GraphQL client instance - lazy initialization to avoid module load failures
let graphqlClient: GraphQLClient | null = null;

function getGraphQLClient(): GraphQLClient {
  if (!graphqlClient) {
    graphqlClient = new GraphQLClient();
  }
  return graphqlClient;
}

// Helper function to ensure contributors exist and return their UUIDs
async function ensureContributorExists(githubUser: any): Promise<string | null> {
  if (!githubUser || !githubUser.databaseId) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: githubUser.databaseId,
        username: githubUser.login,
        display_name: githubUser.name || null,
        email: githubUser.email || null,
        avatar_url: githubUser.avatarUrl || null,
        profile_url: `https://github.com/${githubUser.login}`,
        bio: githubUser.bio || null,
        company: githubUser.company || null,
        location: githubUser.location || null,
        blog: githubUser.blog || null,
        public_repos: githubUser.public_repos || 0,
        public_gists: githubUser.public_gists || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        github_created_at: githubUser.createdAt || new Date().toISOString(),
        is_bot: false, // GraphQL data doesn't include type, but we can infer from login
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

export const captureRepositorySyncGraphQL = inngest.createFunction(
  {
    id: 'capture-repository-sync-graphql',
    name: 'Sync Recent Repository PRs (GraphQL)',
    concurrency: {
      limit: 5, // Higher than REST due to better rate limits
      key: 'event.data.repositoryId',
    },
    throttle: { limit: 75, period: '1m' }, // More generous than REST
    retries: 2,
  },
  { event: 'capture/repository.sync.graphql' },
  async ({ event, step }) => {
    const { repositoryId, days, priority, reason } = event.data;

    // Validate repositoryId first
    if (!repositoryId) {
      console.error('Missing repositoryId in event data:', event.data);
      throw new Error(`Missing required field: repositoryId`) as NonRetriableError;
    }

    const effectiveDays = Math.min(days || DEFAULT_DAYS_LIMIT, DEFAULT_DAYS_LIMIT);

    // Step 1: Check if repository has active backfill
    const hasActiveBackfill = await step.run('check-active-backfill', async () => {
      const { data } = await supabase
        .from('progressive_backfill_state')
        .select('status')
        .eq('repository_id', repositoryId)
        .eq('status', 'active')
        .maybeSingle();

      return !!data;
    });

    // Step 2: Get repository details and check if it was recently processed
    const repository = await step.run('get-repository', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, last_updated_at')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`) as NonRetriableError;
      }

      // Check if repository was synced recently (skip based on reason and data completeness)
      if (data.last_updated_at && !hasActiveBackfill) {
        const lastSyncTime = new Date(data.last_updated_at).getTime();
        const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

        // Get throttle threshold based on reason
        const throttleHours = getThrottleHours(reason);

        // Check if we have actual data (PRs with reviews/comments)
        const { data: prData } = await supabase
          .from('pull_requests')
          .select('id')
          .eq('repository_id', repositoryId)
          .limit(10); // Check first 10 PRs

        const { count: reviewCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('repository_id', repositoryId);

        // Only check comments if we have PRs to check
        let commentCount = 0;
        if (prData && prData.length > 0) {
          const commentResult = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .in(
              'pull_request_id',
              prData.map((pr) => pr.id)
            );
          commentCount = commentResult.count || 0;
        }

        const hasCompleteData =
          prData && prData.length > 0 && ((reviewCount || 0) > 0 || commentCount > 0);

        // If data is incomplete, be more lenient with throttling
        const effectiveThrottleHours = hasCompleteData
          ? throttleHours
          : Math.min(throttleHours, 0.083); // 5 min max if no data

        // Only skip if we're within the throttle window
        if (hoursSinceSync < effectiveThrottleHours) {
          // But still allow if it's been less than 5 minutes and we have NO data at all
          if (!hasCompleteData && hoursSinceSync < 0.083) {
            console.log(
              'Repository %s/%s has no engagement data - allowing immediate sync',
              data.owner,
              data.name
            );
          } else {
            const timeAgo =
              hoursSinceSync < 1
                ? `${Math.round(hoursSinceSync * 60)} minutes`
                : `${Math.round(hoursSinceSync)} hours`;
            const dataStatus = hasCompleteData ? 'has complete data' : 'has incomplete data';
            throw new Error(
              `Repository ${data.owner}/${data.name} was synced ${timeAgo} ago and ${dataStatus}. Skipping to prevent excessive API usage.`
            ) as NonRetriableError;
          }
        }

        console.log(
          'Repository %s/%s sync allowed - reason: %s, last sync: %sh ago, has data: %s',
          data.owner,
          data.name,
          reason,
          hoursSinceSync.toFixed(2),
          hasCompleteData
        );
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

    // Step 3: Fetch recent PRs from GitHub using GraphQL
    const recentPRs = await step.run('fetch-recent-prs-graphql', async () => {
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();

      try {
        const client = getGraphQLClient();
        const prs = await client.getRecentPRs(
          repository.owner,
          repository.name,
          since,
          MAX_PRS_PER_SYNC
        );

        console.log(
          '✅ GraphQL recent PRs query successful for %s/%s (%s PRs found)',
          repository.owner,
          repository.name,
          prs.length
        );

        // Log and monitor rate limit info
        const rateLimit = client.getRateLimit();
        if (rateLimit) {
          console.log(
            '📊 GraphQL rate limit: %s/%s remaining (cost: %s points)',
            rateLimit.remaining,
            rateLimit.limit,
            rateLimit.cost
          );

          // Track rate limit usage with telemetry
          const { queueTelemetry } = await import('../../progressive-capture/queue-telemetry');
          // Default to 1 hour reset if not provided
          const resetTime = new Date(Date.now() + 3600 * 1000);
          queueTelemetry.trackRateLimit('graphql', rateLimit.remaining, rateLimit.limit, resetTime);
        }

        return prs.slice(0, MAX_PRS_PER_SYNC); // Ensure we don't exceed our limit
      } catch (error: any) {
        if (error.message?.includes('NOT_FOUND')) {
          throw new Error(
            `Repository ${repository.owner}/${repository.name} not found`
          ) as NonRetriableError;
        }
        if (error.message?.includes('rate limit')) {
          throw new Error(
            `GraphQL rate limit hit for ${repository.owner}/${repository.name}. Please try again later.`
          );
        }

        console.warn(
          `GraphQL failed for ${repository.owner}/${repository.name}, this will trigger fallback to REST`
        );
        throw error;
      }
    });

    // Step 4: Store PRs in database
    const storedPRs = await step.run('store-prs', async () => {
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
        state: pr.state?.toLowerCase() === 'open' ? 'open' : pr.merged ? 'merged' : 'closed',
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
    const jobsToQueue = await step.run('prepare-graphql-job-queue', async () => {
      const jobs = [] as any[];

      // Higher limit for GraphQL detail jobs due to efficiency
      const MAX_DETAIL_JOBS = 50; // Higher than REST due to single-query efficiency

      let detailJobsQueued = 0;

      for (const pr of storedPRs) {
        // Queue comprehensive GraphQL jobs for PRs that likely need more data
        const prData = recentPRs.find((p: any) => p.number === pr.number);

        if (!prData) continue;

        // Check if this PR needs comment/review data
        const { count: existingComments } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('pull_request_id', pr.id);

        const { count: existingReviews } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('pull_request_id', pr.id);

        // Queue if: PR is open, has recent activity, or has no comments/reviews yet
        const isOpen = prData.state === 'OPEN';
        const hasNoComments = (existingComments || 0) === 0;
        const hasNoReviews = (existingReviews || 0) === 0;
        const isRecent =
          new Date(prData.updatedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;

        if (
          detailJobsQueued < MAX_DETAIL_JOBS &&
          (isOpen || hasNoComments || hasNoReviews || isRecent)
        ) {
          jobs.push({
            name: 'capture/pr.details.graphql',
            data: {
              repositoryId,
              prNumber: pr.number.toString(),
              prId: pr.id,
              priority: isOpen ? 'high' : priority,
            },
          });
          detailJobsQueued++;
        }

        if (detailJobsQueued >= MAX_DETAIL_JOBS) {
          console.log(
            'Reached GraphQL job queue limit (%s) for %s/%s',
            MAX_DETAIL_JOBS,
            repository.owner,
            repository.name
          );
          break;
        }
      }

      return jobs;
    });

    // Step 6: Send GraphQL events for queued jobs
    // Note: step.sendEvent must be called outside of step.run to avoid nested step tooling
    let detailsQueued = 0;
    for (const job of jobsToQueue) {
      await step.sendEvent(`pr-details-graphql-${detailsQueued}`, job);
      detailsQueued++;
    }

    const queuedJobs = {
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

    // Get final metrics
    const client = getGraphQLClient();
    const metrics = client.getMetrics();
    const rateLimit = client.getRateLimit();

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
        fallbackRate: `${metrics.fallbackRate.toFixed(1)}%`,
      },
      rateLimit: rateLimit
        ? {
            remaining: rateLimit.remaining,
            limit: rateLimit.limit,
            resetAt: rateLimit.resetAt,
          }
        : null,
    };
  }
);
