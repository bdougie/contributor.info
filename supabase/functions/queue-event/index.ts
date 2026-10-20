/**
 * queue-event: the single entry point for background work.
 *
 * Phase 3b of docs/infrastructure/cost-reduction-plan.md. Replaces the Inngest
 * event endpoint: every former `inngest.send({ name, data })` is now
 * `POST /functions/v1/queue-event { eventName, data }`.
 *
 *   capture/*          → one gh-datapipe Fly machine (datapipe_jobs row)
 *   retired events     → acknowledged, nothing stored (see _shared/jobs/retired.ts)
 *   everything else    → enqueue_job(): background_jobs row + pgmq message,
 *                        then process-job is kicked so the job starts now
 *                        instead of at the next one-minute cron tick
 *
 * Who may send what (the gateway accepts the anon key, so this is the check):
 *   service role   any event. Netlify functions and the webhook background
 *                  function send with SUPABASE_SERVICE_ROLE_KEY.
 *   signed-in user capture/* for a tracked repository, workspace/* events.
 *   anonymous      capture/* for a tracked repository only; capture starts are
 *                  deduped per repository for 10 minutes, so an anonymous
 *                  caller cannot start a machine per request.
 *
 * `X-Idempotency-Key` dedupes a request for 24 h through `idempotency_keys`.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';
import {
  CaptureError,
  isCaptureEvent,
  isValidRepositoryName,
  resolveRepository,
  startCapture,
} from '../_shared/datapipe-capture.ts';
import { enqueueJob, kickProcessJob } from '../_shared/jobs/queue.ts';
import { hasHandler } from '../_shared/jobs/registry.ts';
import {
  DEDUPE_POLICIES,
  dedupeStatuses,
  isRetiredEvent,
  RETIRED_EVENTS,
} from '../_shared/jobs/retired.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type Caller = { tier: 'service' } | { tier: 'user'; userId: string } | { tier: 'anon' };

/** Events a signed-in user may queue in addition to capture/*. */
const USER_EVENTS = new Set(['workspace/priorities.sync']);

interface QueueEventRequest {
  eventName: string;
  data: Record<string, unknown>;
}

interface IdempotencyResponse {
  eventId?: string;
  success?: boolean;
  error?: string;
  duplicate?: boolean;
  cached?: boolean;
  retired?: boolean;
}

interface IdempotencyRecord {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  response: IdempotencyResponse | null;
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'RequestError';
  }
}

async function identifyCaller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return { tier: 'anon' };
  if (token === supabaseServiceKey) return { tier: 'service' };
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user?.id) return { tier: 'user', userId: user.id };
  } catch {
    // anon key or an expired session: anonymous
  }
  return { tier: 'anon' };
}

async function generateRequestHash(
  eventName: string,
  data: Record<string, unknown>,
): Promise<string> {
  const buffer = new TextEncoder().encode(JSON.stringify({ eventName, data }));
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Claim the idempotency key; returns the cached response for a completed duplicate. */
async function handleIdempotency(
  key: string,
  eventName: string,
  data: Record<string, unknown>,
  userId?: string,
): Promise<{ isDuplicate: boolean; response?: IdempotencyResponse }> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('idempotency_keys')
      .select('key, status, response')
      .eq('key', key)
      .maybeSingle();
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    const record = existing as IdempotencyRecord | null;
    if (record) {
      if (record.status === 'completed') {
        return { isDuplicate: true, response: record.response ?? undefined };
      }
      if (record.status === 'processing') {
        throw new Error('Request is still being processed. Please try again later.');
      }
      await supabase.from('idempotency_keys').delete().eq('key', key);
    }

    const { error: insertError } = await supabase.from('idempotency_keys').insert({
      key,
      request_hash: await generateRequestHash(eventName, data),
      status: 'processing',
      endpoint: 'queue-event',
      user_id: userId,
      metadata: { eventName },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (insertError?.code === '23505') {
      const { data: raced } = await supabase
        .from('idempotency_keys')
        .select('key, status, response')
        .eq('key', key)
        .maybeSingle();
      const racedRecord = raced as IdempotencyRecord | null;
      if (racedRecord?.status === 'completed') {
        return { isDuplicate: true, response: racedRecord.response ?? undefined };
      }
    } else if (insertError) {
      console.error('Error inserting idempotency key:', insertError);
    }
    return { isDuplicate: false };
  } catch (error) {
    console.error('Idempotency handling error:', error);
    return { isDuplicate: false };
  }
}

async function updateIdempotencyRecord(
  key: string,
  status: 'completed' | 'failed',
  response?: IdempotencyResponse,
): Promise<void> {
  const { error } = await supabase
    .from('idempotency_keys')
    .update({ status, response: response ?? null })
    .eq('key', key);
  if (error) console.error('Error updating idempotency record:', error);
}

/** Non-service callers may only capture repositories that are already tracked. */
async function assertTrackedRepository(data: Record<string, unknown>): Promise<void> {
  const repository = await resolveRepository(supabase, data);
  if (!repository || !isValidRepositoryName(repository)) {
    throw new RequestError(400, 'capture events need a tracked repository');
  }
  const { data: tracked } = await supabase
    .from('tracked_repositories')
    .select('repository_id, repositories!inner(full_name)')
    .eq('tracking_enabled', true)
    .eq('repositories.full_name', repository)
    .limit(1)
    .maybeSingle();
  if (!tracked) {
    throw new RequestError(403, 'Repository is not tracked; track it before requesting a sync');
  }
}

async function authorize(
  caller: Caller,
  eventName: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (caller.tier === 'service') return;
  if (isCaptureEvent(eventName)) {
    await assertTrackedRepository(data);
    return;
  }
  if (caller.tier === 'user' && USER_EVENTS.has(eventName)) return;
  throw new RequestError(
    403,
    caller.tier === 'anon'
      ? `Sign in to queue ${eventName}`
      : `${eventName} can only be queued by the server`,
  );
}

interface RouteResult {
  eventId?: string;
  retired?: boolean;
  reason?: string;
  queued?: boolean;
}

async function routeEvent(
  caller: Caller,
  eventName: string,
  data: Record<string, unknown>,
): Promise<RouteResult> {
  if (isRetiredEvent(eventName)) {
    console.log('Retired event %s acknowledged: %s', eventName, RETIRED_EVENTS[eventName]);
    return { retired: true, reason: RETIRED_EVENTS[eventName] };
  }

  if (!isCaptureEvent(eventName) && !hasHandler(eventName)) {
    throw new RequestError(400, `Unknown event: ${eventName}`);
  }

  await authorize(caller, eventName, data);

  if (isCaptureEvent(eventName)) {
    const capture = await startCapture(supabase, eventName, data);
    return { eventId: capture.datapipe_job_id, queued: true };
  }

  const repositoryId = typeof data.repositoryId === 'string' ? data.repositoryId : undefined;
  const policy = DEDUPE_POLICIES[eventName];
  const jobId = await enqueueJob(supabase, eventName, data, {
    repositoryId,
    source: caller.tier === 'user' ? `user:${caller.userId}` : `queue-event:${caller.tier}`,
    dedupeWindow: policy?.window,
    dedupeStatuses: policy ? dedupeStatuses(policy) : undefined,
  });
  kickProcessJob(supabaseUrl, supabaseServiceKey, `queue-event:${eventName}`);
  return { eventId: jobId, queued: true };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: QueueEventRequest = await req.json();
    const { eventName, data } = body;
    if (typeof eventName !== 'string' || !eventName || !data || typeof data !== 'object') {
      return json(400, { error: 'Missing eventName or data' });
    }

    const idempotencyKey = req.headers.get('X-Idempotency-Key');
    const caller = await identifyCaller(req);
    const userId = caller.tier === 'user' ? caller.userId : undefined;

    if (idempotencyKey) {
      const { isDuplicate, response } = await handleIdempotency(
        idempotencyKey,
        eventName,
        data,
        userId,
      );
      if (isDuplicate && response) {
        console.log('Duplicate request for idempotency key %s', idempotencyKey);
        return json(200, { ...response, duplicate: true, cached: true });
      }
    }

    let routed: RouteResult;
    try {
      routed = await routeEvent(caller, eventName, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to queue event %s (%s): %s', eventName, caller.tier, message);
      if (idempotencyKey) {
        await updateIdempotencyRecord(idempotencyKey, 'failed', { error: message });
      }
      const status = error instanceof RequestError || error instanceof CaptureError
        ? error.status
        : 500;
      return json(status, { error: 'Failed to queue event', message });
    }

    const response: IdempotencyResponse = {
      success: true,
      eventId: routed.eventId,
      ...(routed.retired ? { retired: true } : {}),
    };
    if (idempotencyKey) await updateIdempotencyRecord(idempotencyKey, 'completed', response);

    console.log(
      'Event %s %s',
      eventName,
      routed.retired ? 'retired' : `queued as ${routed.eventId}`,
    );
    return json(200, {
      ...response,
      duplicate: false,
      ...(routed.reason ? { reason: routed.reason } : {}),
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return json(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
