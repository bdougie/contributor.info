import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

process.env.POLAR_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.POLAR_PRODUCT_ID_PRO = 'prod_test_pro_123';
process.env.POLAR_PRODUCT_ID_TEAM = 'prod_test_team_456';

// Minimal in-memory `subscriptions` table that understands the filters the handler uses:
// .eq(col, value) and .or('col.is.null,col.lt.value')
type Row = Record<string, unknown>;
let rows: Row[] = [];

function makeQuery(values: Row) {
  const eqs: Array<[string, unknown]> = [];
  let orExpr: string | null = null;
  const matches = (row: Row) => {
    if (!eqs.every(([c, v]) => row[c] === v)) return false;
    if (!orExpr) return true;
    return orExpr.split(',').some((cond) => {
      const [col, op, ...rest] = cond.split('.');
      const val = rest.join('.');
      if (op === 'is' && val === 'null') return row[col] == null;
      if (op === 'lt') return row[col] != null && new Date(row[col] as string) < new Date(val);
      return false;
    });
  };
  const query: Record<string, unknown> = {
    eq(col: string, v: unknown) {
      eqs.push([col, v]);
      return query;
    },
    or(expr: string) {
      orExpr = expr;
      return query;
    },
    then(resolve: (v: unknown) => unknown) {
      rows.filter(matches).forEach((r) => Object.assign(r, values));
      return Promise.resolve({ data: {}, error: null }).then(resolve);
    },
  };
  return query;
}

const mockSupabase = {
  from: vi.fn(() => ({ update: (values: Row) => makeQuery(values) })),
};

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => mockSupabase) }));

const mockValidateEvent = vi.fn();
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
  let handler: (e: HandlerEvent, c: HandlerContext) => Promise<{ statusCode: number }>;

  const send = (type: string, status: string, timestamp: string) => {
    mockValidateEvent.mockReturnValue({
      type,
      timestamp,
      data: {
        id: 'sub_123',
        customerId: 'cust_123',
        productId: 'prod_test_pro_123',
        status,
        metadata: { user_id: 'user_123' },
        currentPeriodStart: '2025-10-01T00:00:00Z',
        currentPeriodEnd: '2025-11-01T00:00:00Z',
        createdAt: '2025-10-01T00:00:00Z',
        recurringInterval: 'month',
      },
    });
    return handler(
      {
        body: JSON.stringify({ type }),
        headers: { 'webhook-id': 'id', 'webhook-timestamp': '1', 'webhook-signature': 's' },
      } as unknown as HandlerEvent,
      {} as HandlerContext
    );
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    rows = [{ polar_subscription_id: 'sub_123', status: 'active', tier: 'pro', last_event_at: null }];
    vi.resetModules();
    handler = (await import('../polar-webhook')).handler;
  });

  it('does not let a delayed older update overwrite a newer cancellation', async () => {
    await send('subscription.canceled', 'canceled', '2025-10-20T10:00:02Z');
    // The earlier "updated" event arrives late.
    await send('subscription.updated', 'active', '2025-10-20T10:00:01Z');

    expect(rows[0].status).toBe('canceled');
  });

  it('does not let a delayed older update undo a revocation', async () => {
    await send('subscription.revoked', 'canceled', '2025-10-20T10:00:02Z');
    await send('subscription.updated', 'active', '2025-10-20T10:00:01Z');

    expect(rows[0].status).toBe('inactive');
    expect(rows[0].tier).toBe('free');
  });

  it('still applies events delivered in order', async () => {
    await send('subscription.updated', 'active', '2025-10-20T10:00:01Z');
    await send('subscription.canceled', 'canceled', '2025-10-20T10:00:02Z');

    expect(rows[0].status).toBe('canceled');
  });
});
