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
  getSupabaseAdmin,
  isConfigured,
  isValidRepository,
  triggerBackfill,
} from './lib/datapipe-jobs.mts';
import { FlyMachinesError } from './lib/fly-machines.mts';
import { getUserFromAuthHeader } from './lib/request-auth.mts';

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

  // Each request starts a billable Fly machine with service-role access, so
  // it needs a signed-in user. The user id is stored on the job so only they
  // can cancel it.
  const user = await getUserFromAuthHeader(event.headers);
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized', message: 'Sign in to start a backfill' }),
    };
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

  // Only tracked, public repositories. Private repositories need an
  // installation-level access check that this endpoint does not do yet.
  const supabase = getSupabaseAdmin();
  const { data: repoRow, error: repoError } = supabase
    ? await supabase
        .from('repositories')
        .select('id, is_private')
        .eq('full_name', body.repository)
        .maybeSingle()
    : { data: null, error: null };
  if (repoError) {
    console.error('[backfill-trigger] repository lookup failed: %s', repoError.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: 'Repository lookup failed' }),
    };
  }
  if (!repoRow) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Not found',
        message: `${body.repository} is not tracked. Track it first, then backfill.`,
      }),
    };
  }
  if (repoRow.is_private) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        error: 'Forbidden',
        message: 'Private repositories cannot be backfilled from this endpoint',
      }),
    };
  }

  console.log('[backfill-trigger] Processing request:', {
    repository: body.repository,
    days,
    sources: body.sources ?? 'default',
    requestedBy: user.id,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await triggerBackfill({
      repository: body.repository,
      days,
      sources: body.sources,
      config: body.config,
      reason: 'manual',
      requestedBy: user.id,
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
