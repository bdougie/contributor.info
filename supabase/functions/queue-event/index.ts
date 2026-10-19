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
 * `X-Idempotency-Key` dedupes a request for 24 h through `idempotency_keys`.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';
import { isCaptureEvent, startCapture } from '../_shared/datapipe-capture.ts';
import { enqueueJob, kickProcessJob } from '../_shared/jobs/queue.ts';
import { hasHandler } from '../_shared/jobs/registry.ts';
import { DEDUPE_WINDOWS, isRetiredEvent, RETIRED_EVENTS } from '../_shared/jobs/retired.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

interface RouteResult {
  eventId?: string;
  retired?: boolean;
  reason?: string;
  queued?: boolean;
}

async function routeEvent(
  eventName: string,
  data: Record<string, unknown>,
  userId?: string,
): Promise<RouteResult> {
  if (isRetiredEvent(eventName)) {
    console.log('Retired event %s acknowledged: %s', eventName, RETIRED_EVENTS[eventName]);
    return { retired: true, reason: RETIRED_EVENTS[eventName] };
  }

  if (isCaptureEvent(eventName)) {
    const capture = await startCapture(supabase, eventName, data);
    return { eventId: capture.datapipe_job_id, queued: true };
  }

  if (!hasHandler(eventName)) {
    throw new UnknownEventError(eventName);
  }

  const repositoryId = typeof data.repositoryId === 'string' ? data.repositoryId : undefined;
  const jobId = await enqueueJob(supabase, eventName, data, {
    repositoryId,
    source: userId ? `user:${userId}` : 'queue-event',
    dedupeWindow: DEDUPE_WINDOWS[eventName],
  });
  kickProcessJob(supabaseUrl, supabaseServiceKey, `queue-event:${eventName}`);
  return { eventId: jobId, queued: true };
}

class UnknownEventError extends Error {
  constructor(eventName: string) {
    super(`Unknown event: ${eventName}`);
    this.name = 'UnknownEventError';
  }
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

    let userId: string | undefined;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id;
      } catch {
        // anon key or service key: no user
      }
    }

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
      routed = await routeEvent(eventName, data, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to queue event %s: %s', eventName, message);
      if (idempotencyKey) {
        await updateIdempotencyRecord(idempotencyKey, 'failed', { error: message });
      }
      const status = error instanceof UnknownEventError ? 400 : 500;
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
