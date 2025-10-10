/**
 * Process Webhook Edge Function
 * 
 * Processes queued webhook events by retrieving job details from the database
 * and forwarding them to Inngest for asynchronous processing. This function
 * acts as a bridge between Supabase database and Inngest event system.
 * 
 * Workflow:
 * 1. Receives job ID from request
 * 2. Fetches job details from background_jobs table
 * 3. Validates job status and payload
 * 4. Sends event to Inngest for processing
 * 5. Updates job status in database
 * 
 * @example
 * POST /functions/v1/process-webhook
 * {
 *   "jobId": "uuid-of-background-job"
 * }
 * 
 * @returns
 * {
 *   "success": true,
 *   "result": { ... }
 * }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createSupabaseClient } from '../_shared/database.ts';
import { corsPreflightResponse, legacySuccessResponse, errorResponse, validationError, notFoundError, handleError } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Inngest client for sending events
const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') || '';
const INNGEST_BASE_URL = 'https://inn.gs';

async function sendInngestEvent(event: any) {
  if (!INNGEST_EVENT_KEY) {
    console.warn('No Inngest event key configured');
    return;
  }

  const response = await fetch(`${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to send Inngest event: ${response.status}`);
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  // Initialize Supabase client per request
  const supabase = createSupabaseClient();

  try {
    const { jobId } = await req.json();

        if (!jobId) {
      return validationError('Missing job ID', 'Job ID is required for processing');
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

        if (jobError || !job) {
      return notFoundError('Job', `Job with ID ${jobId} not found`);
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
      const result = await processWebhookJob(job.payload, supabase);

      // Update job as completed
      await supabase
        .from('background_jobs')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return legacySuccessResponse(result, 'Webhook job processed successfully');
    } catch (error: any) {
      console.error(`Job ${jobId} failed:`, error);

      // Update job as failed
      await supabase
        .from('background_jobs')
        .update({
          status: 'failed',
          error: error.message,
          failed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

            throw error;
    }
  } catch (error: any) {
    return handleError(error, 'webhook processor');
  }
});

/**
 * Process webhook job with 150s timeout available
 */
async function processWebhookJob(payload: any, supabase: any): Promise<any> {
  const { event: githubEvent, action, data } = payload;

  console.log(`Processing webhook: ${githubEvent} (${action})`);

  switch (githubEvent) {
        case 'pull_request':
      return await processPullRequestEvent(data, action, supabase);

    case 'issues':
      return await processIssueEvent(data, action, supabase);

    case 'push':
      return await processPushEvent(data, supabase);

    case 'repository':
      return await processRepositoryEvent(data, action, supabase);

    default:
      console.log(`Unhandled webhook event: ${githubEvent}`);
      return { message: `Event ${githubEvent} not processed` };
  }
}

async function processPullRequestEvent(event: any, action: string, supabase: any) {
  const pullRequest = event.pull_request;
  const repository = event.repository;

  if (!pullRequest || !repository) {
    throw new Error('Invalid pull request webhook payload');
  }

  // Check if repository exists
  const { data: repo } = await supabase
    .from('repositories')
    .select('id')
    .eq('github_id', repository.id)
    .single();

  if (!repo) {
    return { message: 'Repository not tracked' };
  }

  // Find affected workspaces
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('workspace_id')
    .eq('repository_id', repo.id);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return { message: 'Repository not in any workspace' };
  }

  console.log(`PR event affects ${workspaceRepos.length} workspaces`);

  // Process each workspace
  const results = [];

  for (const wr of workspaceRepos) {
    try {
      // Mark cache as stale
      await supabase.rpc('mark_workspace_cache_stale', {
        p_workspace_id: wr.workspace_id,
      });

      // Send Inngest events for high-priority actions
      if (['opened', 'closed', 'merged'].includes(action)) {
        await sendInngestEvent({
          name: 'workspace.metrics.aggregate',
          data: {
            workspaceId: wr.workspace_id,
            timeRange: '7d',
            priority: 20,
            triggeredBy: 'webhook',
            triggerMetadata: {
              event: 'pull_request',
              action,
              pr_number: pullRequest.number,
              repository: repository.full_name,
            },
          },
        });
      }

      results.push({
        workspaceId: wr.workspace_id,
        status: 'processed',
      });
    } catch (error) {
      console.error(`Failed to process workspace ${wr.workspace_id}:`, error);
      results.push({
        workspaceId: wr.workspace_id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return {
    message: `Processed PR ${action} event`,
    pr: pullRequest.number,
    repository: repository.full_name,
    workspacesProcessed: results.filter((r) => r.status === 'processed').length,
    workspacesFailed: results.filter((r) => r.status === 'failed').length,
    totalWorkspaces: workspaceRepos.length,
  };
}

async function processIssueEvent(event: any, action: string, supabase: any) {
  const issue = event.issue;
  const repository = event.repository;

  if (!issue || !repository) {
    throw new Error('Invalid issue webhook payload');
  }

  // Similar to PR processing but simpler
  const { data: repo } = await supabase
    .from('repositories')
    .select('id')
    .eq('github_id', repository.id)
    .single();

  if (!repo) {
    return { message: 'Repository not tracked' };
  }

  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('workspace_id')
    .eq('repository_id', repo.id);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return { message: 'Repository not in any workspace' };
  }

  // Mark all workspace caches as stale
  const promises = workspaceRepos.map((wr) =>
    supabase.rpc('mark_workspace_cache_stale', {
      p_workspace_id: wr.workspace_id,
    })
  );

  await Promise.all(promises);

  return {
    message: `Processed issue ${action} event`,
    issue: issue.number,
    repository: repository.full_name,
    affectedWorkspaces: workspaceRepos.length,
  };
}

async function processPushEvent(event: any, supabase: any) {
  const repository = event.repository;
  const commits = event.commits || [];

  if (!repository) {
    throw new Error('Invalid push webhook payload');
  }

  const { data: repo } = await supabase
    .from('repositories')
    .select('id')
    .eq('github_id', repository.id)
    .single();

  if (!repo) {
    return { message: 'Repository not tracked' };
  }

  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('workspace_id')
    .eq('repository_id', repo.id);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return { message: 'Repository not in any workspace' };
  }

  // Send aggregation events with lower priority
  const promises = workspaceRepos.map((wr) =>
    sendInngestEvent({
      name: 'workspace.metrics.aggregate',
      data: {
        workspaceId: wr.workspace_id,
        timeRange: '7d',
        priority: 50,
        triggeredBy: 'webhook',
        triggerMetadata: {
          event: 'push',
          commits: commits.length,
          repository: repository.full_name,
        },
      },
    })
  );

  await Promise.all(promises);

  return {
    message: 'Processed push event',
    commits: commits.length,
    repository: repository.full_name,
    affectedWorkspaces: workspaceRepos.length,
  };
}

async function processRepositoryEvent(event: any, action: string, supabase: any) {
  const repository = event.repository;

  if (!repository) {
    throw new Error('Invalid repository webhook payload');
  }

  const { data: existingRepo } = await supabase
    .from('repositories')
    .select('id')
    .eq('github_id', repository.id)
    .single();

  if (!existingRepo) {
    return { message: 'Repository not tracked' };
  }

  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('workspace_id')
    .eq('repository_id', existingRepo.id);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return { message: 'Repository not in any workspace' };
  }

  // Send change notifications
  const promises = workspaceRepos.map((wr) =>
    sendInngestEvent({
      name: 'workspace.repository.changed',
      data: {
        workspaceId: wr.workspace_id,
        action: action as 'added' | 'removed',
        repositoryId: existingRepo.id,
        repositoryName: repository.full_name,
      },
    })
  );

  await Promise.all(promises);

  return {
    message: `Processed ${action} event for ${repository.full_name}`,
    affectedWorkspaces: workspaceRepos.length,
  };
}
