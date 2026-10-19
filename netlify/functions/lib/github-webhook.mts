/**
 * Pure helpers for the GitHub App webhook background function.
 *
 * Kept free of Netlify and Supabase imports so they can be unit tested in
 * isolation. The function itself lives in `../github-webhook-background.mts`.
 */
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export const WEBHOOK_ENDPOINT = 'github-webhook-background';

/** How long a delivery id stays in `idempotency_keys` before it can be reused. */
export const DELIVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Event types the handlers under `app/webhooks/` know how to process.
 * Anything else is acknowledged and dropped, which is what the Fly server did.
 */
export const HANDLED_EVENTS = [
  'pull_request',
  'issues',
  'issue_comment',
  'installation',
  'installation_repositories',
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export interface WebhookHeaders {
  signature: string | null;
  event: string | null;
  deliveryId: string | null;
}

export function readWebhookHeaders(headers: Headers): WebhookHeaders {
  return {
    signature: headers.get('x-hub-signature-256'),
    event: headers.get('x-github-event'),
    deliveryId: headers.get('x-github-delivery'),
  };
}

/**
 * Verify `X-Hub-Signature-256` against the raw request body.
 * Constant-time compare; a length mismatch is rejected before comparing so
 * `timingSafeEqual` never throws.
 */
export function verifyWebhookSignature(
  rawBody: string | Uint8Array,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  if (!signature.startsWith('sha256=')) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isHandledEvent(event: string | null): event is HandledEvent {
  return event !== null && (HANDLED_EVENTS as readonly string[]).includes(event);
}

/** Row written to `idempotency_keys` to claim a delivery id. */
export interface DeliveryClaim {
  key: string;
  request_hash: string;
  status: 'processing';
  endpoint: string;
  expires_at: string;
  metadata: { event: string; action: string | null; delivery_id: string };
}

export function buildDeliveryClaim(
  deliveryId: string,
  event: string,
  action: string | null,
  rawBody: string,
  now: Date = new Date()
): DeliveryClaim {
  return {
    key: `${WEBHOOK_ENDPOINT}:${deliveryId}`,
    request_hash: createHash('sha256').update(rawBody).digest('hex'),
    status: 'processing',
    endpoint: WEBHOOK_ENDPOINT,
    expires_at: new Date(now.getTime() + DELIVERY_TTL_MS).toISOString(),
    metadata: { event, action, delivery_id: deliveryId },
  };
}

/**
 * A `processing` claim older than this is treated as abandoned (the invocation
 * died). Netlify background functions run at most 15 minutes, so 20 minutes
 * leaves headroom for a slow but live run.
 */
export const STALE_PROCESSING_MS = 20 * 60 * 1000;

export function staleProcessingCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - STALE_PROCESSING_MS).toISOString();
}

/**
 * Fields to write when taking over a failed or stale claim for a redelivery.
 * Resets the clock and the recorded outcome; keeps the original key.
 */
export function buildReclaimPatch(claim: DeliveryClaim, now: Date = new Date()) {
  return {
    status: 'processing' as const,
    request_hash: claim.request_hash,
    response: null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + DELIVERY_TTL_MS).toISOString(),
    metadata: { ...claim.metadata, retried_at: now.toISOString() },
  };
}

/** Postgres unique-violation code, what a duplicate delivery id insert returns. */
export const PG_UNIQUE_VIOLATION = '23505';

export function isDuplicateKeyError(error: { code?: string } | null | undefined): boolean {
  return error?.code === PG_UNIQUE_VIOLATION;
}
