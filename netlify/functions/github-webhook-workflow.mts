import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Verify GitHub webhook signature
function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(body).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export default async (request: Request) => {
  // Verify this is a POST request
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Get signature header
  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  
  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    console.error('[GitHub Webhook] Invalid signature');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload = JSON.parse(body);
    const eventType = request.headers.get('x-github-event');

    console.log(`[GitHub Webhook] Received ${eventType} event`);

    // Handle workflow run events
    if (eventType === 'workflow_run') {
      await handleWorkflowRun(payload);
    }

    // Handle workflow job events
    if (eventType === 'workflow_job') {
      await handleWorkflowJob(payload);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[GitHub Webhook] Error processing webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

async function handleWorkflowRun(payload: any) {
  const { action, workflow_run } = payload;
  
  console.log(`[GitHub Webhook] Workflow run ${action}: ${workflow_run.name} (${workflow_run.id})`);

  // Only process completed runs
  if (action !== 'completed') {
    return;
  }

  // Map GitHub conclusion to our status
  const status = workflow_run.conclusion === 'success' ? 'completed' : 'failed';

  // Update job status in database
  const { error: updateError } = await supabase
    .from('progressive_capture_jobs')
    .update({
      status,
      completed_at: workflow_run.updated_at,
      metadata: supabase.sql`
        metadata || jsonb_build_object(
          'workflow_run_id', ${workflow_run.id},
          'workflow_url', ${workflow_run.html_url},
          'conclusion', ${workflow_run.conclusion},
          'run_number', ${workflow_run.run_number},
          'run_attempt', ${workflow_run.run_attempt},
          'duration_seconds', ${Math.floor((new Date(workflow_run.updated_at).getTime() - new Date(workflow_run.created_at).getTime()) / 1000)}
        )
      `
    })
    .or(`metadata->workflow_run_id.eq.${workflow_run.id},metadata->github_run_id.eq.${workflow_run.id}`)
    .eq('processor_type', 'github_actions')
    .eq('status', 'processing');

  if (updateError) {
    console.error('[GitHub Webhook] Error updating job status:', updateError);
  }

  // Special handling for progressive backfill workflows
  if (workflow_run.name === 'Progressive Repository Backfill') {
    await updateBackfillProgress(workflow_run);
  }

  // Calculate metrics for completed jobs
  if (status === 'completed' || status === 'failed') {
    await calculateJobMetrics(workflow_run.id);
  }
}

async function handleWorkflowJob(payload: any) {
  const { action, workflow_job } = payload;
  
  console.log(`[GitHub Webhook] Workflow job ${action}: ${workflow_job.name} (${workflow_job.id})`);

  // Track job-level events for more granular monitoring
  if (action === 'queued' || action === 'in_progress' || action === 'completed') {
    const status = action === 'completed' ? 
      (workflow_job.conclusion === 'success' ? 'completed' : 'failed') : 
      'processing';

    // Log job event for monitoring
    await supabase
      .from('system_health_metrics')
      .insert({
        processor_type: 'github_actions',
        metrics: {
          event: 'workflow_job',
          action,
          job_name: workflow_job.name,
          job_id: workflow_job.id,
          run_id: workflow_job.run_id,
          status: workflow_job.status,
          conclusion: workflow_job.conclusion,
          started_at: workflow_job.started_at,
          completed_at: workflow_job.completed_at
        },
        health_score: status === 'completed' ? 1.0 : (status === 'failed' ? 0.0 : 0.5)
      });
  }
}

async function updateBackfillProgress(workflow_run: any) {
  // Extract repository information from workflow inputs or job name
  const repositoryId = workflow_run.inputs?.repository_id;
  
  if (!repositoryId) {
    console.log('[GitHub Webhook] No repository ID in workflow run inputs');
    return;
  }

  // Update backfill metrics
  const { error } = await supabase
    .from('progressive_backfill_state')
    .update({
      metadata: supabase.sql`
        metadata || jsonb_build_object(
          'last_workflow_run_id', ${workflow_run.id},
          'last_workflow_conclusion', ${workflow_run.conclusion},
          'last_workflow_at', ${workflow_run.updated_at}
        )
      `,
      updated_at: new Date().toISOString()
    })
    .eq('repository_id', repositoryId)
    .eq('status', 'active');

  if (error) {
    console.error('[GitHub Webhook] Error updating backfill progress:', error);
  }
}

async function calculateJobMetrics(workflowRunId: number) {
  try {
    // Find the job record
    const { data: job, error: jobError } = await supabase
      .from('progressive_capture_jobs')
      .select('*')
      .or(`metadata->workflow_run_id.eq.${workflowRunId},metadata->github_run_id.eq.${workflowRunId}`)
      .single();

    if (jobError || !job) {
      console.log('[GitHub Webhook] Job not found for workflow run:', workflowRunId);
      return;
    }

    // Calculate processing time
    const startTime = new Date(job.started_at || job.created_at).getTime();
    const endTime = new Date(job.completed_at || new Date()).getTime();
    const processingTimeMs = endTime - startTime;

    // Update job with metrics
    const { error: updateError } = await supabase
      .from('progressive_capture_jobs')
      .update({
        metrics: {
          processing_time_ms: processingTimeMs,
          processing_time_seconds: Math.floor(processingTimeMs / 1000),
          workflow_run_id: workflowRunId,
          calculated_at: new Date().toISOString()
        }
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('[GitHub Webhook] Error updating job metrics:', updateError);
    }

    console.log(`[GitHub Webhook] Calculated metrics for job ${job.id}: ${processingTimeMs}ms`);
  } catch (error) {
    console.error('[GitHub Webhook] Error calculating metrics:', error);
  }
}

export const config = {
  path: "/api/github-webhook"
};