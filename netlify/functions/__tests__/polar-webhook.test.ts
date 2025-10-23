import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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

// Mock Polar Webhooks
const mockWebhooksHandler = vi.fn();
vi.mock('@polar-sh/nextjs', () => ({
  Webhooks: vi.fn(() => mockWebhooksHandler),
}));

// Mock WorkspaceBackfillService
vi.mock('../../../src/services/workspace-backfill.service', () => ({
  WorkspaceBackfillService: {
    triggerWorkspaceBackfill: vi.fn(),
  },
}));

describe('Polar Webhook Handler', () => {
  let mockEvent: Partial<HandlerEvent>;
  let mockContext: Partial<HandlerContext>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset Supabase mocks
    mockSupabase.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockResolvedValue({ data: {}, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockEvent = {
      body: JSON.stringify({ type: 'test' }),
      headers: {
        'x-polar-signature': 'test-signature',
      },
    };

    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Environment Variable Validation', () => {
    it('should return 500 if POLAR_WEBHOOK_SECRET is missing', async () => {
      const originalSecret = process.env.POLAR_WEBHOOK_SECRET;
      delete process.env.POLAR_WEBHOOK_SECRET;

      vi.resetModules();
      const module = await import('../polar-webhook');
      const testHandler = module.handler;

      const response = await testHandler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Webhook configuration error',
      });

      process.env.POLAR_WEBHOOK_SECRET = originalSecret;
    });

    it('should return 500 if SUPABASE_URL is missing', async () => {
      const originalUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      vi.resetModules();
      const module = await import('../polar-webhook');
      const testHandler = module.handler;

      const response = await testHandler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Database configuration error',
      });

      process.env.SUPABASE_URL = originalUrl;
    });

    it('should return 500 if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      vi.resetModules();
      const module = await import('../polar-webhook');
      const testHandler = module.handler;

      const response = await testHandler(mockEvent as HandlerEvent, mockContext as HandlerContext);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Database configuration error',
      });

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });

  describe('Subscription Creation Handler', () => {
    it('should throw error when user_id is missing from metadata', async () => {
      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_team_456',
        status: 'active',
        metadata: {}, // Missing user_id
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'month',
      };

      await expect(webhooksConfig.onSubscriptionCreated(subscription)).rejects.toThrow(
        'Missing user_id in subscription metadata'
      );
    });

    it('should successfully create subscription with all required fields', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_team_456',
        status: 'active',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'month',
      };

      await webhooksConfig.onSubscriptionCreated(subscription);

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

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_pro_123',
        status: 'trialing',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'year',
      };

      await webhooksConfig.onSubscriptionCreated(subscription);

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

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'unknown_product_id',
        status: 'active',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'month',
      };

      await webhooksConfig.onSubscriptionCreated(subscription);

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

    it('should throw error when database upsert fails', async () => {
      const mockUpsert = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Database error' } });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_team_456',
        status: 'active',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'month',
      };

      await expect(webhooksConfig.onSubscriptionCreated(subscription)).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('Subscription Update Handler', () => {
    it('should update subscription with error handling', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_pro_123',
        status: 'active',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'month',
      };

      await webhooksConfig.onSubscriptionUpdated(subscription);

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
      expect(mockEq).toHaveBeenCalledWith('polar_subscription_id', 'sub_123');
    });

    it('should throw error when update fails', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_team_456',
        status: 'active',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: 'month',
      };

      await expect(webhooksConfig.onSubscriptionUpdated(subscription)).rejects.toEqual({
        message: 'Update failed',
      });
    });
  });

  describe('Tier Mapping', () => {
    it.each([
      ['prod_test_pro_123', 'pro', 1, 3],
      ['prod_test_team_456', 'team', 3, 3],
      ['unknown_product', 'free', 0, 0],
    ])(
      'should map product_id %s to tier %s with %d workspaces and %d repos',
      async (productId, expectedTier, expectedWorkspaces, expectedRepos) => {
        const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
        mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

        const { Webhooks } = await import('@polar-sh/nextjs');
        const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

        const subscription = {
          id: 'sub_123',
          customer_id: 'cust_123',
          product_id: productId,
          status: 'active',
          metadata: { user_id: 'user_123' },
          current_period_start: '2025-10-01T00:00:00Z',
          current_period_end: '2025-11-01T00:00:00Z',
          created_at: '2025-10-01T00:00:00Z',
          recurring_interval: 'month',
        };

        await webhooksConfig.onSubscriptionCreated(subscription);

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
    ])('should map recurring_interval %s to billing_cycle %s', async (interval, expected) => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const { Webhooks } = await import('@polar-sh/nextjs');
      const webhooksConfig = (Webhooks as ReturnType<typeof vi.fn>).mock.calls[0][0];

      const subscription = {
        id: 'sub_123',
        customer_id: 'cust_123',
        product_id: 'prod_test_team_456',
        status: 'active',
        metadata: { user_id: 'user_123' },
        current_period_start: '2025-10-01T00:00:00Z',
        current_period_end: '2025-11-01T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        recurring_interval: interval,
      };

      await webhooksConfig.onSubscriptionCreated(subscription);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_cycle: expected,
        }),
        { onConflict: 'user_id' }
      );
    });
  });
});
