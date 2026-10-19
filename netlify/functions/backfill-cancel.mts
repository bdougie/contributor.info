/**
 * POST /api/backfill/cancel/:job_id
 *
 * Marks a datapipe_jobs row cancelled and destroys its Fly machine if it is
 * still around (auto_destroy removes it on exit anyway).
 */
import type { Handler } from '@netlify/functions';
import { cancelJob, DatapipeJobsError, getSupabaseAdmin } from './lib/datapipe-jobs.mts';

const headers = { 'Content-Type': 'application/json' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST' },
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

  // Path format: /api/backfill/cancel/{job_id}
  const jobId = event.path.split('/').filter(Boolean).pop();
  if (!jobId || jobId === 'cancel') {
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
    const result = await cancelJob(jobId, supabase);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backfill-cancel] Error cancelling job %s: %s', jobId, message);
    const statusCode = error instanceof DatapipeJobsError ? error.status : 500;
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 404 ? 'Not found' : 'Internal server error',
        message,
      }),
    };
  }
};
