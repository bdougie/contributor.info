import { supabase } from '@/lib/supabase';

export interface SubscriptionTier {
  id: 'free' | 'pro' | 'team' | 'enterprise';
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
    customIntegrations?: boolean;
    dedicatedSupport?: boolean;
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
      exportsEnabled: false, // No data exports in Pro tier
      githubRepoAccess: ['premium-analytics'],
      ssoEnabled: false, // No SSO in Pro tier
      auditLogs: false, // No audit logs in Pro tier
    },
    addons: {
      additionalWorkspace: 12, // $12 per additional workspace
      extendedDataRetention: 100, // $100/month for 365-day retention
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
      extendedDataRetention: 100, // $100/month for 365-day retention
    },
  },
  // Enterprise tier for future expansion
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499, // Custom pricing
    interval: 'month',
    features: {
      maxWorkspaces: 999, // Effectively unlimited
      maxReposPerWorkspace: 999,
      maxMembersPerWorkspace: 999, // Effectively unlimited
      dataRetentionDays: 365, // 1 year retention
      analyticsLevel: 'enterprise',
      privateWorkspaces: true,
      exportsEnabled: true,
      githubRepoAccess: ['all'],
      ssoEnabled: true,
      auditLogs: true,
      customIntegrations: true,
      dedicatedSupport: true,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _successUrl?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _cancelUrl?: string
  ) {
    try {
      // Call server-side function to create checkout session
      const response = await fetch('/.netlify/functions/polar-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productPriceId: productId,
          customerEmail: userEmail,
          metadata: {
            user_id: userId,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const session = await response.json();
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Get or create a Polar customer for a user
   * Note: Customer creation is now handled server-side in the checkout function
   */
  static async getOrCreateCustomer(userId: string, email: string) {
    // Check if customer exists in our database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('polar_customer_id')
      .eq('user_id', userId)
      .not('polar_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (subscription?.polar_customer_id) {
      return { id: subscription.polar_customer_id, email };
    }

    // Customer will be created server-side during checkout
    return null;
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
            Authorization: `Bearer ${import.meta.env.VITE_POLAR_ACCESS_TOKEN}`,
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
    return (
      featureValue === true ||
      featureValue === 'unlimited' ||
      (typeof featureValue === 'number' && featureValue > 0)
    );
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

  /**
   * Check if user has Extended Data Retention addon
   */
  static async hasExtendedRetention(userId: string): Promise<boolean> {
    try {
      // First get the subscription for this user
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        return false;
      }

      if (!subscription) {
        return false;
      }

      // Then check if this subscription has the extended retention addon
      const { data, error } = await supabase
        .from('subscription_addons')
        .select('id')
        .eq('subscription_id', subscription.id)
        .eq('addon_type', 'extended_data_retention')
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error checking extended retention addon:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking extended retention:', error);
      return false;
    }
  }

  /**
   * Get data retention days for a user (30 days default, 365 with addon)
   */
  static async getRetentionDays(userId: string): Promise<number> {
    try {
      const hasAddon = await this.hasExtendedRetention(userId);
      return hasAddon ? 365 : 30;
    } catch (error) {
      console.error('Error getting retention days:', error);
      return 30; // Safe default
    }
  }

  /**
   * Get all active addons for a user
   */
  static async getActiveAddons(userId: string): Promise<
    Array<{
      id: string;
      addonType: string;
      retentionDays?: number;
      purchasedAt: string;
    }>
  > {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      if (!subscription) {
        return [];
      }

      const { data, error } = await supabase
        .from('subscription_addons')
        .select('*')
        .eq('subscription_id', subscription.id)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching active addons:', error);
        return [];
      }

      return (data || []).map((addon) => ({
        id: addon.id,
        addonType: addon.addon_type,
        retentionDays: addon.retention_days,
        purchasedAt: addon.purchased_at,
      }));
    } catch (error) {
      console.error('Error getting active addons:', error);
      return [];
    }
  }
}

// Polar Addon Product IDs
export const POLAR_ADDON_PRODUCTS = {
  EXTENDED_DATA_RETENTION:
    import.meta.env.POLAR_PRODUCT_ID_EXTENDED_RETENTION || '65248b4b-20d8-4ad0-95c2-c39f80dc4d18',
};
