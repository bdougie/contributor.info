import { Handler } from '@netlify/functions';
import { Webhooks } from '@polar-sh/nextjs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';

// Initialize Supabase client with service role for webhook operations
const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define webhook handler
export const handler: Handler = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (subscription) => {
    console.log('Subscription created:', subscription.id);

    // Get user ID from metadata
    const userId = subscription.metadata?.user_id as string;
    if (!userId) {
      console.error('No user_id in subscription metadata');
      return;
    }

    // Update subscription in database
    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        polar_customer_id: subscription.customer_id,
        polar_subscription_id: subscription.id,
        status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive',
        tier: mapProductToTier(subscription.product_id),
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        created_at: subscription.created_at,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );
  },

  onSubscriptionUpdated: async (subscription) => {
    console.log('Subscription updated:', subscription.id);

    // Update subscription status in database
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive',
        tier: mapProductToTier(subscription.product_id),
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('polar_subscription_id', subscription.id);
  },

  onSubscriptionCanceled: async (subscription) => {
    console.log('Subscription canceled:', subscription.id);

    // Mark subscription as canceled
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('polar_subscription_id', subscription.id);
  },

  onSubscriptionRevoked: async (subscription) => {
    console.log('Subscription revoked:', subscription.id);

    // Immediately downgrade to free tier
    await supabase
      .from('subscriptions')
      .update({
        status: 'inactive',
        tier: 'free',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('polar_subscription_id', subscription.id);
  },

  onCustomerCreated: async (customer) => {
    console.log('Customer created:', customer.id);

    // Get user ID from metadata
    const userId = customer.metadata?.user_id as string;
    if (!userId) {
      console.error('No user_id in customer metadata');
      return;
    }

    // Create or update subscription record with customer ID
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
  },

  onCustomerUpdated: async (customer) => {
    console.log('Customer updated:', customer.id);

    // Update customer information if needed
    await supabase
      .from('subscriptions')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('polar_customer_id', customer.id);
  },

  onOrderCreated: async (order) => {
    console.log('Order created:', order.id);

    // Log order for analytics
    const userId = order.metadata?.user_id as string;
    if (userId) {
      console.log(`User ${userId} completed order ${order.id} for $${order.amount / 100}`);
    }
  },

  onPayload: async (payload) => {
    // Handle any other webhook events
    console.log('Received webhook event:', payload.type);
  },
});

// Helper function to map Polar product IDs to our tier names
function mapProductToTier(productId: string): string {
  // Map your actual Polar product IDs to tier names
  const productTierMap: Record<string, string> = {
    [process.env.POLAR_PRODUCT_ID_PRO || '']: 'pro',
    [process.env.POLAR_PRODUCT_ID_TEAM || '']: 'team',
  };

  return productTierMap[productId] || 'free';
}
