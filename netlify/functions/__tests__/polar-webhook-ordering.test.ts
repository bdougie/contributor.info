import { describe, it, expect, beforeEach, vi } from 'vitest';
import { table, mockSupabase, mockValidateEvent, sendEvent } from './polar-ordering-harness';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => mockSupabase) }));
vi.mock('@polar-sh/sdk/webhooks', () => ({
  validateEvent: (...args: unknown[]) => mockValidateEvent(...args),
  WebhookVerificationError: class extends Error {},
}));
vi.mock('../../../src/services/workspace-backfill.service', () => ({
  WorkspaceBackfillService: { triggerWorkspaceBackfill: vi.fn() },
}));
vi.mock('../lib/server-tracking.mts', () => ({
  trackServerEvent: vi.fn(),
  captureServerException: vi.fn(),
}));

describe('Polar webhook: out-of-order delivery', () => {
  let handler: Parameters<typeof sendEvent>[0];
  const send = (...args: [string, string, string, Record<string, unknown>?]) =>
    sendEvent(handler, ...args);

  beforeEach(async () => {
    vi.clearAllMocks();
    table.rows = [
      { polar_subscription_id: 'sub_123', status: 'active', tier: 'pro', last_event_at: null },
    ];
    vi.resetModules();
    handler = (await import('../polar-webhook')).handler;
  });

  it('does not let a delayed older update overwrite a newer cancellation', async () => {
    await send('subscription.canceled', 'canceled', '2025-10-20T10:00:02Z');
    await send('subscription.updated', 'active', '2025-10-20T10:00:01Z');

    expect(table.rows[0].status).toBe('canceled');
  });

  it('does not let a delayed older update undo a revocation', async () => {
    await send('subscription.revoked', 'canceled', '2025-10-20T10:00:02Z');
    await send('subscription.updated', 'active', '2025-10-20T10:00:01Z');

    expect(table.rows[0].status).toBe('inactive');
    expect(table.rows[0].tier).toBe('free');
  });

  it('still applies events delivered in order', async () => {
    await send('subscription.updated', 'active', '2025-10-20T10:00:01Z');
    await send('subscription.canceled', 'canceled', '2025-10-20T10:00:02Z');

    expect(table.rows[0].status).toBe('canceled');
  });

  it('keeps a scheduled cancellation when a newer update lands before the cancel event', async () => {
    await send('subscription.updated', 'active', '2025-10-20T10:00:02Z', {
      cancelAtPeriodEnd: true,
    });
    await send('subscription.canceled', 'active', '2025-10-20T10:00:01Z');

    expect(table.rows[0].cancel_at_period_end).toBe(true);
  });
});
