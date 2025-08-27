/**
 * Webhook Handler: Workspace Repository Changes
 * Handles GitHub webhooks for real-time updates when repositories change
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GitHub webhook secret for verification
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-GitHub-Event, X-Hub-Signature-256',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('No webhook secret configured, skipping verification');
    return true; // Allow in development
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Handle repository events
 */
async function handleRepositoryEvent(event: any, action: string) {
  const repository = event.repository;
  
  if (!repository) {
    console.error('No repository in webhook payload');
    return { status: 400, message: 'Invalid payload' };
  }

  try {
    // Check if repository exists in our database
    const { data: existingRepo } = await supabaseAdmin
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .single();

    if (!existingRepo) {
      console.log(`Repository ${repository.full_name} not tracked`);
      return { status: 200, message: 'Repository not tracked' };
    }

    // Find workspaces that include this repository
    const { data: workspaceRepos, error } = await supabaseAdmin
      .from('workspace_repositories')
      .select('workspace_id')
      .eq('repository_id', existingRepo.id);

    if (error) {
      console.error('Failed to find workspace repositories:', error);
      return { status: 500, message: 'Database error' };
    }

    if (!workspaceRepos || workspaceRepos.length === 0) {
      return { status: 200, message: 'Repository not in any workspace' };
    }

    // Trigger cache invalidation for each affected workspace
    const invalidationPromises = workspaceRepos.map(async (wr) => {
      await inngest.send({
        name: 'workspace.repository.changed',
        data: {
          workspaceId: wr.workspace_id,
          action: action as 'added' | 'removed',
          repositoryId: existingRepo.id,
          repositoryName: repository.full_name
        }
      });
    });

    await Promise.all(invalidationPromises);

    return {
      status: 200,
      message: `Processed ${action} event for ${repository.full_name}`,
      affectedWorkspaces: workspaceRepos.length
    };
  } catch (error) {
    console.error('Error handling repository event:', error);
    return { status: 500, message: 'Internal error' };
  }
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(event: any, action: string) {
  const pullRequest = event.pull_request;
  const repository = event.repository;

  if (!pullRequest || !repository) {
    console.error('Invalid pull request webhook payload');
    return { status: 400, message: 'Invalid payload' };
  }

  try {
    // Check if repository exists
    const { data: repo } = await supabaseAdmin
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .single();

    if (!repo) {
      return { status: 200, message: 'Repository not tracked' };
    }

    // Find affected workspaces
    const { data: workspaceRepos } = await supabaseAdmin
      .from('workspace_repositories')
      .select('workspace_id')
      .eq('repository_id', repo.id);

    if (!workspaceRepos || workspaceRepos.length === 0) {
      return { status: 200, message: 'Repository not in any workspace' };
    }

    // Mark cache as stale for all affected workspaces
    const stalePromises = workspaceRepos.map(async (wr) => {
      await supabaseAdmin.rpc('mark_workspace_cache_stale', {
        p_workspace_id: wr.workspace_id
      });
    });

    await Promise.all(stalePromises);

    // Optionally trigger immediate re-aggregation for high-priority events
    if (['opened', 'closed', 'merged'].includes(action)) {
      const aggregationPromises = workspaceRepos.map(async (wr) => {
        await inngest.send({
          name: 'workspace.metrics.aggregate',
          data: {
            workspaceId: wr.workspace_id,
            timeRange: '7d', // Update short-term metrics quickly
            priority: 20, // Higher priority for real-time updates
            triggeredBy: 'webhook',
            triggerMetadata: {
              event: 'pull_request',
              action,
              pr_number: pullRequest.number,
              repository: repository.full_name
            }
          }
        });
      });

      await Promise.all(aggregationPromises);
    }

    return {
      status: 200,
      message: `Processed PR ${action} event`,
      pr: pullRequest.number,
      repository: repository.full_name,
      affectedWorkspaces: workspaceRepos.length
    };
  } catch (error) {
    console.error('Error handling PR event:', error);
    return { status: 500, message: 'Internal error' };
  }
}

/**
 * Handle issue events
 */
async function handleIssueEvent(event: any, action: string) {
  const issue = event.issue;
  const repository = event.repository;

  if (!issue || !repository) {
    console.error('Invalid issue webhook payload');
    return { status: 400, message: 'Invalid payload' };
  }

  try {
    // Similar logic to PR events
    const { data: repo } = await supabaseAdmin
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .single();

    if (!repo) {
      return { status: 200, message: 'Repository not tracked' };
    }

    const { data: workspaceRepos } = await supabaseAdmin
      .from('workspace_repositories')
      .select('workspace_id')
      .eq('repository_id', repo.id);

    if (!workspaceRepos || workspaceRepos.length === 0) {
      return { status: 200, message: 'Repository not in any workspace' };
    }

    // Mark cache as stale
    const stalePromises = workspaceRepos.map(async (wr) => {
      await supabaseAdmin.rpc('mark_workspace_cache_stale', {
        p_workspace_id: wr.workspace_id
      });
    });

    await Promise.all(stalePromises);

    return {
      status: 200,
      message: `Processed issue ${action} event`,
      issue: issue.number,
      repository: repository.full_name,
      affectedWorkspaces: workspaceRepos.length
    };
  } catch (error) {
    console.error('Error handling issue event:', error);
    return { status: 500, message: 'Internal error' };
  }
}

/**
 * Handle push events (commits)
 */
async function handlePushEvent(event: any) {
  const repository = event.repository;
  const commits = event.commits || [];

  if (!repository) {
    console.error('Invalid push webhook payload');
    return { status: 400, message: 'Invalid payload' };
  }

  try {
    const { data: repo } = await supabaseAdmin
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .single();

    if (!repo) {
      return { status: 200, message: 'Repository not tracked' };
    }

    const { data: workspaceRepos } = await supabaseAdmin
      .from('workspace_repositories')
      .select('workspace_id')
      .eq('repository_id', repo.id);

    if (!workspaceRepos || workspaceRepos.length === 0) {
      return { status: 200, message: 'Repository not in any workspace' };
    }

    // For push events, we can debounce aggregation updates
    // since commits often come in batches
    const aggregationPromises = workspaceRepos.map(async (wr) => {
      await inngest.send({
        name: 'workspace.metrics.aggregate',
        data: {
          workspaceId: wr.workspace_id,
          timeRange: '7d',
          priority: 50, // Lower priority for commits
          triggeredBy: 'webhook',
          triggerMetadata: {
            event: 'push',
            commits: commits.length,
            repository: repository.full_name
          }
        }
      });
    });

    await Promise.all(aggregationPromises);

    return {
      status: 200,
      message: 'Processed push event',
      commits: commits.length,
      repository: repository.full_name,
      affectedWorkspaces: workspaceRepos.length
    };
  } catch (error) {
    console.error('Error handling push event:', error);
    return { status: 500, message: 'Internal error' };
  }
}

/**
 * Main webhook handler
 */
export const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify webhook signature
    const signature = event.headers['x-hub-signature-256'] || '';
    if (WEBHOOK_SECRET && !verifyWebhookSignature(event.body || '', signature)) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    // Parse webhook payload
    const payload = JSON.parse(event.body || '{}');
    const githubEvent = event.headers['x-github-event'] || '';
    const action = payload.action || '';

    console.log(`Received GitHub webhook: ${githubEvent} (${action})`);

    let result;

    // Route to appropriate handler
    switch (githubEvent) {
      case 'repository':
        result = await handleRepositoryEvent(payload, action);
        break;
      
      case 'pull_request':
        result = await handlePullRequestEvent(payload, action);
        break;
      
      case 'issues':
        result = await handleIssueEvent(payload, action);
        break;
      
      case 'push':
        result = await handlePushEvent(payload);
        break;
      
      case 'ping':
        // GitHub sends ping events to test webhook
        result = { status: 200, message: 'Pong!' };
        break;
      
      default:
        console.log(`Unhandled event type: ${githubEvent}`);
        result = { status: 200, message: `Event ${githubEvent} not processed` };
    }

    return {
      statusCode: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};