/**
 * Hybrid Webhook Handler: Workspace Repository Changes
 * Routes high-volume webhook events through background job processing
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GitHub webhook secret for verification
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-GitHub-Event, X-Hub-Signature-256',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Thresholds for routing decisions
const WORKSPACE_THRESHOLD = 10; // Route to background if > 10 workspaces affected
const QUICK_EVENTS = ['ping', 'repository']; // Events that are always quick

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
 * Quick check: Count affected workspaces
 */
async function countAffectedWorkspaces(
  githubRepoId: number
): Promise<number> {
  try {
    // Check if repository exists
    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', githubRepoId)
      .single();

    if (!repo) {
      return 0;
    }

    // Count workspaces
    const { count } = await supabase
      .from('workspace_repositories')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', repo.id);

    return count || 0;
  } catch (error) {
    console.error('Error counting workspaces:', error);
    return 0;
  }
}

/**
 * Route webhook to background processing
 */
async function routeToBackground(
  githubEvent: string,
  payload: Record<string, unknown>
): Promise<{ jobId: string; status: string }> {
  const jobType = `webhook/${githubEvent}`;

  const { data: job, error } = await supabase
    .from('background_jobs')
    .insert({
      type: jobType,
      payload: {
        event: githubEvent,
        action: payload.action,
        data: payload,
        timestamp: new Date().toISOString()
      },
      status: 'queued',
      max_retries: 2, // Webhooks get fewer retries
      webhook_source: 'github',
      webhook_event_type: githubEvent,
      processing_mode: 'background'
    })
    .select()
    .single();

  if (error || !job) {
    throw new Error(`Failed to queue job: ${error?.message}`);
  }

  // Trigger Supabase Edge Function asynchronously
  const functionUrl = `${supabaseUrl}/functions/v1/process-webhook`;

  // Fire and forget - don't await
  fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId: job.id }),
  }).catch((error) => {
    console.error('Error triggering webhook processor:', error);
  });

  return {
    jobId: job.id,
    status: 'queued'
  };
}

/**
 * Process simple webhook inline (for quick operations)
 */
async function processQuickWebhook(
  githubEvent: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Handle ping events
  if (githubEvent === 'ping') {
    return { status: 200, message: 'Pong!' };
  }

  // Handle repository events (usually just tracking updates)
  if (githubEvent === 'repository') {
    const repository = payload.repository as { id: number; full_name: string } | undefined;
    if (!repository) {
      return { status: 400, message: 'Invalid payload' };
    }

    // Just log the event, no heavy processing
    console.log(`Repository event: ${payload.action} for ${repository.full_name}`);
    return {
      status: 200,
      message: `Acknowledged ${payload.action} for ${repository.full_name}`
    };
  }

  return { status: 200, message: 'Event acknowledged' };
}

/**
 * Main webhook handler with hybrid routing
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

    // Quick events are always processed inline
    if (QUICK_EVENTS.includes(githubEvent)) {
      const result = await processQuickWebhook(githubEvent, payload);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    }

    // For other events, check workspace count to decide routing
    const repository = payload.repository as { id: number } | undefined;

    if (repository) {
      const workspaceCount = await countAffectedWorkspaces(repository.id);

      console.log(`Event affects ${workspaceCount} workspaces`);

      // Route to background if many workspaces are affected
      if (workspaceCount > WORKSPACE_THRESHOLD) {
        console.log(`Routing ${githubEvent} to background processing (${workspaceCount} workspaces)`);

        const result = await routeToBackground(githubEvent, payload);

        return {
          statusCode: 202, // Accepted for processing
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'accepted',
            message: `High-volume webhook queued for processing`,
            jobId: result.jobId,
            affectedWorkspaces: workspaceCount,
            processingMode: 'background'
          })
        };
      }
    }

    // For low-volume events, also route to background for consistency
    // This ensures all complex webhook processing happens in Supabase with 150s timeout
    console.log(`Routing ${githubEvent} to background processing`);

    const result = await routeToBackground(githubEvent, payload);

    return {
      statusCode: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'accepted',
        message: 'Webhook queued for processing',
        jobId: result.jobId,
        processingMode: 'background'
      })
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