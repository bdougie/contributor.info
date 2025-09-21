import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { GraphQLClient } from './graphql-client.ts';
import { RepositorySizeClassifier } from './repository-classifier.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rate limiting constants for GraphQL
const MAX_PRS_PER_SYNC = 150;
const LARGE_REPO_THRESHOLD = 1000;
const DEFAULT_DAYS_LIMIT = 30;

// Sync rate limiting constants (in hours)
const SYNC_RATE_LIMITS = {
  DEFAULT: 12,
  SCHEDULED: 2,
  PR_ACTIVITY: 1,
  MANUAL: 5 / 60, // 5-minute cooldown for manual syncs
  AUTO_FIX: 1,
} as const;

// GraphQL client instance
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
    .upsert({
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
      is_bot: false,
      is_active: true,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    }, {
      onConflict: 'github_id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error upserting contributor:', error);
    return null;
  }

  return data.id;
}

// Export function creator for single repository classification
export function createClassifySingleRepository(inngest: any) {
  return inngest.createFunction(
    {
      id: 'classify-single-repository',
      name: 'Classify Single Repository',
      retries: 3,
    },
    { event: 'classify/repository.single' },
    async ({ event, step }: any) => {
      const { repositoryId, owner, repo } = event.data;

      // Validate required fields
      if (!repositoryId || !owner || !repo) {
        console.error('Missing required fields in event data:', event.data);
        throw new Error(`Missing required fields: repositoryId=${repositoryId}, owner=${owner}, repo=${repo}`);
      }

      // Initialize classifier
      const githubToken = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN');
      if (!githubToken) {
        throw new Error('GitHub token not configured');
      }

      const classifier = new RepositorySizeClassifier(githubToken);

      // Step 1: Classify and update the repository
      const classification = await step.run('classify-repository', async () => {
        console.log('Classifying repository: %s/%s', owner, repo);

        try {
          // Use the classifier to classify and update the repository
          const size = await classifier.classifyAndUpdateRepository(repositoryId, owner, repo);

          console.log('Repository %s/%s classified as: %s', owner, repo, size);
          return size;
        } catch (error: any) {
          console.error(`Failed to classify repository ${owner}/${repo}:`, error);
          throw error;
        }
      });

      return {
        success: true,
        repositoryId,
        repository: `${owner}/${repo}`,
        classification,
        timestamp: new Date().toISOString(),
      };
    }
  );
}

// Export function creator for GraphQL repository sync
export function createCaptureRepositorySyncGraphQL(inngest: any) {
  return inngest.createFunction(
    {
      id: 'capture-repository-sync-graphql',
      name: 'Sync Recent Repository PRs (GraphQL)',
      concurrency: {
        limit: 5,
        key: 'event.data.repositoryId',
      },
      throttle: { limit: 75, period: '1m' },
      retries: 2,
    },
    { event: 'capture/repository.sync.graphql' },
    async ({ event, step }: any) => {
      const { repositoryId, days, priority, reason } = event.data;

      // Validate repositoryId
      if (!repositoryId) {
        console.error('Missing repositoryId in event data:', event.data);
        throw new Error('Missing required field: repositoryId');
      }

      const effectiveDays = Math.min(days || DEFAULT_DAYS_LIMIT, DEFAULT_DAYS_LIMIT);

      // Step 1: Get repository details and check if it was recently processed
      const repository = await step.run('get-repository', async () => {
        const { data, error } = await supabase
          .from('repositories')
          .select('owner, name, last_updated_at')
          .eq('id', repositoryId)
          .single();

        if (error || !data) {
          throw new Error(`Repository not found: ${repositoryId}`);
        }

        // Check if repository was synced recently
        if (data.last_updated_at) {
          const lastSyncTime = new Date(data.last_updated_at).getTime();
          const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

          // Different thresholds based on sync reason
          let minHoursBetweenSyncs = SYNC_RATE_LIMITS.DEFAULT;

          if (reason === 'scheduled') {
            minHoursBetweenSyncs = SYNC_RATE_LIMITS.SCHEDULED;
          } else if (reason === 'pr-activity') {
            minHoursBetweenSyncs = SYNC_RATE_LIMITS.PR_ACTIVITY;
          } else if (reason === 'manual') {
            minHoursBetweenSyncs = SYNC_RATE_LIMITS.MANUAL;
          } else if (reason === 'auto-fix') {
            minHoursBetweenSyncs = SYNC_RATE_LIMITS.AUTO_FIX;
          }

          if (hoursSinceSync < minHoursBetweenSyncs) {
            let timeDisplay: string;
            if (hoursSinceSync < 1) {
              const minutesSinceSync = Math.round(hoursSinceSync * 60);
              timeDisplay = `${minutesSinceSync} minute${minutesSinceSync !== 1 ? 's' : ''}`;
            } else {
              const roundedHours = Math.round(hoursSinceSync * 10) / 10;
              timeDisplay = `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`;
            }

            throw new Error(
              `Repository ${data.owner}/${data.name} was synced ${timeDisplay} ago. ` +
              `Skipping to prevent excessive API usage (minimum ${minHoursBetweenSyncs} hours between syncs for ${reason || 'default'} sync).`
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
          console.warn(`Large repository detected: ${repository.owner}/${repository.name} has ${prCount} PRs`);
        }

        return { prCount: prCount || 0 };
      });

      // Step 3: Fetch recent PRs from GitHub using GraphQL
      const recentPRs = await step.run('fetch-recent-prs-graphql', async () => {
        const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();

        try {
          const prs = await getGraphQLClient().getRecentPRs(
            repository.owner,
            repository.name,
            since,
            MAX_PRS_PER_SYNC
          );

          console.log('✅ GraphQL recent PRs query successful for %s/%s (%d PRs found)',
            repository.owner, repository.name, prs.length);

          // Log rate limit info
          const rateLimit = getGraphQLClient().getRateLimit();
          if (rateLimit) {
            console.log('📊 GraphQL rate limit: %d/%d remaining (cost: %d points)',
              rateLimit.remaining, rateLimit.limit, rateLimit.cost);
          }

          return prs.slice(0, MAX_PRS_PER_SYNC);
        } catch (error: any) {
          if (error.message?.includes('NOT_FOUND')) {
            throw new Error(`Repository ${repository.owner}/${repository.name} not found`);
          }
          if (error.message?.includes('rate limit')) {
            throw new Error(`GraphQL rate limit hit for ${repository.owner}/${repository.name}. Please try again later.`);
          }

          console.warn(`GraphQL failed for ${repository.owner}/${repository.name}, this will trigger fallback to REST`);
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
          state: pr.state?.toLowerCase() === 'open' ? 'open' :
                 pr.merged ? 'merged' : 'closed',
          author_id: contributorIds[index],
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

      // Step 5: Prepare GraphQL job queue data
      const jobsToQueue = await step.run('prepare-graphql-job-queue', async () => {
        const jobs = [] as any[];
        const MAX_DETAIL_JOBS = 50;

        let detailJobsQueued = 0;

        for (const pr of storedPRs) {
          const prData = recentPRs.find((p: any) => p.number === pr.number);

          if (!prData) continue;

          if (detailJobsQueued < MAX_DETAIL_JOBS) {
            jobs.push({
              name: 'capture/pr.details.graphql',
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
            console.log('Reached GraphQL job queue limit (%d) for %s/%s',
              MAX_DETAIL_JOBS, repository.owner, repository.name);
            break;
          }
        }

        return jobs;
      });

      // Step 6: Send GraphQL events for queued jobs
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
      const metrics = getGraphQLClient().getMetrics();
      const rateLimit = getGraphQLClient().getRateLimit();

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
        rateLimit: rateLimit ? {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt,
        } : null,
      };
    }
  );
}