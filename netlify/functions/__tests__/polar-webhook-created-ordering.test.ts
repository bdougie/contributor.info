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

describe('Polar webhook: subscription.created ordering', () => {
  let handler: Parameters<typeof sendEvent>[0];
  const send = (...args: [string, string, string]) => sendEvent(handler, ...args);

  beforeEach(async () => {
    vi.clearAllMocks();
    table.rows = [];
    table.beforeUpsert = undefined;
    vi.resetModules();
    handler = (await import('../polar-webhook')).handler;
  });

  it('creates the subscription and records the event time', async () => {
    await send('subscription.created', 'active', '2025-10-20T10:00:00Z');

    expect(table.rows[0].status).toBe('active');
    expect(table.rows[0].last_event_at).toBe('2025-10-20T10:00:00.000Z');
  });

  it('does not let a replayed created event undo a newer cancellation', async () => {
    await send('subscription.created', 'active', '2025-10-20T10:00:00Z');
    await send('subscription.canceled', 'canceled', '2025-10-20T10:00:02Z');
    await send('subscription.created', 'active', '2025-10-20T10:00:00Z');

    expect(table.rows[0].status).toBe('canceled');
  });

  it('applies a newer creation to an existing row', async () => {
    await send('subscription.created', 'active', '2025-10-20T10:00:00Z');
    await send('subscription.created', 'trialing', '2025-10-20T10:00:01Z');

    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({
      status: 'trialing',
      last_event_at: '2025-10-20T10:00:01.000Z',
    });
  });

  it('preserves a cancellation committed immediately before a replay writes', async () => {
    await send('subscription.created', 'active', '2025-10-20T10:00:00Z');

    table.beforeUpsert = async () => {
      await send('subscription.canceled', 'canceled', '2025-10-20T10:00:02Z');
    };
    await send('subscription.created', 'active', '2025-10-20T10:00:01Z');

    expect(table.rows[0]).toMatchObject({
      status: 'canceled',
      last_event_at: '2025-10-20T10:00:02.000Z',
    });
  });
});
