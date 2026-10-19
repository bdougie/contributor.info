import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyWebhookSignature,
  readWebhookHeaders,
  isHandledEvent,
  buildDeliveryClaim,
  isDuplicateKeyError,
  DELIVERY_TTL_MS,
  WEBHOOK_ENDPOINT,
} from '../lib/github-webhook.mts';

const SECRET = 'test-webhook-secret';

function sign(body: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ action: 'opened', number: 1 });

  it('accepts a signature produced with the shared secret', () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejects a signature produced with a different secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'other'), SECRET)).toBe(false);
  });

  it('rejects when the body was altered after signing', () => {
    expect(verifyWebhookSignature(body + ' ', sign(body), SECRET)).toBe(false);
  });

  it('rejects a missing, empty, or non-sha256 header without throwing', () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, '', SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha1=abc', SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha256=short', SECRET)).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    expect(verifyWebhookSignature(body, sign(body), '')).toBe(false);
  });
});

describe('readWebhookHeaders', () => {
  it('reads the three GitHub headers case-insensitively', () => {
    const headers = new Headers({
      'X-Hub-Signature-256': 'sha256=abc',
      'X-GitHub-Event': 'pull_request',
      'X-GitHub-Delivery': 'delivery-1',
    });
    expect(readWebhookHeaders(headers)).toEqual({
      signature: 'sha256=abc',
      event: 'pull_request',
      deliveryId: 'delivery-1',
    });
  });

  it('returns nulls when headers are absent', () => {
    expect(readWebhookHeaders(new Headers())).toEqual({
      signature: null,
      event: null,
      deliveryId: null,
    });
  });
});

describe('isHandledEvent', () => {
  it('accepts the events the app/webhooks handlers implement', () => {
    for (const e of [
      'pull_request',
      'issues',
      'issue_comment',
      'installation',
      'installation_repositories',
    ]) {
      expect(isHandledEvent(e)).toBe(true);
    }
  });

  it('rejects ping, check_run, label and unknown events', () => {
    for (const e of ['ping', 'check_run', 'label', 'push', null]) {
      expect(isHandledEvent(e)).toBe(false);
    }
  });
});

describe('buildDeliveryClaim', () => {
  it('keys on the delivery id, hashes the body, and expires after the TTL', () => {
    const now = new Date('2026-10-18T00:00:00.000Z');
    const body = '{"action":"opened"}';
    const claim = buildDeliveryClaim('d-123', 'pull_request', 'opened', body, now);

    expect(claim.key).toBe(`${WEBHOOK_ENDPOINT}:d-123`);
    expect(claim.endpoint).toBe(WEBHOOK_ENDPOINT);
    expect(claim.status).toBe('processing');
    expect(claim.request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(claim.expires_at).getTime() - now.getTime()).toBe(DELIVERY_TTL_MS);
    expect(claim.metadata).toEqual({
      event: 'pull_request',
      action: 'opened',
      delivery_id: 'd-123',
    });
  });

  it('produces the same hash for the same body and a different one otherwise', () => {
    const a = buildDeliveryClaim('d', 'issues', 'opened', '{"a":1}');
    const b = buildDeliveryClaim('d', 'issues', 'opened', '{"a":1}');
    const c = buildDeliveryClaim('d', 'issues', 'opened', '{"a":2}');
    expect(a.request_hash).toBe(b.request_hash);
    expect(a.request_hash).not.toBe(c.request_hash);
  });
});

describe('isDuplicateKeyError', () => {
  it('matches the Postgres unique-violation code only', () => {
    expect(isDuplicateKeyError({ code: '23505' })).toBe(true);
    expect(isDuplicateKeyError({ code: '42P01' })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
  });
});
