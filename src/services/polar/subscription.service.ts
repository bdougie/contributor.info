import { polarClient } from './polar.client';
import { supabase } from '@/lib/supabase';

export interface SubscriptionTier {
  id: 'free' | 'pro' | 'team';
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: {
    maxWorkspaces: number;
    maxReposPerWorkspace: number;
    maxMembersPerWorkspace: number;
    dataRetentionDays: number;
    analyticsLevel: 'basic' | 'advanced' | 'enterprise';
    privateWorkspaces: boolean;
    exportsEnabled: boolean;
    githubRepoAccess?: string[];
    ssoEnabled?: boolean;
    auditLogs?: boolean;
  };
  addons?: {
    additionalWorkspace?: number; // Price per additional workspace
    additionalMember?: number; // Price per additional member
    extendedDataRetention?: number; // Price for extended data retention
  };
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: {
      maxWorkspaces: 0, // No workspaces on free tier
      maxReposPerWorkspace: 0,
      maxMembersPerWorkspace: 0,
      dataRetentionDays: 7, // Minimal retention for free
      analyticsLevel: 'basic',
      privateWorkspaces: false,
      exportsEnabled: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19,
    interval: 'month',
    features: {
      maxWorkspaces: 1, // 1 workspace included
      maxReposPerWorkspace: 3,
      maxMembersPerWorkspace: 1, // No member invites (solo plan)
      dataRetentionDays: 30,
      analyticsLevel: 'advanced',
      privateWorkspaces: false, // Public workspaces only for Pro
      exportsEnabled: true,
      githubRepoAccess: ['premium-analytics'],
    },
    addons: {
      additionalWorkspace: 12, // $12 per additional workspace
      extendedDataRetention: 10, // TBD pricing for extended retention
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 99,
    interval: 'month',
    features: {
      maxWorkspaces: 3, // Start with 3 workspaces
      maxReposPerWorkspace: 3,
      maxMembersPerWorkspace: 5, // 5 member invites included
      dataRetentionDays: 30,
      analyticsLevel: 'enterprise',
      privateWorkspaces: true,
      exportsEnabled: true,
      githubRepoAccess: ['premium-analytics', 'advanced-insights'],
      ssoEnabled: true,
      auditLogs: true,
    },
    addons: {
      additionalWorkspace: 12, // $12 per additional workspace
      additionalMember: 20, // $20 per additional member after 5
      extendedDataRetention: 25, // TBD pricing for extended retention
    },
  },
};

export class SubscriptionService {
  /**
   * Get the current user's subscription from the database
   */
  static async getCurrentSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching subscription:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create a checkout session for upgrading to a paid plan
   */
  static async createCheckoutSession(
    userId: string,
    userEmail: string,
    productId: string,
    successUrl: string,
    cancelUrl?: string
  ) {
    try {
      const checkoutCreate = {
        productPriceId: productId,
        successUrl,
        cancelUrl: cancelUrl || successUrl,
        customerEmail: userEmail,
        metadata: {
          user_id: userId,
        },
      };

      const session = await polarClient.checkouts.create(
        checkoutCreate as Parameters<typeof polarClient.checkouts.create>[0]
      );
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Get or create a Polar customer for a user
   */
  static async getOrCreateCustomer(userId: string, email: string) {
    // First check if customer exists in our database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('polar_customer_id')
      .eq('user_id', userId)
      .not('polar_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (subscription?.polar_customer_id) {
      try {
        const customer = await polarClient.customers.get({ id: subscription.polar_customer_id });
        return customer;
      } catch (error) {
        console.error('Error fetching customer from Polar:', error);
      }
    }

    // Create new customer
    const customer = await polarClient.customers.create({
      email,
      metadata: {
        user_id: userId,
      },
    });

    // Store customer ID in database
    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        polar_customer_id: customer.id,
        tier: 'free',
        status: 'inactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    return customer;
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string) {
    try {
      // Cancel subscription through Polar API
      // Note: The actual cancellation will be handled via webhook
      const response = await fetch(
        `https://api.polar.sh/v1/subscriptions/${subscriptionId}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.POLAR_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const subscription = await response.json();

      // Update database
      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('polar_subscription_id', subscriptionId);

      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Check if a user has access to a specific feature
   */
  static async checkFeatureAccess(userId: string, featureName: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);
    const tier = subscription?.tier || 'free';
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    if (!tierConfig) {
      return false;
    }

    const featureValue = (tierConfig.features as Record<string, unknown>)[featureName];
    return featureValue === true || featureValue === 'unlimited' || featureValue > 0;
  }

  /**
   * Get feature limit for a user
   */
  static async getFeatureLimit(userId: string, featureName: string): Promise<number | 'unlimited'> {
    const subscription = await this.getCurrentSubscription(userId);
    const tier = subscription?.tier || 'free';
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    if (!tierConfig) {
      return 0;
    }

    const featureValue = (tierConfig.features as Record<string, unknown>)[featureName];

    if (featureValue === 'unlimited') {
      return 'unlimited';
    }

    if (typeof featureValue === 'number') {
      return featureValue;
    }

    return featureValue ? 1 : 0;
  }

  /**
   * Check if user can create more workspaces
   */
  static async canCreateWorkspace(userId: string): Promise<boolean> {
    const limit = await this.getFeatureLimit(userId, 'maxWorkspaces');

    if (limit === 'unlimited') {
      return true;
    }

    const { count } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId);

    return (count || 0) < limit;
  }

  /**
   * Check if user can add more repositories to a workspace
   */
  static async canAddRepository(userId: string, workspaceId: string): Promise<boolean> {
    const limit = await this.getFeatureLimit(userId, 'maxReposPerWorkspace');

    if (limit === 'unlimited') {
      return true;
    }

    const { count } = await supabase
      .from('workspace_repositories')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    return (count || 0) < limit;
  }

  /**
   * Get usage statistics for a user
   */
  static async getUsageStats(userId: string) {
    const [subscription, workspaceCount, featureUsage] = await Promise.all([
      this.getCurrentSubscription(userId),
      supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId),
      supabase.from('feature_usage').select('*').eq('user_id', userId),
    ]);

    const tier = subscription?.tier || 'free';
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    return {
      tier,
      subscription,
      limits: tierConfig.features,
      usage: {
        workspaces: workspaceCount.count || 0,
        features: featureUsage.data || [],
      },
    };
  }

  /**
   * Update feature usage tracking
   */
  static async updateFeatureUsage(
    userId: string,
    workspaceId: string,
    metricType: string,
    value: number
  ) {
    await supabase.from('feature_usage').upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        metric_type: metricType,
        current_value: value,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,workspace_id,metric_type',
      }
    );
  }
}
