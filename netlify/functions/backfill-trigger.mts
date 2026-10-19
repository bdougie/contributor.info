/**
 * POST /api/backfill/trigger
 *
 * Starts an on-demand gh-datapipe backfill for one repository: creates a
 * datapipe_jobs row in Supabase and a one-shot Fly machine that runs it.
 * Status is read back from datapipe_jobs by /api/backfill/status/:id.
 */
import type { Handler } from '@netlify/functions';
import {
  DatapipeJobsError,
  isConfigured,
  isValidRepository,
  triggerBackfill,
} from './lib/datapipe-jobs.mts';
import { FlyMachinesError } from './lib/fly-machines.mts';

const headers = { 'Content-Type': 'application/json' };

interface TriggerBody {
  repository?: string;
  days?: number;
  sources?: string[];
  config?: string;
  force?: boolean;
  callback_url?: string;
}

function unavailable(): ReturnType<Handler> {
  return Promise.resolve({
    statusCode: 503,
    headers,
    body: JSON.stringify({
      error: 'Service unavailable',
      message:
        'Backfill service is not configured. Set FLY_DATAPIPE_TOKEN, FLY_DATAPIPE_IMAGE and the Supabase service role key.',
      code: 'SERVICE_UNAVAILABLE',
      service: 'gh-datapipe',
    }),
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!isConfigured()) {
    console.warn('[backfill-trigger] datapipe not configured - service unavailable');
    return unavailable();
  }

  let body: TriggerBody;
  try {
    body = JSON.parse(event.body || '{}') as TriggerBody;
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Bad request',
        message: 'Invalid JSON in request body',
        details: error instanceof Error ? error.message : 'Invalid JSON',
      }),
    };
  }

  if (!body.repository) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Bad request', message: 'Repository is required' }),
    };
  }

  if (!isValidRepository(body.repository)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Bad request',
        message: 'Invalid repository format. Expected: owner/name',
      }),
    };
  }

  const days = typeof body.days === 'number' && body.days > 0 ? Math.floor(body.days) : 30;

  console.log('[backfill-trigger] Processing request:', {
    repository: body.repository,
    days,
    sources: body.sources ?? 'default',
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await triggerBackfill({
      repository: body.repository,
      days,
      sources: body.sources,
      config: body.config,
      reason: 'manual',
    });

    console.log(
      '[backfill-trigger] Started job %s on machine %s',
      result.job_id,
      result.fly_machine_id
    );

    return { statusCode: 202, headers, body: JSON.stringify(result) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backfill-trigger] Failed for %s: %s', body.repository, message);

    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    if (error instanceof DatapipeJobsError || error instanceof FlyMachinesError) {
      statusCode = error.status;
      code =
        error.status === 503
          ? 'SERVICE_UNAVAILABLE'
          : error.status === 502
            ? 'NETWORK_ERROR'
            : error.status === 400
              ? 'BAD_REQUEST'
              : 'UPSTREAM_ERROR';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: 'Backfill trigger failed',
        message: `Failed to trigger backfill: ${message}`,
        code,
        service: 'backfill-trigger',
      }),
    };
  }
};
