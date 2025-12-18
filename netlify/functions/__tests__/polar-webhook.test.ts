import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

// Set up environment variables before importing handler
process.env.POLAR_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.POLAR_PRODUCT_ID_PRO = 'prod_test_pro_123';
process.env.POLAR_PRODUCT_ID_TEAM = 'prod_test_team_456';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock validateEvent and WebhookVerificationError from SDK
const mockValidateEvent = vi.fn();
class MockWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

vi.mock('@polar-sh/sdk/webhooks', () => ({
  validateEvent: (...args: unknown[]) => mockValidateEvent(...args),
  WebhookVerificationError: MockWebhookVerificationError,
}));

// Capture event handlers passed to handleWebhookPayload
type EventHandlers = {
  webhookSecret: string;
  onSubscriptionCreated?: (payload: { data: SubscriptionData }) => Promise<void>;
  onSubscriptionUpdated?: (payload: { data: SubscriptionData }) => Promise<void>;
  onSubscriptionCanceled?: (payload: { data: SubscriptionData }) => Promise<void>;
  onSubscriptionRevoked?: (payload: { data: SubscriptionData }) => Promise<void>;
  onCustomerCreated?: (payload: { data: CustomerData }) => Promise<void>;
  onCustomerUpdated?: (payload: { data: CustomerData }) => Promise<void>;
  onOrderCreated?: (payload: { data: OrderData }) => Promise<void>;
  onPayload?: (payload: WebhookPayload) => Promise<void>;
};

interface SubscriptionData {
  id: string;
  customerId: string;
  productId: string;
  status: string;
  metadata?: Record<string, unknown>;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  recurringInterval: string;
}

interface CustomerData {
  id: string;
  metadata?: Record<string, unknown>;
}

interface OrderData {
  id: string;
  totalAmount: number;
  metadata?: Record<string, unknown>;
}

interface WebhookPayload {
  type: string;
  data: SubscriptionData | CustomerData | OrderData;
}

vi.mock('@polar-sh/adapter-utils', () => ({
  handleWebhookPayload: vi.fn(async (payload: WebhookPayload, handlers: EventHandlers) => {
    // Dispatch to appropriate handler based on event type
    switch (payload.type) {
      case 'subscription.created':
        if (handlers.onSubscriptionCreated) {
          await handlers.onSubscriptionCreated(payload as { data: SubscriptionData });
        }
        break;
      case 'subscription.updated':
        if (handlers.onSubscriptionUpdated) {
          await handlers.onSubscriptionUpdated(payload as { data: SubscriptionData });
        }
        break;
      case 'subscription.canceled':
        if (handlers.onSubscriptionCanceled) {
          await handlers.onSubscriptionCanceled(payload as { data: SubscriptionData });
        }
        break;
      case 'subscription.revoked':
        if (handlers.onSubscriptionRevoked) {
          await handlers.onSubscriptionRevoked(payload as { data: SubscriptionData });
        }
        break;
      case 'customer.created':
        if (handlers.onCustomerCreated) {
          await handlers.onCustomerCreated(payload as { data: CustomerData });
        }
        break;
      case 'customer.updated':
        if (handlers.onCustomerUpdated) {
          await handlers.onCustomerUpdated(payload as { data: CustomerData });
        }
        break;
      case 'order.created':
        if (handlers.onOrderCreated) {
          await handlers.onOrderCreated(payload as { data: OrderData });
        }
        break;
    }

    if (handlers.onPayload) {
      await handlers.onPayload(payload);
    }
  }),
}));

// Mock WorkspaceBackfillService
vi.mock('../../../src/services/workspace-backfill.service', () => ({
  WorkspaceBackfillService: {
    triggerWorkspaceBackfill: vi.fn(),
  },
}));

// Mock server tracking
vi.mock('../lib/server-tracking.mts', () => ({
  trackServerEvent: vi.fn(),
  captureServerException: vi.fn(),
}));

describe('Polar Webhook Handler', () => {
  let handler: (
    event: HandlerEvent,
    context: HandlerContext
  ) => Promise<{ statusCode: number; body: string }>;
  let mockEvent: Partial<HandlerEvent>;
  let mockContext: Partial<HandlerContext>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers = null;

    // Reset modules to get fresh handler
    vi.resetModules();

    // Re-setup environment variables
    process.env.POLAR_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.POLAR_PRODUCT_ID_PRO = 'prod_test_pro_123';
    process.env.POLAR_PRODUCT_ID_TEAM = 'prod_test_team_456';

    // Import fresh handler
    const module = await import('../polar-webhook');
    handler = module.handler;

    // Reset Supabase mocks
    mockSupabase.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockResolvedValue({ data: {}, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Default mock for validateEvent
    mockValidateEvent.mockReturnValue({
      type: 'test',
      data: {},
    });

    mockEvent = {
      body: JSON.stringify({ type: 'test' }),
      headers: {
        'webhook-id': 'test-id',
        'webhook-timestamp': '1234567890',
        'webhook-signature': 'test-signature',
      },
    };

    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
    };
  });

  describe('Environment Variable Validation', () => {
    it('should return 500 if POLAR_WEBHOOK_SECRET is missing', async () => {
      delete process.env.POLAR_WEBHOOK_SECRET;

      vi.resetModules();
      const module = await import('../polar-webhook');
      const testHandler = module.handler;

      const response = await testHandler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Webhook configuration error',
      });
    });

    it('should return 500 if SUPABASE_URL is missing', async () => {
      delete process.env.SUPABASE_URL;

      vi.resetModules();
      const module = await import('../polar-webhook');
      const testHandler = module.handler;

      const response = await testHandler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Database configuration error',
      });
    });

    it('should return 500 if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      vi.resetModules();
      const module = await import('../polar-webhook');
      const testHandler = module.handler;

      const response = await testHandler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Database configuration error',
      });
    });

    it('should return 400 if request body is missing', async () => {
      mockEvent.body = undefined;

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'No request body',
      });
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should return 403 if signature verification fails', async () => {
      mockValidateEvent.mockImplementation(() => {
        throw new MockWebhookVerificationError('Invalid signature');
      });

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({
        received: false,
        error: 'Invalid signature',
      });
    });

    it('should pass correct headers to validateEvent', async () => {
      mockEvent.headers = {
        'webhook-id': 'my-webhook-id',
        'webhook-timestamp': '1702000000',
        'webhook-signature': 'v1=abc123',
      };

      await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(mockValidateEvent).toHaveBeenCalledWith(
        mockEvent.body,
        {
          'webhook-id': 'my-webhook-id',
          'webhook-timestamp': '1702000000',
          'webhook-signature': 'v1=abc123',
        },
        'test-webhook-secret'
      );
    });
  });

  describe('Subscription Creation Handler', () => {
    it('should throw error when user_id is missing from metadata', async () => {
      const payload = {
        type: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'active',
          metadata: {}, // Missing user_id
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
    });

    it('should successfully create subscription with all required fields', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const payload = {
        type: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'active',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          polar_customer_id: 'cust_123',
          polar_subscription_id: 'sub_123',
          status: 'active',
          tier: 'team',
          max_workspaces: 3,
          max_repos_per_workspace: 3,
          billing_cycle: 'monthly',
        }),
        { onConflict: 'user_id' }
      );
    });

    it('should map pro tier correctly with proper limits', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const payload = {
        type: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_pro_123',
          status: 'trialing',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'year',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'pro',
          max_workspaces: 1,
          max_repos_per_workspace: 3,
          billing_cycle: 'yearly',
          status: 'trialing',
        }),
        { onConflict: 'user_id' }
      );
    });

    it('should default to free tier for unknown product IDs', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const payload = {
        type: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'unknown_product_id',
          status: 'active',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      // Should log warning about unknown product ID
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown product ID'),
        'unknown_product_id'
      );

      // Should create subscription with free tier
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'free',
          max_workspaces: 0,
          max_repos_per_workspace: 0,
        }),
        { onConflict: 'user_id' }
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return 500 when database upsert fails', async () => {
      const mockUpsert = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Database error' } });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const payload = {
        type: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'active',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
    });
  });

  describe('Subscription Update Handler', () => {
    it('should update subscription with correct fields', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      const payload = {
        type: 'subscription.updated',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_pro_123',
          status: 'active',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          tier: 'pro',
          max_workspaces: 1,
          max_repos_per_workspace: 3,
          billing_cycle: 'monthly',
        })
      );
    });

    it('should return 500 when update fails', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      const payload = {
        type: 'subscription.updated',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'active',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
    });
  });

  describe('Subscription Cancellation Handler', () => {
    it('should mark subscription as canceled', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      const payload = {
        type: 'subscription.canceled',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'canceled',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
          cancel_at_period_end: true,
        })
      );
      expect(mockEq).toHaveBeenCalledWith('polar_subscription_id', 'sub_123');
    });
  });

  describe('Subscription Revocation Handler', () => {
    it('should downgrade to free tier immediately', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      const payload = {
        type: 'subscription.revoked',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'revoked',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: 'month',
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'inactive',
          tier: 'free',
          cancel_at_period_end: false,
        })
      );
    });
  });

  describe('Tier Mapping', () => {
    it.each([
      ['prod_test_pro_123', 'pro', 1, 3],
      ['prod_test_team_456', 'team', 3, 3],
      ['unknown_product', 'free', 0, 0],
    ])(
      'should map productId %s to tier %s with %d workspaces and %d repos',
      async (productId, expectedTier, expectedWorkspaces, expectedRepos) => {
        const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
        mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

        const payload = {
          type: 'subscription.created',
          data: {
            id: 'sub_123',
            customerId: 'cust_123',
            productId: productId,
            status: 'active',
            metadata: { user_id: 'user_123' },
            currentPeriodStart: '2025-10-01T00:00:00Z',
            currentPeriodEnd: '2025-11-01T00:00:00Z',
            createdAt: '2025-10-01T00:00:00Z',
            recurringInterval: 'month',
          },
        };

        mockValidateEvent.mockReturnValue(payload);

        await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            tier: expectedTier,
            max_workspaces: expectedWorkspaces,
            max_repos_per_workspace: expectedRepos,
          }),
          { onConflict: 'user_id' }
        );
      }
    );
  });

  describe('Billing Cycle Mapping', () => {
    it.each([
      ['year', 'yearly'],
      ['month', 'monthly'],
      ['unknown', null],
    ])('should map recurringInterval %s to billing_cycle %s', async (interval, expected) => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const payload = {
        type: 'subscription.created',
        data: {
          id: 'sub_123',
          customerId: 'cust_123',
          productId: 'prod_test_team_456',
          status: 'active',
          metadata: { user_id: 'user_123' },
          currentPeriodStart: '2025-10-01T00:00:00Z',
          currentPeriodEnd: '2025-11-01T00:00:00Z',
          createdAt: '2025-10-01T00:00:00Z',
          recurringInterval: interval,
        },
      };

      mockValidateEvent.mockReturnValue(payload);

      await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_cycle: expected,
        }),
        { onConflict: 'user_id' }
      );
    });
  });

  describe('Success Response', () => {
    it('should return 200 with received: true on success', async () => {
      const payload = {
        type: 'test.event',
        data: {},
      };

      mockValidateEvent.mockReturnValue(payload);

      const response = await handler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ received: true });
    });
  });
});
