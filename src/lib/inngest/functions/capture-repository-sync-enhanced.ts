import { inngest } from "../client";
import { supabase } from "../../supabase";
import { NonRetriableError } from "inngest";
import { getGraphQLClient } from "../graphql-client";
import { RATE_LIMIT_CONFIG } from '../queue-manager';

// Constants
const MAX_PRS_PER_SYNC = 150;
const LARGE_REPO_THRESHOLD = 1000;
const DEFAULT_DAYS_LIMIT = 30;
const BACKFILL_SYNC_DAYS = 1; // Only sync 1 day when backfill is active

// Helper function to ensure a contributor exists
async function ensureContributorExists(author: any): Promise<string> {
  if (!author?.login) {
    throw new Error('Author login is required');
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert({
      github_id: author.databaseId?.toString() || author.id?.toString() || '0',
      username: author.login,
      avatar_url: author.avatarUrl || null,
      is_bot: author.__typename === 'Bot' || false,
    }, {
      onConflict: 'username',
      ignoreDuplicates: false,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to ensure contributor exists: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Failed to ensure contributor exists`);
  }
  return data.id;
}

export const captureRepositorySyncEnhanced = inngest.createFunction(
  {
    id: "capture-repository-sync-enhanced",
    name: "Enhanced Repository Sync with Backfill Support",
    concurrency: {
      limit: 5,
      key: "event.data.repositoryId",
    },
    throttle: { limit: 75, period: "1m" },
    retries: 2,
  },
  { event: "capture/repository.sync.enhanced" },
  async ({ event, step }) => {
    const { repositoryId, days, priority, reason } = event.data;
    
    // Step 1: Check if repository is being backfilled
    const backfillState = await step.run("check-backfill-state", async () => {
      const { data } = await supabase
        .from('progressive_backfill_state')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('status', 'active')
        .maybeSingle();
      
      return data;
    });
    
    // If backfill is active, only sync very recent data
    const effectiveDays = backfillState?.status === 'active' 
      ? BACKFILL_SYNC_DAYS 
      : Math.min(days || DEFAULT_DAYS_LIMIT, DEFAULT_DAYS_LIMIT);
    
    // Remove the 12-hour sync restriction for repositories being backfilled
    const shouldCheckSyncTime = !backfillState && reason !== 'manual';

    // Step 2: Get repository details
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, last_updated_at, pull_request_count')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`) as NonRetriableError;
      }

      // Check if repository was synced recently
      if (shouldCheckSyncTime && data.last_updated_at) {
        const lastSyncTime = new Date(data.last_updated_at).getTime();
        const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);
        
        if (hoursSinceSync < RATE_LIMIT_CONFIG.COOLDOWN_HOURS) {
          const timeAgo = hoursSinceSync < 1 
            ? `${Math.round(hoursSinceSync * 60)} minutes`
            : `${Math.round(hoursSinceSync)} hours`;
          throw new Error(`Repository ${data.owner}/${data.name} was synced ${timeAgo} ago. Skipping to prevent excessive API usage.`) as NonRetriableError;
        }
      }

      return data;
    });

    // Step 3: Check if we should initiate backfill for large repos
    const shouldInitiateBackfill = await step.run("check-initiate-backfill", async () => {
      // Skip if already being backfilled
      if (backfillState) {
        console.log(`Repository ${repository.owner}/${repository.name} is already being backfilled`);
        return false;
      }

      // Check repository size
      if (!repository.pull_request_count || repository.pull_request_count < 100) {
        return false; // Small repos don't need backfill
      }

      // Check data completeness
      const { count: capturedPRs } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId);
      
      const completeness = (capturedPRs || 0) / repository.pull_request_count;
      
      // Initiate backfill if less than 80% complete
      if (completeness < 0.8) {
        console.log(`Repository ${repository.owner}/${repository.name} is only ${Math.round(completeness * 100)}% complete, initiating backfill`);
        
        // Create backfill state
        const { error } = await supabase
          .from('progressive_backfill_state')
          .insert({
            repository_id: repositoryId,
            total_prs: repository.pull_request_count,
            processed_prs: capturedPRs || 0,
            status: 'active',
            chunk_size: 25,
            metadata: {
              initial_completeness: completeness,
              initiated_by: 'sync_function',
              reason: 'incomplete_data'
            }
          });

        if (!error) {
          // Queue backfill job to GitHub Actions
          await supabase
            .from('progressive_capture_jobs')
            .insert({
              job_type: 'progressive_backfill',
              repository_id: repositoryId,
              status: 'pending',
              processor_type: 'github_actions',
              metadata: {
                reason: 'auto_initiated',
                total_prs: repository.pull_request_count,
                current_completeness: completeness
              }
            });
          
          return true;
        }
      }
      
      return false;
    });

    // Step 4: Log repository size info
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

    // Step 5: Fetch recent PRs (limited window if backfill is active)
    const recentPRs = await step.run("fetch-recent-prs-graphql", async () => {
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();
      
      try {
        const client = getGraphQLClient();
        const prs = await client.getRecentPRs(
          repository.owner, 
          repository.name, 
          since, 
          MAX_PRS_PER_SYNC
        );

        console.log(`✅ GraphQL recent PRs query successful for ${repository.owner}/${repository.name} (${prs.length} PRs found)`);
        
        // Log rate limit info
        const rateLimit = client.getRateLimit();
        if (rateLimit) {
          console.log(`📊 GraphQL rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining (cost: ${rateLimit.cost} points)`);
        }

        return prs.slice(0, MAX_PRS_PER_SYNC);
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

    // Step 6: Store PRs in database
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

    // Step 7: Queue detail jobs (less aggressive if backfill is active)
    const jobsToQueue = await step.run("prepare-graphql-job-queue", async () => {
      const jobs = [] as any[];
      
      // Limit detail jobs if backfill is active
      const MAX_DETAIL_JOBS = backfillState ? 10 : 50;
      
      let detailJobsQueued = 0;

      for (const pr of storedPRs) {
        const prData = recentPRs.find((p: any) => p.number === pr.number);
        
        if (!prData) continue;

        // Only queue detail jobs for very recent or open PRs when backfill is active
        const isOpen = prData.state === 'OPEN';
        const isVeryRecent = new Date(prData.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        
        if (detailJobsQueued < MAX_DETAIL_JOBS && (isOpen || (!backfillState && isVeryRecent))) {
          jobs.push({
            name: "capture/pr.details.graphql",
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
          console.log(`Reached GraphQL job queue limit (${MAX_DETAIL_JOBS}) for ${repository.owner}/${repository.name}`);
          break;
        }
      }

      return jobs;
    });

    // Step 8: Send GraphQL events for queued jobs
    let detailsQueued = 0;
    for (const job of jobsToQueue) {
      await step.sendEvent(`pr-details-graphql-${detailsQueued}`, job);
      detailsQueued++;
    }

    // Step 9: Update repository sync timestamp
    await step.run("update-sync-timestamp", async () => {
      const { error } = await supabase
        .from('repositories')
        .update({
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', repositoryId);

      if (error) {
        console.error(`Failed to update repository sync timestamp: ${error.message}`);
      }
    });

    // Return summary
    const summary = {
      repository: `${repository.owner}/${repository.name}`,
      effectiveDays,
      backfillActive: !!backfillState,
      backfillInitiated: shouldInitiateBackfill,
      prsFound: recentPRs.length,
      prsStored: storedPRs.length,
      detailJobsQueued: detailsQueued,
      timestamp: new Date().toISOString(),
    };

    console.log(`✅ Enhanced repository sync completed:`, summary);
    
    return summary;
  }
);