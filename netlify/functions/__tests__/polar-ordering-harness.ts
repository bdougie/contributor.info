import { vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

process.env.POLAR_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.POLAR_PRODUCT_ID_PRO = 'prod_test_pro_123';
process.env.POLAR_PRODUCT_ID_TEAM = 'prod_test_team_456';

// Minimal in-memory `subscriptions` table: .update/.select + .eq + .or('col.is.null,col.lt.value'),
// plus .maybeSingle() and .upsert() (keyed by polar_subscription_id).
type Row = Record<string, unknown>;
export const table: { rows: Row[] } = { rows: [] };
export const mockValidateEvent = vi.fn();

function makeQuery(update?: Row) {
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
    eq: (col: string, v: unknown) => (eqs.push([col, v]), query),
    or: (expr: string) => ((orExpr = expr), query),
    maybeSingle: async () => ({ data: table.rows.find(matches) ?? null, error: null }),
    then(resolve: (v: unknown) => unknown) {
      if (update) table.rows.filter(matches).forEach((r) => Object.assign(r, update));
      return Promise.resolve({ data: {}, error: null }).then(resolve);
    },
  };
  return query;
}

export const mockSupabase = {
  from: vi.fn(() => ({
    update: (values: Row) => makeQuery(values),
    select: () => makeQuery(),
    upsert: async (values: Row) => {
      const row = table.rows.find((r) => r.polar_subscription_id === values.polar_subscription_id);
      if (row) Object.assign(row, values);
      else table.rows.push({ ...values });
      return { data: {}, error: null };
    },
  })),
};

type Handler = (e: HandlerEvent, c: HandlerContext) => Promise<{ statusCode: number }>;

export function sendEvent(
  handler: Handler,
  type: string,
  status: string,
  timestamp: string,
  extra: Row = {}
) {
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
      ...extra,
    },
  });
  return handler(
    {
      body: JSON.stringify({ type }),
      headers: { 'webhook-id': 'id', 'webhook-timestamp': '1', 'webhook-signature': 's' },
    } as unknown as HandlerEvent,
    {} as HandlerContext
  );
}
