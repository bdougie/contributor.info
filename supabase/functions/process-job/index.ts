import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

// Import job processors
import { GraphQLClient } from '../inngest-prod/graphql-client.ts';
import { RepositorySizeClassifier } from '../inngest-prod/repository-classifier.ts';

// Type definitions for job payloads
interface RepositorySyncPayload {
  repositoryId?: string;
  owner: string;
  repo?: string;
  name?: string;
  repository?: string;
  days?: number;
  daysLimit?: number;
  fullSync?: boolean;
}

interface PRDetailsPayload {
  owner?: string;
  repo?: string;
  name?: string;
  repository?: string;
  prNumbers: number[];
}

interface WebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  pull_request?: Record<string, unknown>;
  issue?: Record<string, unknown>;
  [key: string]: unknown;
}

type JobPayload = RepositorySyncPayload | PRDetailsPayload | WebhookPayload;

interface JobResult {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GitHub token
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN') || '';

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // Number of consecutive failures to open circuit
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute cooldown
const circuitBreakers = new Map<
  string,
  {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  }
>();

console.log('Job processor starting with circuit breaker protection...');

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify authorization
  const authHeader = req.headers.get('Authorization');
  const apiKey = req.headers.get('x-api-key');

  // Check for service role key in Authorization header or API key
  if (!authHeader?.includes(supabaseServiceKey) && apiKey !== supabaseServiceKey) {
    // Also allow internal Supabase calls (from other Edge Functions or database)
    const isInternalCall = req.headers.get('x-forwarded-host')?.includes('supabase.co');
    if (!isInternalCall) {
      console.error('Unauthorized request to process-job function');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const { jobId, immediate } = await req.json();

    if (!jobId) {
      // Process next queued job
      const { data: nextJob, error } = await supabase.rpc('get_next_job');

      if (error || !nextJob || nextJob.length === 0) {
        return new Response(JSON.stringify({ message: 'No jobs in queue' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const job = nextJob[0];
      processJob(job.id, job.type, job.payload);

      return new Response(JSON.stringify({ jobId: job.id, status: 'processing' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process specific job
    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If immediate flag is set, wait for completion
    if (immediate) {
      const result = await processJobSync(job.id, job.type, job.payload);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Otherwise, process async
    processJob(job.id, job.type, job.payload);

    return new Response(JSON.stringify({ jobId: job.id, status: 'processing' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in job processor:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Async job processing (fire and forget)
async function processJob(jobId: string, type: string, payload: JobPayload) {
  try {
    await processJobSync(jobId, type, payload);
  } catch (error) {
    console.error(`Job ${jobId} processing failed:`, error);
  }
}

// Check circuit breaker status
function checkCircuitBreaker(jobType: string): { isOpen: boolean; reason?: string } {
  const breaker = circuitBreakers.get(jobType);
  if (!breaker) return { isOpen: false };

  // Check if circuit is open and if timeout has passed
  if (breaker.isOpen) {
    const timeSinceLastFailure = Date.now() - breaker.lastFailure;
    if (timeSinceLastFailure > CIRCUIT_BREAKER_TIMEOUT_MS) {
      // Reset circuit breaker
      breaker.isOpen = false;
      breaker.failures = 0;
      console.log(`Circuit breaker for ${jobType} reset after cooldown`);
      return { isOpen: false };
    }
    return {
      isOpen: true,
      reason: `Circuit breaker open for ${jobType}: ${breaker.failures} consecutive failures`,
    };
  }

  return { isOpen: false };
}

// Update circuit breaker on failure
function recordCircuitBreakerFailure(jobType: string) {
  let breaker = circuitBreakers.get(jobType);
  if (!breaker) {
    breaker = { failures: 0, lastFailure: 0, isOpen: false };
    circuitBreakers.set(jobType, breaker);
  }

  breaker.failures++;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.isOpen = true;
    console.error(`Circuit breaker opened for ${jobType} after ${breaker.failures} failures`);
  }
}

// Reset circuit breaker on success
function recordCircuitBreakerSuccess(jobType: string) {
  const breaker = circuitBreakers.get(jobType);
  if (breaker) {
    breaker.failures = 0;
    breaker.isOpen = false;
  }
}

// Synchronous job processing
async function processJobSync(
  jobId: string,
  type: string,
  payload: JobPayload,
): Promise<JobResult> {
  const startTime = Date.now();

  // Check circuit breaker before processing
  const circuitStatus = checkCircuitBreaker(type);
  if (circuitStatus.isOpen) {
    console.error(`Circuit breaker preventing job ${jobId} execution: ${circuitStatus.reason}`);

    // Mark job as failed due to circuit breaker
    await supabase
      .from('background_jobs')
      .update({
        status: 'failed',
        error: circuitStatus.reason,
        failed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw new Error(circuitStatus.reason);
  }

  // Update job status to processing
  await supabase
    .from('background_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  try {
    console.log(`Processing job ${jobId} of type ${type}`);

    let result: JobResult = {};

    // Route to appropriate processor based on job type
    switch (type) {
      // Inngest job types
      case 'capture/repository.sync.graphql': {
        const { repositoryId, owner, repo, days = 30 } = payload;
        result = await syncRepositoryWithGraphQL(repositoryId, owner, repo, days);
        break;
      }

      case 'classify/repository.single': {
        const { repositoryId, owner, repo } = payload;
        result = await classifyRepositorySize(repositoryId, owner, repo);
        break;
      }

      case 'capture/pr.details.graphql': {
        const { owner, repo, prNumbers } = payload;
        result = await fetchPullRequestDetails(owner, repo, prNumbers);
        break;
      }

      // Sync-router job types
      case 'sync-router/repository.sync': {
        const { repository, owner, name, fullSync, daysLimit = 30 } = payload;
        const [repoOwner, repoName] = repository ? repository.split('/') : [owner, name];
        result = await syncRepositoryBasic(repoOwner, repoName, fullSync, daysLimit);
        break;
      }

      case 'sync-router/repository.sync.graphql': {
        const { repository, owner, name, fullSync, daysLimit = 30 } = payload;
        const [repoOwner, repoName] = repository ? repository.split('/') : [owner, name];

        // Look up repository ID
        const { data: repoData } = await supabase
          .from('repositories')
          .select('id')
          .eq('full_name', `${repoOwner}/${repoName}`)
          .single();

        if (repoData?.id) {
          result = await syncRepositoryWithGraphQL(repoData.id, repoOwner, repoName, daysLimit);
        } else {
          // Create repository record if it doesn't exist
          const { data: newRepo } = await supabase
            .from('repositories')
            .insert({
              full_name: `${repoOwner}/${repoName}`,
              owner: repoOwner,
              name: repoName,
              first_tracked_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (newRepo) {
            result = await syncRepositoryWithGraphQL(newRepo.id, repoOwner, repoName, daysLimit);
          } else {
            throw new Error(`Failed to create repository record for ${repoOwner}/${repoName}`);
          }
        }
        break;
      }

      case 'sync-router/pr.details.batch': {
        const { repository, owner, name, prNumbers } = payload;
        const [repoOwner, repoName] = repository ? repository.split('/') : [owner, name];
        result = await fetchPullRequestDetails(repoOwner, repoName, prNumbers);
        break;
      }

      // Webhook job types - delegate to webhook processor
      case 'webhook/pull_request':
      case 'webhook/issues':
      case 'webhook/push':
      case 'webhook/repository': {
        // These are processed by process-webhook function
        // This is a fallback if they somehow end up here
        console.log(`Webhook job ${type} should be processed by process-webhook function`);
        result = await processWebhookFallback(type, payload);
        break;
      }

      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    const duration = Date.now() - startTime;

    // Update job as completed
    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`Job ${jobId} completed in ${duration}ms`);

    // Record success for circuit breaker
    recordCircuitBreakerSuccess(type);

    return { success: true, result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Job ${jobId} failed after ${duration}ms:`, error);

    // Record failure for circuit breaker
    recordCircuitBreakerFailure(type);

    // Update job as failed
    await supabase
      .from('background_jobs')
      .update({
        status: 'failed',
        error: errorMessage,
        failed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Check if we should retry
    const { data: job } = await supabase
      .from('background_jobs')
      .select('retry_count, max_retries')
      .eq('id', jobId)
      .single();

    if (job && job.retry_count < job.max_retries) {
      // Schedule retry
      await supabase.rpc('retry_failed_job', { job_id: jobId });
      console.log(
        `Job ${jobId} scheduled for retry (attempt ${job.retry_count + 1}/${job.max_retries})`,
      );
    }

    throw error;
  }
}

// Job processor implementations
async function syncRepositoryWithGraphQL(
  repositoryId: string,
  owner: string,
  repo: string,
  days: number,
): Promise<JobResult> {
  console.log(`Syncing repository ${owner}/${repo} for last ${days} days`);

  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not configured');
  }

  const client = new GraphQLClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Fetch recent PRs
  const prs = await client.getRecentPRs(owner, repo, since.toISOString(), 100);

  // Store PRs in database
  const prRecords = prs.map((pr) => ({
    repository_id: repositoryId,
    pr_number: pr.number,
    github_id: pr.databaseId,
    title: pr.title,
    state: pr.state,
    is_draft: pr.isDraft,
    created_at: pr.createdAt,
    updated_at: pr.updatedAt,
    closed_at: pr.closedAt,
    merged_at: pr.mergedAt,
    author_login: pr.author?.login,
    author_id: pr.author?.databaseId,
    base_branch: pr.baseRefName,
    head_branch: pr.headRefName,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changedFiles,
    commit_count: pr.commits?.totalCount || 0,
  }));

  // Upsert PRs
  const { error: prError } = await supabase.from('pull_requests').upsert(prRecords, {
    onConflict: 'repository_id,pr_number',
    ignoreDuplicates: false,
  });

  if (prError) {
    console.error('Error upserting PRs:', prError);
    throw prError;
  }

  // Update repository sync status
  await supabase
    .from('repositories')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: 'completed',
      total_pull_requests: prRecords.length,
    })
    .eq('id', repositoryId);

  // Get metrics
  const metrics = client.getMetrics();

  return {
    repositoryId,
    prsProcessed: prRecords.length,
    metrics,
    duration: new Date().toISOString(),
  };
}

async function classifyRepositorySize(
  repositoryId: string,
  owner: string,
  repo: string,
): Promise<JobResult> {
  console.log(`Classifying repository size for ${owner}/${repo}`);

  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not configured');
  }

  const classifier = new RepositorySizeClassifier(GITHUB_TOKEN);
  const size = await classifier.classifyAndUpdateRepository(repositoryId, owner, repo);

  return {
    repositoryId,
    size,
    classified_at: new Date().toISOString(),
  };
}

async function fetchPullRequestDetails(
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<JobResult> {
  console.log(`Fetching details for ${prNumbers.length} PRs from ${owner}/${repo}`);

  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not configured');
  }

  const client = new GraphQLClient();
  const details = [];

  for (const prNumber of prNumbers) {
    try {
      const pr = await client.getPRDetails(owner, repo, prNumber);
      details.push(pr);
    } catch (error) {
      console.error(`Failed to fetch PR #${prNumber}:`, error);
    }
  }

  return {
    owner,
    repo,
    fetched: details.length,
    total: prNumbers.length,
    details,
  };
}

// Basic repository sync using REST API (fallback for non-GraphQL sync)
async function syncRepositoryBasic(
  owner: string,
  repo: string,
  fullSync: boolean,
  daysLimit: number,
): Promise<JobResult> {
  console.log(
    `Basic sync for ${owner}/${repo} (${fullSync ? 'full' : 'partial'}, ${daysLimit} days)`,
  );

  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not configured');
  }

  // For now, use the GraphQL client as fallback
  // In production, this would use REST API endpoints
  const client = new GraphQLClient();
  const since = new Date();
  since.setDate(since.getDate() - daysLimit);

  // Look up or create repository record
  let repositoryId: string;

  const { data: repoData } = await supabase
    .from('repositories')
    .select('id')
    .eq('full_name', `${owner}/${repo}`)
    .single();

  if (repoData?.id) {
    repositoryId = repoData.id;
  } else {
    // Create repository record
    const { data: newRepo, error: createError } = await supabase
      .from('repositories')
      .insert({
        full_name: `${owner}/${repo}`,
        owner,
        name: repo,
        first_tracked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !newRepo) {
      throw new Error(`Failed to create repository: ${createError?.message}`);
    }

    repositoryId = newRepo.id;
  }

  // Fetch PRs using existing GraphQL method
  const prs = await client.getRecentPRs(owner, repo, since.toISOString(), fullSync ? 500 : 100);

  // Store basic PR data
  if (prs.length > 0) {
    const prRecords = prs.map((pr) => ({
      repository_id: repositoryId,
      pr_number: pr.number,
      title: pr.title,
      state: pr.state,
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      author_login: pr.author?.login,
    }));

    await supabase.from('pull_requests').upsert(prRecords, {
      onConflict: 'repository_id,pr_number',
      ignoreDuplicates: false,
    });
  }

  return {
    repositoryId,
    repository: `${owner}/${repo}`,
    pullRequests: prs.length,
    syncType: fullSync ? 'full' : 'partial',
    daysLimit,
    completed: new Date().toISOString(),
  };
}

// Fallback webhook processor (simplified version)
async function processWebhookFallback(type: string, payload: WebhookPayload): Promise<JobResult> {
  const { event: githubEvent, data } = payload;
  console.log(`Processing webhook fallback: ${githubEvent}`);

  // Basic processing - just acknowledge the webhook
  // Real processing happens in process-webhook function
  return {
    processed: true,
    type: githubEvent,
    message: 'Webhook processed (fallback handler)',
    timestamp: new Date().toISOString(),
  };
}
