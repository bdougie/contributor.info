/**
 * GET /api/backfill/status/:job_id
 *
 * Reads one datapipe_jobs row and returns the view the ManualBackfill UI
 * polls. The Fly machine writes progress into the row with --job-id, so no
 * call to Fly is needed here.
 */
import type { Handler } from '@netlify/functions';
import {
  DatapipeJobsError,
  getJob,
  getSupabaseAdmin,
  toJobStatusView,
} from './lib/datapipe-jobs.mts';

const headers = { 'Content-Type': 'application/json' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'GET' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Service unavailable',
        message: 'Manual backfill service is not configured',
      }),
    };
  }

  // Path format: /api/backfill/status/{job_id}
  const jobId = event.path.split('/').filter(Boolean).pop();
  if (!jobId || jobId === 'status') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Bad request', message: 'Job ID is required' }),
    };
  }
  if (!UUID.test(jobId)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Bad request', message: 'Job ID must be a UUID' }),
    };
  }

  try {
    const job = await getJob(jobId, supabase);
    if (!job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found', message: `Job ${jobId} not found` }),
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify(toJobStatusView(job)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backfill-status] Error reading job %s: %s', jobId, message);
    const statusCode = error instanceof DatapipeJobsError ? error.status : 500;
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message }),
    };
  }
};
