/**
 * GitHub App webhook receiver (Netlify Background Function).
 *
 * The `-background` suffix makes Netlify answer GitHub with 202 immediately and
 * run this handler asynchronously for up to 15 minutes. That is why the Fly
 * webhook box existed (sync functions time out at 10 s) and why it can go.
 * See docs/infrastructure/cost-reduction-plan.md, Phase 1a.
 *
 * Flow:
 *   1. verify `X-Hub-Signature-256` against the raw body
 *   2. claim `X-GitHub-Delivery` in `idempotency_keys` (GitHub redelivers on
 *      any non-2xx and the 202 is sent before we run, so dedupe is on us)
 *   3. dispatch to the existing handlers in `app/webhooks/*`
 *   4. mark the claim completed or failed
 *
 * The handlers import the shared anon Supabase client, but RLS blocks anon
 * writes to `github_app_installations` and friends. The Fly server was given
 * the service-role key under the anon variable names; this function does the
 * same, explicitly, before the handlers are imported (see `withServiceRoleEnv`).
 */
import type { Context } from '@netlify/functions';
import { getSupabaseClient } from './_shared/supabase-client';
import {
  readWebhookHeaders,
  verifyWebhookSignature,
  isHandledEvent,
  buildDeliveryClaim,
  buildReclaimPatch,
  staleProcessingCutoff,
  isDuplicateKeyError,
  type HandledEvent,
} from './lib/github-webhook.mts';

type WebhookPayload = { action?: string } & Record<string, unknown>;
type HandlerResult = unknown;

/**
 * Point the shared anon client at the service-role key for this process.
 * Background functions run one invocation per process, so this does not leak
 * into request-driven functions. Done before the dynamic import so the client
 * is constructed with the right key.
 */
function withServiceRoleEnv(): void {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for webhook processing');
  }
  process.env.SUPABASE_ANON_KEY = serviceKey;
  process.env.VITE_SUPABASE_ANON_KEY = serviceKey;
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
}

async function dispatch(event: HandledEvent, payload: WebhookPayload): Promise<HandlerResult> {
  withServiceRoleEnv();
  switch (event) {
    case 'pull_request': {
      const { handlePullRequestEvent } = await import('../../app/webhooks/pull-request');
      return handlePullRequestEvent(payload as never);
    }
    case 'issues': {
      const { handleIssuesEvent } = await import('../../app/webhooks/issues');
      return handleIssuesEvent(payload as never);
    }
    case 'issue_comment': {
      const { handleIssueCommentEvent } = await import('../../app/webhooks/issue-comment');
      return handleIssueCommentEvent(payload as never);
    }
    case 'installation': {
      const { handleInstallationEvent } = await import('../../app/webhooks/installation');
      return handleInstallationEvent(payload as never);
    }
    case 'installation_repositories': {
      const { handleInstallationRepositoriesEvent } =
        await import('../../app/webhooks/installation');
      return handleInstallationRepositoriesEvent(payload as never);
    }
  }
}

export default async function githubWebhookBackground(req: Request, _context: Context) {
  if (req.method !== 'POST') {
    // Background functions return 202 regardless; log and stop.
    console.warn('github-webhook-background: ignoring %s request', req.method);
    return;
  }

  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('github-webhook-background: GITHUB_APP_WEBHOOK_SECRET is not set');
    return;
  }

  const rawBody = await req.text();
  const { signature, event, deliveryId } = readWebhookHeaders(req.headers);

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('github-webhook-background: invalid signature (delivery %s)', deliveryId);
    return;
  }

  if (!deliveryId) {
    console.error('github-webhook-background: missing X-GitHub-Delivery header');
    return;
  }

  if (!isHandledEvent(event)) {
    console.log('github-webhook-background: ignoring event %s (delivery %s)', event, deliveryId);
    return;
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    console.error('github-webhook-background: body is not JSON (delivery %s)', deliveryId);
    return;
  }
  const action = typeof payload.action === 'string' ? payload.action : null;

  const supabase = getSupabaseClient();
  const claim = buildDeliveryClaim(deliveryId, event, action, rawBody);
  const { error: claimError } = await supabase.from('idempotency_keys').insert(claim);

  if (claimError) {
    if (isDuplicateKeyError(claimError)) {
      // GitHub's "Redeliver" reuses the delivery id. Take the claim over only
      // if the earlier attempt failed or has been "processing" longer than the
      // function's budget allows (i.e. the invocation died). A completed or
      // in-flight claim wins and this attempt is dropped. The conditional
      // UPDATE is atomic, so two concurrent redeliveries cannot both proceed.
      const { data: reclaimed, error: reclaimError } = await supabase
        .from('idempotency_keys')
        .update(buildReclaimPatch(claim))
        .eq('key', claim.key)
        .or(`status.eq.failed,and(status.eq.processing,created_at.lt.${staleProcessingCutoff()})`)
        .select('key');

      if (reclaimError) {
        console.error(
          'github-webhook-background: could not inspect duplicate delivery %s: %s',
          deliveryId,
          reclaimError.message
        );
        return;
      }
      if (!reclaimed || reclaimed.length === 0) {
        console.log(
          'github-webhook-background: delivery %s already completed or in flight, skipping',
          deliveryId
        );
        return;
      }
      console.log('github-webhook-background: retrying failed/stale delivery %s', deliveryId);
    } else {
      // Could not record the claim. Process anyway rather than drop the event;
      // handlers are idempotent on GitHub ids.
      console.error(
        'github-webhook-background: could not claim delivery %s: %s',
        deliveryId,
        claimError.message
      );
    }
  }

  console.log('github-webhook-background: %s.%s (delivery %s)', event, action ?? '-', deliveryId);
  const startedAt = Date.now();

  try {
    const result = await dispatch(event, payload);
    await supabase
      .from('idempotency_keys')
      .update({
        status: 'completed',
        response: { ok: true, duration_ms: Date.now() - startedAt, result: result ?? null },
      })
      .eq('key', claim.key);
    console.log(
      'github-webhook-background: done %s.%s in %dms',
      event,
      action ?? '-',
      Date.now() - startedAt
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('github-webhook-background: %s.%s failed: %s', event, action ?? '-', message);
    await supabase
      .from('idempotency_keys')
      .update({
        status: 'failed',
        response: { ok: false, duration_ms: Date.now() - startedAt, error: message },
      })
      .eq('key', claim.key);
  }
}
