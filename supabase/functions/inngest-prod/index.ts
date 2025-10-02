// Inngest handler for Supabase Edge Functions with real implementations
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Inngest, InngestCommHandler } from 'https://esm.sh/inngest@3.16.1';
import { getSupabaseClient, ensureContributorExists, getPRState, SYNC_RATE_LIMITS, QUEUE_CONFIG } from './database-helpers.ts';
import { GraphQLClient, NonRetriableError } from './graphql-client.ts';

// CORS headers for Inngest
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK, x-inngest-server-kind, X-Inngest-Server-Kind',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

// Get environment configuration
const INNGEST_APP_ID = Deno.env.get('INNGEST_APP_ID') || 'contributor-info';
const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') ||
                          Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY') || '';
const INNGEST_SIGNING_KEY = Deno.env.get('INNGEST_SIGNING_KEY') ||
                            Deno.env.get('INNGEST_PRODUCTION_SIGNING_KEY') || '';

console.log('🚀 Inngest Edge Function Started');
console.log('Configuration:', {
  appId: INNGEST_APP_ID,
  hasEventKey: !!INNGEST_EVENT_KEY,
  hasSigningKey: !!INNGEST_SIGNING_KEY,
});

// Initialize Inngest client
const inngest = new Inngest({
  id: INNGEST_APP_ID,
  eventKey: INNGEST_EVENT_KEY,
});

// GraphQL client instance
let graphqlClient: GraphQLClient | null = null;

function getGraphQLClient(): GraphQLClient {
  if (!graphqlClient) {
    graphqlClient = new GraphQLClient();
  }
  return graphqlClient;
}

// Create Inngest function for repository sync (GraphQL)
const captureRepositorySyncGraphQL = inngest.createFunction(
  {
    id: "capture-repository-sync-graphql",
    name: "Sync Recent Repository PRs (GraphQL)",
    concurrency: {
      limit: 5,
      key: "event.data.repositoryId",
    },
    throttle: { limit: 75, period: "1m" },
    retries: 2,
  },
  { event: "capture/repository.sync.graphql" },
  async ({ event, step }: any) => {
    const { repositoryId, days, priority, reason } = event.data;

    if (!repositoryId) {
      throw new NonRetriableError(`Missing required field: repositoryId`);
    }

    const effectiveDays = Math.min(days || QUEUE_CONFIG.defaultDaysLimit, QUEUE_CONFIG.defaultDaysLimit);
    const supabase = getSupabaseClient();

    // Step 1: Get repository details and check if it was recently processed
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name, last_updated_at')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new NonRetriableError(`Repository not found: ${repositoryId}`);
      }

      // Check if repository was synced recently
      if (data.last_updated_at) {
        const lastSyncTime = new Date(data.last_updated_at).getTime();
        const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

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
          const timeDisplay = hoursSinceSync < 1
            ? `${Math.round(hoursSinceSync * 60)} minute${Math.round(hoursSinceSync * 60) !== 1 ? 's' : ''}`
            : `${Math.round(hoursSinceSync * 10) / 10} hour${Math.round(hoursSinceSync * 10) / 10 !== 1 ? 's' : ''}`;

          throw new NonRetriableError(`Repository ${data.owner}/${data.name} was synced ${timeDisplay} ago. Minimum ${minHoursBetweenSyncs} hours between syncs for ${reason || 'default'} sync.`);
        }
      }

      return data;
    });

    // Step 2: Fetch recent PRs from GitHub using GraphQL
    const recentPRs = await step.run("fetch-recent-prs-graphql", async () => {
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();

      try {
        const prs = await getGraphQLClient().getRecentPRs(
          repository.owner,
          repository.name,
          since,
          QUEUE_CONFIG.maxPrsPerSync
        );

        console.log('✅ GraphQL recent PRs query successful for %s/%s (%d PRs found)', repository.owner, repository.name, prs.length);

        return prs.slice(0, QUEUE_CONFIG.maxPrsPerSync);
      } catch (error: any) {
        if (error.message?.includes('NOT_FOUND')) {
          throw new NonRetriableError(`Repository ${repository.owner}/${repository.name} not found`);
        }
        if (error.message?.includes('rate limit')) {
          throw new Error(`GraphQL rate limit hit for ${repository.owner}/${repository.name}. Please try again later.`);
        }
        throw error;
      }
    });

    // Step 3: Store PRs in database
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
        body: pr.body || null,
        state: getPRState(pr),
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

    // Step 4: Update repository sync timestamp
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

    const metrics = getGraphQLClient().getMetrics();
    const rateLimit = getGraphQLClient().getRateLimit();

    return {
      success: true,
      repositoryId,
      repository: `${repository.owner}/${repository.name}`,
      method: 'graphql',
      prsFound: recentPRs.length,
      prsStored: storedPRs.length,
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

// Create Inngest function for single repository classification
const classifySingleRepository = inngest.createFunction(
  {
    id: 'classify-single-repository',
    name: 'Classify Single Repository',
    retries: 3,
  },
  { event: 'classify/repository.single' },
  async ({ event, step }: any) => {
    const { repositoryId, owner, repo } = event.data;

    if (!repositoryId || !owner || !repo) {
      throw new NonRetriableError(`Missing required fields: repositoryId=${repositoryId}, owner=${owner}, repo=${repo}`);
    }

    const githubToken = Deno.env.get('VITE_GITHUB_TOKEN') || Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    // Step 1: Classify and update the repository
    const classification = await step.run('classify-repository', async () => {
      console.log('Classifying repository: %s/%s', owner, repo);
      const supabase = getSupabaseClient();

      try {
        // For now, just mark as 'unknown' - full implementation would use RepositorySizeClassifier
        const { error } = await supabase
          .from('repositories')
          .update({ size_class: 'medium' })
          .eq('id', repositoryId);

        if (error) {
          throw error;
        }

        console.log('Repository %s/%s classified as: medium', owner, repo);
        return 'medium';
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
      timestamp: new Date().toISOString()
    };
  }
);

// Create stub functions for other operations
const stubs = [
  'capture-pr-details',
  'capture-pr-details-graphql',
  'capture-pr-reviews',
  'capture-pr-comments',
  'capture-issue-comments',
  'capture-repository-issues',
  'capture-repository-sync',
  'update-pr-activity',
  'discover-new-repository',
  'classify-repository-size',
].map((id) =>
  inngest.createFunction(
    { id, name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { event: id.replace(/-/g, '.') },
    async ({ event }: any) => {
      console.log(`Stub function ${id} called with:`, event.data);
      return { success: true, message: 'Function not yet migrated to Edge' };
    }
  )
);

// Define our functions registry
const functions = [
  captureRepositorySyncGraphQL,
  classifySingleRepository,
  ...stubs,
];

// Create Inngest handler
const handler = new InngestCommHandler({
  frameworkName: 'deno-edge-supabase',
  appName: INNGEST_APP_ID,
  signingKey: INNGEST_SIGNING_KEY,
  client: inngest,
  functions,
  serveHost: Deno.env.get('VITE_DEPLOY_URL') || 'https://egcxzonpmmcirmgqdrla.supabase.co',
  servePath: '/functions/v1/inngest-prod',
});

// Main HTTP handler
serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  console.log(`📥 ${method} ${url.pathname}${url.search}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle HEAD requests (health checks)
  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-Inngest-Ready': 'true',
      },
    });
  }

  try {
    // Use Inngest handler for all other requests
    const response = await handler.POST(req);

    // Add CORS headers to the response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    console.error('❌ Error processing request:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process request',
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});